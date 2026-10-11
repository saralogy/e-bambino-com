# Operations: scheduled jobs, limits, logs and recovery

This page covers how the intelligence system runs day to day. The rules it follows are in `CONTRACT.md` (binding) and
the reasons behind them are in `EVALUATION.md`. If this page and the code disagree, the code wins and this page gets
fixed in the same PR.

**Nothing here publishes.** Every job ends in a pull request or a report. Merging to `main` is the release, and a
person always does it.

## 1. Jobs

| Job | Where it runs | Trigger | What it does | Writes |
|---|---|---|---|---|
| **ci** | `.github/workflows/ci.yml` | Every pull request, every push to `main` | Runs `npm run build`, `npm run audit`, `npm run kg:check`, plus link and SEO checks on `dist/`. Technical gate only (see `RELEASE.md`). | Nothing. The job only reports. |
| **watch** | `.github/workflows/watch.yml` | Weekly (Mondays 05:17 UTC) plus manual `workflow_dispatch` (inputs `limit`, `dry_run`) | Refreshes `knowledge/watchlist.json`, fetches the URLs that are due, writes ChangeEvent and Run nodes, flags affected claims, runs `kg:check` and builds the revalidation list. | One branch per ISO week (`bot/watch-2026-W42`) and **one** PR for it. |
| **outcomes** | `.github/workflows/outcomes.yml` | Monthly (4th, 04:41 UTC) plus manual; skipped until the `GSC_SERVICE_ACCOUNT_JSON` secret exists. CSV imports stay manual. | Imports Search Console data into Outcome nodes (baseline first), runs `kg:check`, the outcome report and calibration. The secret is passed only to the import step; API calls time out after 30 s. Branch handling, re-scoring and the backlog are as in the watch job. | One branch per month (`bot/outcomes-2026-11`) and one PR for it. |
| **Claude research routine** (optional) | A Claude Code Routine or session, started by a person | On demand, or a schedule the owner sets | One category per run: an inventory query, then a brief, Observations, Claims and Evidence (`search-snippet`), and an Opportunity in state `proposed`. It follows the role contract for category researchers. | A branch and a PR. It never publishes, scores its own work or approves anything. |

### The watch job, step by step

1. **Stop switch.** If `knowledge/STOP` exists, the job logs the reason and skips every later step.
2. **This week's branch.** `bot/watch-<ISO week>`. If the branch already exists (a re-run in the same week), the job
   continues from it and merges `main` in. If that merge conflicts, the job fails with an `::error::` message and
   changes nothing: it never resets or force-pushes the branch. Resolve the conflict on the branch (or merge or close
   its PR and delete the branch), then re-run.
3. `node scripts/watch/build-watchlist.mjs` regenerates the allowlist from Evidence and Source node URLs and the URLs
   cited in `docs/content-intelligence/**`. It keeps each URL's `last` fetch state.
4. `node scripts/watch/fetch.mjs --limit <n> --summary <file>` fetches what is due (section 2).
5. `npm run kg:check`. Structural errors fail the job before anything is committed.
6. `node scripts/watch/revalidate.mjs` writes the researchers' work list. The job summary shows it, and so does the PR body.
7. If `knowledge/` changed, the job re-scores (`node scripts/kg/score.mjs --write`), regenerates
   `docs/content-intelligence/BACKLOG.md` (`node scripts/kg/backlog.mjs`) and runs `kg:check`, so the backlog check in
   CI passes on the bot PR. It then commits `knowledge/` and `BACKLOG.md`, pushes the branch (no force) and opens the
   PR. If an open PR for that branch already exists, it updates that PR's body instead of opening a new one.

**State carries forward only through merges.** Each URL's last hash lives in `knowledge/watchlist.json`, and the next
week's run starts from `main`. If a weekly PR is not merged, the following week re-baselines those URLs. That produces
no false change events, but it can miss a change that happened between the two runs. Merge or close the weekly PR
within the week.

