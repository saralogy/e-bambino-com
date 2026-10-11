# Measurement: search outcomes and the learning loop

This file covers what e-bambino measures, how Search Console data gets into the knowledge graph, how it is read,
and how it feeds back into scoring. It follows `docs/system/CONTRACT.md` (sections 5, 6 and 12). The code is in
`scripts/outcomes/`.

## 1. Metrics, kept separate

Each family answers a different question. Do not mix them into one score, and do not let one stand in for another.

| Family | Question | Examples | Where it comes from |
|---|---|---|---|
| **Research quality** | Is what we say true and current? | share of claims on published pages with current primary-authority evidence (target 100% for YMYL); expired evidence; contested claims | Claim and Evidence nodes, `npm run kg:check` |
| **Workflow efficiency** | Does work move without getting stuck? | time from approved to released; opportunities overdue on `reviewBy`; YMYL pages waiting for a reviewer | Opportunity `history`, Run nodes |
| **Content quality** | Is the page good for a parent? | short answer first; one table or checklist; sources listed; no duplicate topic; audit passes | `npm run audit`, editorial review, OVERLAPS edges |
| **Search outcomes** | Do people find the page in search? | impressions, clicks, CTR, average position per page, against its baseline | Outcome nodes from Search Console |
| **Commercial outcomes** | Does the page help a parent decide and buy? | retailer hand-offs, saved checklists, price alerts | **not measured yet**: there is no commerce layer and no analytics. Leave unknown. |

**Activity counts are not success metrics.** Pages, briefs, claims or runs per week say how busy we were, not
whether anything got better. They may appear in a Run node's notes, never as a target.

## 2. Search outcomes: how the data flows

1. **Import** (`scripts/outcomes/import-gsc.mjs`) writes one Outcome node per page and period,
   `outcome:<page path>-<period>`, with a `MEASURES` edge to the Page node. Numbers are stored exactly as Search
   Console reports them. Several URL variants of one page (http/https, www, query strings) are merged: clicks and
   impressions are summed, CTR is recomputed and position is weighted by impressions.
   - Mode A, CSV: in Search Console open Performance, set the date range, choose the **Pages** tab, export, and run
     `node scripts/outcomes/import-gsc.mjs --csv Pages.csv --period 2026-09-14..2026-10-11`.
     The period must be the exact date range of the export.
   - Mode B, API: `GSC_SERVICE_ACCOUNT_JSON` and `GSC_SITE` set, then `node scripts/outcomes/import-gsc.mjs --api`.
     It signs a JWT (RS256, `node:crypto`), requests a read-only token and calls `searchanalytics.query` with the
     dimension `page`, search type web, final data only. Without the variables it prints a notice and exits 0.
   - The first Outcome of a page is its **baseline** (`baseline: true`). Re-importing the same period updates the same
     node, so the import is idempotent.
   - URLs that match no Page node (the home page, hub pages, removed URLs, other hosts) are printed and, with
     `--unmapped-out file.md`, listed in a file. They are never dropped silently.
   - Opportunities in state `released` whose implementing page now has an Outcome move to `measured`.
   - `--dry-run` shows what would be written. Every real import writes one Run node.
2. **Report** (`node scripts/outcomes/report.mjs [--out file.md]`) is read-only markdown. See section 3.
3. **Calibrate** (`node scripts/outcomes/calibrate.mjs`) compares scores with outcomes. See section 4.
4. **Schedule** (`.github/workflows/outcomes.yml`): monthly on the 4th plus manual dispatch. It runs only when the
   `GSC_SERVICE_ACCOUNT_JSON` secret exists and `knowledge/STOP` is absent. It imports the latest two complete
   28-day windows, runs `kg:check`, puts the report and the calibration result in the PR body, and opens or updates
   one PR on `bot/outcomes-<YYYY-MM>`. A person merges it.

### Windows

Outcomes are compared in **28-day windows** anchored to Monday 2026-01-05 (window k starts 28·k days later), so every
window has four of each weekday and windows never overlap. Search Console data is treated as final three days after
a window ends. Other period lengths can be imported (CSV), but the report only compares periods of equal length.

## 3. Reading the report

For each page with Outcome data the report shows the baseline and the latest window, the page's update date (from
the Page node), the deltas and a classification. The rules are conservative on purpose:

