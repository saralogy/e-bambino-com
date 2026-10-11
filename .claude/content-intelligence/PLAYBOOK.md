# e-bambino Content Intelligence Playbook

## Purpose
A research layer that works alongside Claude's page-building agents. Research agents discover defensible opportunities and produce briefs plus a findings bundle; page agents decide implementation and create pages in their own branches/worktrees. This separation prevents duplicate edits, unsupported content and research pages being published as if they were editorially approved.

The knowledge graph in `knowledge/` is the shared memory. `docs/system/CONTRACT.md` is binding: it defines the node types, the opportunity state machine, who may make which transition, the approval levels and the canonical scoring. If this playbook and the contract disagree, the contract wins.

## Team topology
- **Lead/orchestrator:** `.claude/agents/content-intelligence-lead.md`
- **Category teams:** clothing, on-the-go, diapering, feeding, bath & care, breastfeeding, nursery, play, safety (`.claude/agents/intel-*.md`).
- **Technical support:** `.claude/agents/seo-geo-technical.md`
- **Writer/editor + adversarial fact-checker:** `.claude/agents/content-editor.md` (consumes an approved opportunity; the only agent that edits pages).

Each category team must only research its named hub. Cross-category ideas are recorded as referrals to the relevant team, not researched out of scope. The lead consolidates priorities and flags dependencies.

## Every run starts from the graph
Before researching, proposing or writing anything:
1. Stop switch: if `knowledge/STOP` exists, do not start. Report the reason written in it.
2. Read `AGENTS.md`, `docs/system/CONTRACT.md` and this playbook.
3. Read `docs/content-intelligence/BACKLOG.md` (generated ranking of open opportunities and their blocking gates).
4. Query the inventory for the topic:
   - Agents with Bash: `npm run kg -- search "<topic>"`, `npm run kg -- pages --status held-ymyl`, `npm run kg -- show <opp id>`, `npm run kg -- neighbors <page id> CITES`.
   - Read-only agents (no Bash): Grep `knowledge/nodes/` for the topic (e.g. Grep pattern `stroller` in `knowledge/nodes/page`, `knowledge/nodes/opportunity`, `knowledge/nodes/claim`), then Read the matching node files. If `knowledge/graph.json` exists, Grep it the same way; it holds every node plus adjacency lists.
5. Read the relevant **Page** nodes (status, ymyl, quellen, reviewedBy), **Opportunity** nodes (state, gates, OVERLAPS), and every **Lesson** node in `knowledge/nodes/lesson/` whose `appliesTo` names your role.
6. Record the exact queries you ran. They go into the findings bundle as `inventoryQueries` (`lesson:check-inventory-first`).

## Run cadence
1. Inventory from the graph (above): current pages, hubs, source registry, open opportunities and recent briefs.
2. Overlap check before proposing: if a Page or Opportunity already covers the parent question, the proposal is `improve` or `consolidate`, never `create`. Name the overlapping IDs in the rationale.
3. Build a small, representative competitor set for that category (direct publishers, trusted authorities, retailers/manufacturers where product decisions are involved).
4. Review live search results for the actual query and language. Record URL, page title, access date, observed coverage and evidence. Do not infer rankings from a single search or claim search volume without a reliable data source.
5. Identify parent questions and the underlying job-to-be-done. Compare competitor coverage with our current pages.
6. Select only opportunities where e-bambino can add original utility: calculator, checklist, comparison framework, clear decision tree, compatibility matrix, measurement guide, or a genuinely clearer evidence-backed explanation.
7. Run the technical SEO/GEO review for shortlisted opportunities.
8. Return one brief per topic (format: `BRIEF-TEMPLATE.md`) **and one findings bundle per run** (format: `BRIEF-TEMPLATE.md`, section "Findings bundle"), as a fenced `json` block in the response. The category specialist does not edit page files and does not score its own proposals.
9. The lead saves the brief to `docs/content-intelligence/inbox/` and the bundle to `docs/content-intelligence/bundles/<date>-<category>.json`, then runs `npm run kg:ingest -- <bundle>` and `npm run kg:sync`. Ingest validates the bundle, routes every proposal through the dedupe/propose path and writes the Run node. A bundle that fails validation goes back to the researcher.
10. The lead scores (CONTRACT §5), moves opportunities through the state machine (CONTRACT §4) and regenerates `BACKLOG.md`.
11. After a page agent completes, review the diff and live build separately; update the opportunity state. Never report a page published merely because a brief exists.