PRs that the job opens with the default `GITHUB_TOKEN` do not trigger other workflows, so **ci** will not run on
them automatically. Before merging, run CI on the bot branch by hand: **Actions → CI → Run workflow**, choose the
`bot/...` branch (`ci.yml` has `workflow_dispatch`). The run's checks then show on the PR. To have CI start by itself,
let the bot jobs push with a GitHub App installation token (or a fine-grained token) stored as a secret instead of
`GITHUB_TOKEN`. The same applies to the outcomes job.

## 2. What fetch.mjs does with each URL

- **Allowlist only.** It requests only URLs listed in `knowledge/watchlist.json`, and that list is built from the
  graph and the content-intelligence docs, never from page links. Only `http`/`https`. Redirects are followed only
  on the same site (at most 3 hops); `www.` and the apex domain count as one site, and a hop to the other one is
  checked against that origin's robots.txt. Anything else is recorded as `redirect-offsite`.
- **robots.txt.** Fetched once per host per run. The job uses the group for `e-bambino-watch`, falling back to `*`,
  and applies Allow and Disallow with longest-match precedence and `*`/`$` wildcards (RFC 9309). A redirect for
  robots.txt is followed up to 5 hops on the same site (www and apex included); a redirect off the site or a sixth hop
  counts as unavailable. A 4xx response, or an unavailable robots.txt, means no restrictions. A 5xx or a network error
  means everything is disallowed (`robots-unavailable`). A redirect is never treated as disallow-all.
- **User agent:** `e-bambino-watch/1.0 (+https://e-bambino.com/about/)`.
- **Stored per URL** (`last` in the watchlist): `checked`, `status`, `httpStatus`, `attempts`, `contentHash`
  (`sha256:` of the main text), `title`, `lastModified`, `okAt` and `changedAt`. **Page text is never stored**:
  the main text (with script, style, nav, header, footer, aside, form, svg and iframe removed, and whitespace
  normalized) exists only in memory to compute the hash. Non-HTML files such as PDFs are hashed byte for byte.
- **First successful fetch** = baseline. It records the hash and writes no ChangeEvent.
- **Changed hash** = one `change:<date>-<hash12>` node with `AFFECTS` edges to every Evidence, Source and
  Observation node with that URL. Every claim linked to that evidence by `SUPPORTED_BY` or `CONTRADICTED_BY` gets
  `revalidate: <change id>`. The job never changes a claim's `status`. That is the fact-checker's call (CONTRACT §9).
- **Not current:** `http-4xx`, `http-5xx`, `robots-disallowed`, `robots-unavailable`, `error-timeout`,
  `error-network`, `too-large`, `redirect-offsite`, `redirect-loop`. The previous good hash and title are kept with
  their `okAt` date, and the URL is listed under "not current" in the revalidation list. A failure is never
  treated as "unchanged".
- **Run node:** `run:<date>-watch`. A re-run on the same day updates it. Its `outputs` are the day's counts (checked,
  ok, changed, failed, robotsBlocked, stillDue), and its `notes` list the URLs that were not current. It has `PRODUCED` edges
  to the ChangeEvents and flagged claims.
- **Source home pages** (such as `https://www.cdc.gov`) are watched monthly. Their changes AFFECT only the Source
  node and flag no claims, because a claim is tied to the Evidence URL, not to the home page.

## 3. Budgets and limits

| Limit | Value | Where |
|---|---|---|
| URLs per run | 60 by default (`--limit`), hard cap 200 | `fetch.mjs`, CONTRACT §10 |
| Requests per host | 1 every 5 s, including robots.txt and retries | `fetch.mjs` |
| Timeout per request | 20 s | `fetch.mjs` |
| Response size | 5 MB (larger responses are recorded as `too-large`) | `fetch.mjs` |
| Attempts per URL per day | 3. Retries apply only to network errors, timeouts, 429 and 5xx, with backoff of 5 s and then 10 s. A URL checked today is not due again today. | `fetch.mjs` |
| Time budget per run | 20 min (`--max-minutes`). When it runs out, the remaining URLs stay due and the Run status is `stopped`. | `fetch.mjs` |
| Job timeout | 40 min | `watch.yml` |
| Frequency | Weekly: evidence behind a claim cited by a published page. Monthly: everything else (other evidence, source home pages, competitors). "Due" means 6 or 27 days since the last check, so schedule jitter never skips a cycle. | `build-watchlist.mjs`, `common.mjs` |
| Concurrency | One watch run at a time (`concurrency: watch`, no cancel) | `watch.yml` |