| Rule | Value |
|---|---|
| Like periods only | equal length; year-over-year (364 ± 7 days earlier) is used when it exists, otherwise the baseline |
| Minimum volume | 100 impressions in **both** windows, otherwise `hold` with a `low-volume` flag |
| Change threshold | ±20% relative |
| CTR comparison | only with 20+ clicks in both windows and a position change within ±1 |
| Settling time | a window must start 28+ days after the page's last update, otherwise `hold` (`recently-updated`) |
| Seasonality | every comparison that is not year-over-year carries a `seasonality` flag |

Classes:

- **improve**: impressions down 20% or more; or CTR down 20% or more at a similar position; or average position 11–20.
- **expand**: impressions up 20% or more with an average position of 10 or better; related questions may be worth covering.
- **consolidate**: the page and a page it overlaps with (through an opportunity's OVERLAPS, IMPLEMENTS or `duplicateOf`)
  both get impressions but both sit beyond position 10 in the same window.
- **hold**: not comparable yet (one window, unlike periods, low volume, recent update, page not published) or no clear change.
- **stop-investing**: three or more like windows all below the minimum on a page last updated 180+ days ago.

A class is a prompt for the lead, not a verdict. **The report never claims causation.** An edit, a seasonal change in
demand, a Google update and a competitor's new page can all move the same numbers, and the data cannot separate
them. Decisions to improve, consolidate or retire go through the opportunity state machine (CONTRACT §4).

## 4. Learning loop

- `calibrate.mjs` takes opportunities in `released`, `measured`, `improve`, `consolidate` or `retire` that have
  PLAYBOOK scores and an implementing page with an Outcome in a shared 28-day window.
- **With fewer than 20 such items it reports "insufficient data, no weight change" and writes nothing.**
- From 20 items on, it computes the Spearman rank correlation between each score dimension and impressions. A
  dimension with |rho| ≥ 0.3 gets a proposed multiplier (×1.25 or ×0.75; the penalty is read the other way round).
  The result is a **Decision node** with `by: "agent:outcomes"`, `state: "proposed"` and the numbers in `proposal`.
  Nothing is applied: a human approves (sets `state: "approved"`) and changes the PLAYBOOK or `schema.mjs` in a PR.
- A dimension with |rho| ≥ 0.5 also becomes a **Lesson node** with `LEARNED_FROM` edges to the decision, the run and
  the Outcome nodes behind it. Lessons describe an association, never a cause.
- `CALIBRATION_HYPOTHESIS` (the external weights) is revisited the same way once three months of Outcome data exist.

## 5. What the owner must provide

1. A **Search Console property** for the site. A Domain property (`sc-domain:e-bambino.com`) covers http, https and
   www; a URL-prefix property (`https://e-bambino.com/`) also works. Set the repository variable `GSC_SITE` if it is
   not `sc-domain:e-bambino.com`.
2. A **Google Cloud service account** with the Search Console API enabled in its project. Create a JSON key.
3. In Search Console, Settings → Users and permissions, add the service account's e-mail address as a user with
   **Restricted** (read-only) permission.
4. In GitHub, Settings → Secrets and variables → Actions, add the secret **`GSC_SERVICE_ACCOUNT_JSON`** with the full
   JSON key. Never commit the key, paste it into an issue or put it in a node.
5. Run the `outcomes` workflow once by hand (Actions → outcomes → Run workflow) to create the baseline.

Until then, CSV exports imported by hand (Mode A) are the only source, and demand stays `unknown` (CONTRACT §5).

## 6. Privacy

- Search Console data is **aggregate**: clicks, impressions, CTR and position per URL. It contains no personal data
  about visitors, and the import requests no query-level data.
- Nothing is added to the website: **no new trackers, cookies, scripts or fonts**. The import runs in GitHub Actions
  (or locally) and talks only to Google's API with the owner's own credentials.
- The service-account key lives only in the GitHub secret. Logs print counts and URLs of our own site, never the key.
- Commercial outcomes and on-site analytics need a consent solution first (AGENTS.md §5.3) and are out of scope here.

## 7. Testing

`scripts/outcomes/fixtures/` holds **synthetic** CSV files (clearly marked, every number invented). Use them with
`--dry-run`, or delete the Outcome and Run nodes a real test run creates. **Never commit fixture-derived nodes.**
