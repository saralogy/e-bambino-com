# Release gate: what blocks a merge, and who may release what

AGENTS.md comes first, then `docs/system/CONTRACT.md` (approval levels, §7). This file describes the automated
gate in `.github/workflows/ci.yml` and the human steps around it. **Merging to `main` is the release** and stays a
human action. Nothing in CI publishes, approves or merges.

## 1. Two separate approvals

| | Technical approval | Editorial approval |
|---|---|---|
| Question | Is the build sound? | May this content be public? |
| Decided by | CI (agents may confirm it locally) | Editor + adversarial fact-checker; **a named human reviewer for YMYL** |
| Enforced by | `ci.yml` (job fails) | `src/lib/shipgate.ts` at build time, plus the human who merges |
| Shown in | Release report, section 1 | Release report, section 2 |

**Passing technical checks never authorizes publishing held content.** A green run means the site builds and is
internally consistent. It says nothing about whether a held page may go live. The publication gate in
`src/lib/shipgate.ts` decides that, and it must not be weakened (AGENTS.md §5.2).

## 2. Technical gate (CI)

The workflow runs on every pull request, on every push to `main`, and by hand (`workflow_dispatch`, used for bot PRs;
see OPERATIONS.md). Each check records its outcome, the release report is written, and the final step fails the job if
any check, or the release report's editorial gate, did not pass.

| Check | Command | Fails on | Blocks |
|---|---|---|---|
| Build | `npm run build` | Astro build error | Merge; links and SEO are then **blocked** (not run) |
| Content audit | `npm run audit` | Hard errors: a live page without sources, Italian references, emojis, broken frontmatter | Merge |
| Knowledge graph | `npm run kg:check` | Structural errors: schema, dangling edges, illegal states and opportunity history (role, chain, human YMYL approval), agent approvals, and an approving Review whose reviewer or recorder looks like an agent (`review-not-human`: model or agent words, an `agent:` id, a `.claude/agents` name). Warnings never fail. | Merge |
| Backlog up to date | `node scripts/kg/backlog.mjs --check` | `BACKLOG.md` differs from a re-render as of its own `As of:` date (so the result does not depend on the day CI runs) | Merge |
| Editorial gate | `node scripts/checks/release-report.mjs` (exit 2) | The change turns a gated YMYL page from not published on the base into published on the head, and no human approving Review node for it exists in `knowledge/nodes/review/` on the head. Pages already published on the base are not affected. | Merge |
| Internal links | `node scripts/checks/links.mjs` | A broken internal href/src (HTML, CSS, `llms.txt`), two files serving one route, a redirect to a missing page, a redirect loop | Merge |
| Technical SEO | `node scripts/checks/seo.mjs` | See below | Merge |

`seo.mjs` checks every **indexable** page in `dist/` (not `noindex`, not a redirect stub):

- exactly one canonical, absolute on `https://e-bambino.com`, with a trailing slash, pointing to a page that exists;
  no two pages share a canonical;
- a title, a meta description and exactly one `h1`;
- hreflang alternates exist, include the page itself, and link back (reciprocal);
- the sitemap lists every indexable page and no `noindex` page, redirect stub or missing URL;
- `robots.txt` has one `User-agent: *` group that does not disallow `/`, and lists a sitemap that exists;
- every `application/ld+json` block parses and has `@context`; Article has `headline`, `datePublished`, `author`
  and `publisher`; BreadcrumbList positions run 1..n and point to existing pages; any `#organization` reference is
  defined on the same page.

Warnings (description length, redirect chains, a missing trailing slash on a link, a `noindex` page whose canonical
is missing) are listed separately and never fail the run.

Run the gate locally before opening a PR:

```bash
npm run build
node scripts/checks/links.mjs
node scripts/checks/seo.mjs
node scripts/checks/release-report.mjs --run      # runs every check and prints the report
```

The checks are read-only. They still run when `knowledge/STOP` exists and say so; the report then states that
automated jobs are halted.

## 3. Editorial gate (shipgate and people)

The release report lists every content file changed against the base branch, with its shipgate status before and
after the change:

| Status | Meaning | Built into `dist/`? |
|---|---|---|
| `published` | Has sources; not a draft; YMYL pages carry `reviewedBy` | Yes |
| `draft` | `draft: true`, editorial pass not done | No |
| `held-ymyl` | `ymyl: true` and no named reviewer | No |
| `held-nosource` | `quellen` is empty | No |

Collections without the gate (names, checklists, guides, finance) are listed as "not gated".

What blocks the editorial release:

1. **Non-YMYL page:** editor plus adversarial fact-check, every cited claim SUPPORTED_BY current evidence
   (CONTRACT §7, level 2). An agent may do this.
2. **YMYL page:** additionally a **human** review (level 3). Until then the page stays `held-ymyl`.
3. **`src/lib/shipgate.ts` changed:** the report flags it. A human must approve that change explicitly.
4. **A page newly published by the merge** is listed by name. The person who merges confirms each one.
5. **A YMYL page newly published without a human approving Review node** fails CI (editorial gate, exit 2). The
   report parses frontmatter with the shipgate rules (trailing `# comments` and `quellen:` block lists included).
   A page whose `ymyl` is turned off in the same change still counts as YMYL.

### Code owners

`.github/CODEOWNERS` assigns `@saralogy` to `src/content/**`, `src/lib/shipgate.ts`, `knowledge/nodes/review/**`,
`.github/**` and `docs/system/CONTRACT.md`. **It is enforced only after the owner enables branch protection on `main`
with "Require review from Code Owners"** (Settings → Branches). Until then it only requests a review.

## 4. How a human reviewer releases a YMYL page

Only a human does these steps. An agent may prepare the branch but must never set `reviewedBy`, credit a reviewer
or record an approving Review.

1. The reviewer (a real, qualified person) reads the page as it will appear: run `npm run dev`, or open the PR
   preview, and read the full text, the short answer and the table or checklist.
2. If changes are needed, the reviewer says so; the writer fixes them and the fact-checker re-checks. Repeat.
3. When the reviewer approves, a human sets the reviewer's name in the page frontmatter:
   `reviewedBy: 'Name, Qualification'`. Never put a name on a page that person has not read (AGENTS.md §5.1).
4. A human records the Review node in the graph with `writeNode()` and the `idFor.review(pageId, date, reviewer)` ID:
   `type: review`, `page`, `reviewer`, `reviewerKind: human`, `by` (the person recording it), `byKind: human`, `date`,
   `result: approve`, and an `OF` edge to the page node. `validateNode` rejects an approving Review that is not human.
5. Run `npm run kg:sync` and `npm run kg:check`; commit the frontmatter change and the Review node on a branch.
6. Open the PR. CI runs. The release report must show the page as `published`, YMYL yes, with the reviewer named
   and a human Review recorded. If it says "no human Review node recorded", stop and fix step 4.
7. A human merges. The merge is the release.

To withdraw a page later, set `draft: true` (or remove `reviewedBy` for YMYL), sync the graph, and merge.

## 5. What CI never does

- Publish, approve or merge anything, or set `reviewedBy`.
- Fetch external sites, load third-party actions (only the official `actions/*` are used) or need secrets.
- Turn warnings into failures, or count technical success as editorial approval.
