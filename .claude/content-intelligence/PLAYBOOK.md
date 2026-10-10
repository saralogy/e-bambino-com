# e-bambino Content Intelligence Playbook

## Purpose
A research layer that works alongside Claude's page-building agents. Research agents discover defensible opportunities and produce briefs; page agents decide implementation and create pages in their own branches/worktrees. This separation prevents duplicate edits, unsupported content and research pages being published as if they were editorially approved.

## Team topology
- **Lead/orchestrator:** `.claude/agents/content-intelligence-lead.md`
- **Category teams:** clothing, on-the-go, diapering, feeding, bath & care, breastfeeding, nursery, play, safety.
- **Technical support:** `.claude/agents/seo-geo-technical.md`

Each category team must only research its named hub. Cross-category ideas are recorded as referrals to the relevant team, not researched out of scope. The lead consolidates priorities and flags dependencies.

## Run cadence
1. Inventory current pages, hubs, source registry, taxonomy and recent briefs.
2. Build a small, representative competitor set for that category (direct publishers, trusted authorities, retailers/manufacturers where product decisions are involved).
3. Review live search results for the actual query and language. Record URL, page title, access date, observed coverage and evidence. Do not infer rankings from a single search or claim search volume without a reliable data source.
4. Identify parent questions and the underlying job-to-be-done. Compare competitor coverage with our current pages.
5. Score opportunities (0–5 each): parent utility, evidence/source quality, meaningful gap, fit with site/business model, internal-link leverage, feasible differentiation. Subtract 0–5 risk/duplication penalty. State assumptions; scores are prioritization aids, not measured demand.
6. Select only opportunities where e-bambino can add original utility: calculator, checklist, comparison framework, clear decision tree, compatibility matrix, measurement guide, or a genuinely clearer evidence-backed explanation.
7. Run the technical SEO/GEO review for shortlisted opportunities.
8. Save one brief per topic to `docs/content-intelligence/inbox/` using the template. The category specialist does not edit page files.
9. Lead creates a short queue for Claude's page agents with P0/P1/P2, dependencies, sources, target URL, and acceptance criteria.
10. After a page agent completes, review the diff and live build separately; update the status of the brief. Never report a page published merely because a brief exists.

## Research evidence standard
For every competitor claim: exact URL + access date + what was actually observed. For every factual claim in a proposed article: a primary/authoritative source where available. Distinguish:
- **Observed:** directly visible in the source/page/code.
- **Corroborated:** independently supported by a reliable second source.
- **Hypothesis:** plausible, requires validation.
- **Unknown:** no dependable evidence available.

Competitors establish what is covered, how it's structured and where the user experience may be weak. They do not validate medical, safety, regulatory or product-performance claims. Search snippets are discovery clues, not sufficient evidence for sensitive claims.

## Prioritization rubric
Rate each 0–5 and explain briefly:
- Parent usefulness / consequence of the unanswered question
- Evidence strength and ability to source responsibly
- Gap versus existing e-bambino pages
- Differentiation potential / original utility
- Topic-cluster and internal-link value
- Fit with neutral, no-paid-placement brand promise
Then subtract a 0–5 penalty for duplication, YMYL review burden, legal risk or inability to add unique value. Do not use guessed keyword volumes or fabricated traffic forecasts.

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
The brief is a proposal, not authorization to publish. Page agent should:
1. Read `AGENTS.md` and the brief.
2. Check the current branch/worktree for duplicate work.
3. Confirm each factual claim against the cited source, and use only source keys registered in the site.
4. Build in the requested language and keep English/German translation pairing correct.
5. Add contextual internal links and follow current content schema.
6. Run build, audits, internal-link checks, responsive checks and schema validation appropriate to the change.
7. Report changed files, evidence, validations and any unresolved review gate.
