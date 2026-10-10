# System evaluation: eight proposed integrations plus a knowledge graph

- **Date:** 2026-10-10
- **Reviewed on:** `main` at 9c1642e (editorial pass #11)
- **Method:** every verdict below was checked against the files named in it, not against the proposal text.
- **Binding decisions:** the lead's decisions (graph in the repo, ID rules, state machine, scoring, environment facts) are taken as given. They are written down in `docs/system/CONTRACT.md`.

## Verdicts

| # | Proposal | Verdict | Reason, based on the current repo |
|---|---|---|---|
| 1 | Change detection on source pages | **Adapt** | Evidence nodes now hold `url` and `revalidateBy`, and the schema has a ChangeEvent type. Fetching can't run in Claude cloud sessions (proxy), so it has to be a GitHub Actions job: allowlisted URLs from Evidence/Source nodes only, robots.txt respected, rate-limited. There is no `.github/workflows/` yet. |
| 2 | Evidence store with provenance | **Adopt** (done in core) | `docs/research/*.json` held 313 facts with claim, sourceKey and url, but nothing about retrieval method, access date or expiry. These are now Claim and Evidence nodes with `retrievalMethod: search-snippet`, `accessed`, `revalidateBy` and `sourceQuality`. |
| 3 | Content inventory and gap matching | **Adopt** (done in core) | No inventory existed: briefs listed "existing pages" by hand and got it wrong (see the incidents below). `kg:sync` now builds Page nodes for all 104 entries with their shipgate status, and opportunities get OVERLAPS edges. |
| 4 | Opportunity scoring | **Adapt** | Two rubrics compete. The PLAYBOOK 0–5 rubric minus a penalty is canonical. The external weights are stored only as `CALIBRATION_HYPOTHESIS` in `scripts/kg/schema.mjs`. Demand stays `unknown` until Search Console is connected. None of the 9 brief opportunities has been scored yet. |
| 5 | Research-to-implementation orchestration | **Adapt** | `.claude/agents/*`, the PLAYBOOK and the inbox already form a hand-off, but there's no state and no record of who did what. The core adds the Opportunity state machine, Brief → Opportunity → Need nodes and role contracts. It deliberately has no autonomous publisher: merge stays a human step. |
| 6 | CI quality gates | **Adapt** | AGENTS.md §5.4 asks for checks to pass before merge, but the repo has no CI workflow. Phase 2: one workflow running `npm run build`, `npm run audit` and `npm run kg:check` (structural errors fail the run, warnings don't). `src/lib/shipgate.ts` stays the publication gate and is not touched. |
| 7 | Search Console outcome feedback | **Defer** (schema ready) | No credentials, so no data. The Outcome node type exists (`source: gsc`, `baseline` flag). Until the owner connects Search Console, data comes in from a manual CSV export. No volumes may be invented in the meantime. |
| 8 | Scheduler and observability | **Adapt, later** | Run nodes record each job. The `knowledge/STOP` kill switch is honored by `kg:sync`, `kg:build` and the seed. Scheduling waits until there is a job worth scheduling (change detection, item 1). |
| + | Knowledge graph for long-term memory | **Adopt** (done in core) | Git-tracked JSON with one file per node and deterministic IDs. Sync is idempotent and its second run produced no diff. No external database, in line with the no-backend and GDPR constraints. Lessons and decisions are now queryable instead of being buried in commit messages. |

## SPRINT-001 technical findings: what is already fixed on `main`

| Finding (SPRINT-001) | Status on `main` | Checked in |
|---|---|---|
| robots.txt has two `User-agent: *` groups and disallows `/_astro/` | **Fixed.** There is one `*` group, `/_astro/` is no longer blocked, and the AI crawler groups repeat the disallows. | `public/robots.txt` |
| Duplicate Article JSON-LD on question pages | **Fixed.** SEO.astro no longer emits a page type ("Page types such as Article are emitted by their own views"). Only `Question.astro` emits Article. | `src/components/SEO.astro`, `src/views/Question.astro` |
| CDC is not a registered source key | **Fixed.** `cdc` is in `SOURCE_NAMES` and listed on the Sources page. Question.astro reads the shared map. | `src/lib/sources.ts`, `src/views/Sources.astro` |
| Briefs say the Bath & care, Breastfeeding and Safety English hubs are empty | **Outdated.** 15 English pages now exist in those hubs. One breastfeeding page is published and the other 14 are held YMYL pages, so Bath & care and Safety still 404. | `npm run kg -- pages --status held-ymyl` |
| No search performance data | **Still true.** | (none) |

## Duplication incidents observed

All four are recorded in the graph: OVERLAPS edges plus `gates.duplicateOf`, a consolidation opportunity, and a scoring decision.

1. **`safety/car-seat-installation-check` vs `on-the-go/how-to-install-a-car-seat`.** Two held YMYL pages in two hubs cover the same 1-inch test, harness and chest-clip checks. Recorded as `opp:consolidate-car-seat-installation` (action consolidate).
2. **Sprint-001 stroller brief vs `kaufberatung/en/how-to-choose-a-stroller.md`.** The brief proposes "build" a stroller buying guide, but a held guide already exists (status `held-nosource`, `quellen: []`). `opp:on-the-go-stroller-buying-guide` now carries `duplicateOf`, and `kg:check` warns that its action must change to improve.
3. **Clothing wardrobe-planner brief vs `clothing/how-many-baby-clothes-do-you-need`.** The brief's overlap list missed the (now published) quantity page. Same treatment as incident 2.
4. **Two competing scoring rubrics.** One is the PLAYBOOK and BRIEF-TEMPLATE 0–5 rubric with a penalty. The other is the external review's weighted percentages. Resolved by `decision:2026-10-10-scoring-rubric`: the PLAYBOOK rubric is canonical and the weights are a hypothesis.

Root cause, recorded as `lesson:check-inventory-first`: teams proposed topics without querying the inventory. From now on, a brief must list the `kg` query it ran (see CONTRACT, category researcher).

## Other findings from the build of the graph

- The English pages `sleep-sack-or-blanket` and `when-can-my-child-face-forward-in-the-car` credit "Mathilda, Nurse", but there is no record that she read them. `kg:check` warns `reviewer-unrecorded` until a human Review node exists. This matches the AGENTS.md must-do.
- `sleep-sack-or-blanket` sits in the `clothing` hub, while the nursery category plans treat it as nursery content. That's worth a hub decision.
- About 210 statements from the research files' `unverified` lists are stored as `hypothesis` claims (status `unsupported`, confidence low). They are the open research questions; no page cites them.
- All 311 migrated Evidence nodes are snippet-only and expire on 2027-04-10. For YMYL claims, a fetched or manual re-check is needed before a reviewer relies on them (`lesson:snippets-weak-for-ymyl`).