At about 200 watched URLs, 60 per week covers the weekly set plus the monthly set roughly once a month. Raise
`limit` in a manual run if `stillDue` keeps growing.

## 4. Retries and failures

- **Inside a run:** transient errors are retried as listed above. Permanent results (404, robots) are recorded once.
- **A failed job:** re-run it from the Actions tab. Re-runs are safe because IDs are deterministic. The same day
  converges on the same Run node, and a URL checked today is skipped. CONTRACT §8 applies: at most 2 retries, then
  the lead looks at it.
- **A URL that keeps failing:** it stays in "Watched URLs not current" in the PR body every week. A researcher
  decides whether the evidence needs a new URL, which is a new Evidence node. The broken one is never edited in place.

## 5. Logs and the dashboard

- **Run nodes:** `npm run kg -- show run:2026-10-12-watch`, or `npm run kg -- search watch` for all of them.
- **Actions logs:** every fetched URL is logged with its status. The job summary shows the change summary and the
  revalidation list.
- **Graph overview:** `npm run kg -- stats`, `npm run kg:check` (warnings include expired evidence).
- **Work queues:** `node scripts/watch/revalidate.mjs` (re-check list, add `--within 30` to see what is coming due)
  and `docs/content-intelligence/BACKLOG.md` (ranked opportunities, generated from the graph).
- **Locally, without network:** `node scripts/watch/fetch.mjs --dry-run` lists what would be fetched.

## 6. Stop switch

Create `knowledge/STOP` with a one-line reason and merge it to `main`:

- The watch workflow skips every step.
- `fetch.mjs` and `build-watchlist.mjs` exit without writing. If STOP appears during a run, `fetch.mjs` halts before
  the next URL.
- `kg:sync`, `kg:build` and the seed halt (CONTRACT §11). Read-only commands still run and print a notice.

Only a person removes the file.

## 7. Recovery

| Situation | What to do |
|---|---|
| A site complains or asks us to stop | Add STOP, or remove that URL's Evidence or Source reference and rebuild the watchlist. Check whether its robots.txt changed. |
| A noisy page changes every week (dates, banners) | Accept the noise, or have the researcher cite a more specific URL (for example the PDF itself) in a new Evidence node. Never store page text to diff it. |
| A false ChangeEvent | Leave the node (git is the audit trail). The fact-checker re-reads the source, confirms the claims, and removes `revalidate`. |
| A bad commit on the bot branch | Close the PR and delete the `bot/watch-<week>` branch. The next run starts fresh from `main`. |
| A corrupted `knowledge/watchlist.json` | Restore it from `main` (`git checkout main -- knowledge/watchlist.json`), then run `node scripts/watch/build-watchlist.mjs`. Lost `last` state only causes a re-baseline. |
| `kg:check` fails in the watch job | Nothing is committed. Fix the structural error on a normal branch first, then re-run the job. |
| Merge conflict between two weekly PRs | Merge the older one first. The newer branch merges `main` on its next run; if that conflicts the job fails with `::error::` and changes nothing. Resolve the conflict on the branch, or close its PR, delete the branch and re-run. |

## 8. Testing the watch scripts

`node scripts/watch/selftest.mjs` copies the scripts into a temporary root, starts a local HTTP server on 127.0.0.1
that serves robots.txt behind a 301 redirect, a page in two versions, a blocked page, a 404 and a 503, and then runs the real scripts end
to end: a dry run, the baseline, a same-day re-run, a noise-only re-fetch, a real change, revalidation, `kg:check`
and STOP. It never touches the repository's `knowledge/`. The 5-second host delay can be shortened only for
loopback hosts, through `WATCH_TEST_HOST_DELAY_MS`.