## State machine and approvals (summary of CONTRACT §4 and §7)
`proposed → scored → approved → in_progress → in_review → released` (or `→ blocked_review → released` for YMYL), then `measured → improve | consolidate | retire`; `rejected` from any state.
- Researchers create opportunities in `proposed` only, through `kg:ingest` (which calls propose). They never score or approve.
- The lead scores and approves non-YMYL opportunities when the hard gates pass. **YMYL approval is a human decision.**
- Agents never approve YMYL content and never record a Review with `result: approve`. Only a human Review releases a YMYL page, and only a human sets `reviewedBy` after reading the page.
- Merging to `main` is the release and stays a human action.

## Research evidence standard
For every competitor claim: exact URL + access date + what was actually observed. For every factual claim in a proposed article: a primary/authoritative source where available. Distinguish:
- **Observed:** directly visible in the source/page/code.
- **Corroborated:** independently supported by a reliable second source.
- **Hypothesis:** plausible, requires validation.
- **Unknown:** no dependable evidence available.

Competitors establish what is covered, how it's structured and where the user experience may be weak. They do not validate medical, safety, regulatory or product-performance claims. Search snippets are discovery clues, not sufficient evidence for sensitive claims.

In the findings bundle this maps to: competitor and SERP coverage are **observations**; statements of fact, recommendations and hypotheses are **claims**; the authoritative excerpts that support or contradict a claim are **evidence** (with `retrievalMethod` stated honestly: a search snippet is `search-snippet`, not `fetched`). An observation is never evidence for a claim, and `kg:ingest` rejects competitor URLs as evidence.

## Prioritization
**Canonical rubric: `docs/system/CONTRACT.md` §5** (dimensions in `SCORE_DIMENSIONS`, `scripts/kg/schema.mjs`). The lead scores; researchers supply the facts the lead needs (overlaps, evidence quality, the utility e-bambino can add) and leave scores blank. Hard gates override any score: no evidence means no approval, YMYL needs a named human reviewer, a duplicate means improve or consolidate. Do not use guessed keyword volumes or fabricated traffic forecasts; demand stays `unknown` until Search Console data exists.

## SEO/GEO standard
- Write for the parent first. Direct answer early, then explanation, conditions/exceptions, comparison or checklist.
- Use headings that answer real subquestions, descriptive title/meta, stable URL, correct language and truthful date/author/reviewer fields.
- Add contextual links to relevant hub, existing questions and useful guides. Do not add links merely to hit a count.
- Use structured data only when supported by visible page content and the actual template; validate it. Do not assume FAQ markup creates rich results.
- GEO means improving clarity, extractability, source traceability and entity consistency for answer engines. Never promise AI visibility or recommend spammy “AI SEO” tricks, fake authorship, fake citations or mass-produced thin pages.
- Technical checks must inspect current implementation before proposing changes. No new external scripts, fonts, trackers or embeds without consent/legal review.

## Editorial and legal guardrails
Follow `AGENTS.md` exactly. English is the global version at root; German is under `/de/`. Do not revive Italian framing. US English terms/spelling in English; formal Sie in German. No invented stats, people, credentials, tests, reviews, rankings or “best” claims without a documented method. No formula affiliate/deal/price-comparison promotion. Never weaken `src/lib/shipgate.ts`. Health/safety/nutrition pages need approved sources and a real named reviewer when `ymyl: true`. If no qualified reviewer is available, recommend a non-YMYL alternative or leave the page held.

## Handoff protocol to page-building agents
The brief is a proposal, not authorization to publish. Only an opportunity in state `approved` (or `improve` / `consolidate`) is handed to `content-editor`. The page agent should:
1. Read `AGENTS.md`, `docs/system/CONTRACT.md`, the approved Opportunity node, its brief and the Claims it CITES.
2. Check the current branch/worktree and the graph (`npm run kg -- search`) for duplicate work.
3. Confirm each factual claim against the cited source, and use only source keys registered in the site.
4. Build in the requested language and keep English/German translation pairing correct.
5. Add contextual internal links and follow current content schema.
6. Run build, audits, `npm run kg:check`, internal-link checks, responsive checks and schema validation appropriate to the change.
7. Return a findings bundle with every claim the page relies on and its evidence, then report changed files, evidence, validations and any unresolved review gate. Never set `reviewedBy`.
