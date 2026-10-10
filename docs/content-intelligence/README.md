# Content Intelligence Desk

This directory is the handoff boundary between research agents and Claude's page-building agents.

- Research agents: `.claude/agents/intel-*.md`
- Orchestrator: `.claude/agents/content-intelligence-lead.md`
- Technical SEO/GEO specialist: `.claude/agents/seo-geo-technical.md`
- Operating playbook: `.claude/content-intelligence/PLAYBOOK.md`
- Required brief format: `.claude/content-intelligence/BRIEF-TEMPLATE.md`
- Incoming briefs: `docs/content-intelligence/inbox/` (one markdown brief per topic)

## Working agreement
Research agents produce evidence-backed briefs, not production pages. Page agents consume briefs and own page implementation in their existing worktrees. The lead prioritizes and resolves cross-category dependencies. No brief is a publication approval.

Recommended first run: assign each category agent an inventory-and-gap pass, then have the lead deduplicate and rank the resulting opportunities. Start with empty hubs and explicit roadmap gaps in AGENTS.md, then expand into competitor-backed topic clusters. The technical specialist should audit the shared templates once, not duplicate a technical audit in every content brief.

Do not store private credentials, personal data, scraped copyrighted article text, or unverified claims in briefs. Record URLs, short observations and independently verified facts rather than copying competitor articles.
