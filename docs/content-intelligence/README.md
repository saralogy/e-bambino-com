# Content Intelligence Desk

This directory is the handoff boundary between research agents and Claude's page-building agents. The knowledge graph
in `knowledge/` is the shared memory, and `docs/system/CONTRACT.md` is the binding workflow contract.

## The loop in ten lines

1. **Sense:** check the stop switch and the inventory first. `test -e knowledge/STOP`, `npm run kg -- search "<topic>"`, read `BACKLOG.md`. Then run one `intel-<category>` agent.
2. **Evidence:** the researcher returns a brief plus a findings bundle. Save them to `inbox/<date>-<category>-<slug>.md` and `bundles/<date>-<category>.json`.
3. **Reconcile:** `npm run kg:ingest -- docs/content-intelligence/bundles/<file>.json --dry-run`, then run it without `--dry-run`, then `npm run kg:sync`. Proposals pass through dedupe and get OVERLAPS edges.
4. **Decide:** the lead scores with CONTRACT §5 and moves opportunities `proposed → scored → approved`. Then `npm run kg:backlog`. YMYL approval is a human decision.
5. **Build:** `content-editor` takes one approved opportunity in its own worktree, runs the editor pass and then the adversarial fact-check, and returns a bundle. Ingest that bundle with `npm run kg:ingest`.
6. **Validate:** `npm run build && npm run audit && npm run kg:check`. All three must pass with 0 errors. Then move the opportunity `in_review`, or `blocked_review` for YMYL.
7. **Release:** a human reviews (Review node with result approve; `reviewedBy` is set only by that human) and merges the PR. The publisher moves the opportunity to `released`.
8. **Measure:** record Outcome nodes from a Search Console CSV export, with the first one marked `baseline: true`. Then `released → measured`. Never estimate numbers.
9. **Learn:** the lead records a Decision (improve, consolidate or retire) and a Lesson that is `LEARNED_FROM` the run, then runs `npm run kg:check` again.
10. **Repeat** from step 1. Every run writes one Run node. One category per run.

## Files

- Research agents: `.claude/agents/intel-*.md` (read-only tools). Orchestrator: `.claude/agents/content-intelligence-lead.md`.
- Technical SEO/GEO specialist: `.claude/agents/seo-geo-technical.md`. Writer/editor + fact-checker: `.claude/agents/content-editor.md`.
- Operating playbook: `.claude/content-intelligence/PLAYBOOK.md`. Brief format and findings-bundle format: `.claude/content-intelligence/BRIEF-TEMPLATE.md`.
- Incoming briefs: `inbox/` (one markdown brief per topic). Findings bundles: `bundles/` (one JSON file per run, ingested as-is).
- Ranked queue: `BACKLOG.md` (generated from the graph; do not edit by hand).

## Working agreement
Research agents produce evidence-backed briefs and findings bundles, not production pages. Page agents consume approved opportunities and own page implementation in their own worktrees. The lead prioritizes and resolves cross-category dependencies. No brief or bundle is a publication approval, and no agent approves YMYL content.

Do not store private credentials, personal data, scraped copyrighted article text, or unverified claims in briefs or bundles. Record URLs, short observations, quotes of at most 300 characters and independently verified facts rather than copying competitor articles.
