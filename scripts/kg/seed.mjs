/**
 * seed.mjs — one-off, idempotent seed of authored history: the runs and
 * decisions of 2026-10-09/10, the lessons learned from them, and the
 * duplication incidents found during the systems review.
 *
 * Run after kg:sync (it attaches to synced opportunities and pages):
 *   node scripts/kg/seed.mjs
 * Re-running it changes nothing. New history is written by the agents that
 * make it (see docs/system/CONTRACT.md), not added here.
 */
import { idFor, loadNodes, stopped, writeNode } from './lib.mjs';

if (stopped()) {
  console.log('knowledge/STOP is present: kg seed halted.');
  process.exit(0);
}

const D = '2026-10-10';
const nodes = loadNodes();
const must = (id) => { if (!nodes.has(id)) throw new Error(`seed: ${id} missing, run npm run kg:sync first`); return id; };
const write = (node, opts) => console.log(`${writeNode(node, opts).padEnd(9)} ${node.id}`);

// --- Runs (execution history) ------------------------------------------------
const RUN_SPRINT = idFor.run(D, 'content-intelligence-sprint-001');
const RUN_TEAMS = idFor.run(D, 'category-team-drafts');
const RUN_EDIT = idFor.run(D, 'opus-editorial-pass');
const RUN_SYSTEM = idFor.run(D, 'knowledge-graph-core');

const briefIds = [...nodes.values()].filter((n) => n.type === 'brief').map((n) => n.id);
write({
  id: RUN_SPRINT, type: 'run', agent: 'content-intelligence-lead + intel-* category researchers', model: 'unrecorded',
  started: D, finished: D, status: 'succeeded',
  inputs: ['AGENTS.md', '.claude/content-intelligence/PLAYBOOK.md'],
  outputs: ['docs/content-intelligence/SPRINT-001-2026-10-10.md', 'docs/content-intelligence/inbox/*.md'],
  cost: 'not recorded',
  edges: briefIds.map((to) => ({ rel: 'PRODUCED', to })),
});
write({
  id: RUN_TEAMS, type: 'run', agent: 'per-category teams (PM, researcher, writer, SEO/GEO, UX/UI, publisher)',
  model: 'claude-haiku (workflow agents ran with model haiku; commit trailers name the session model)',
  started: D, finished: D, status: 'succeeded',
  inputs: ['docs/category-plans.md'],
  outputs: ['docs/research/*.json', '38 English draft question pages (draft: true)'],
  cost: 'not recorded',
  notes: 'Drafts hedged heavily ("no source we checked ...") and needed a full editorial pass.',
});
write({
  id: RUN_EDIT, type: 'run', agent: 'editor + adversarial fact-checker, one pair per category', model: 'claude-opus-5-5 (session model, inherited by workflow agents)',
  started: D, finished: D, status: 'succeeded',
  inputs: ['38 English drafts', 'docs/research/*.json'],
  outputs: ['6 English pages released', '32 YMYL pages held for a named reviewer'],
  cost: 'not recorded',
});
write({
  id: RUN_SYSTEM, type: 'run', agent: 'systems-architect', model: 'claude-opus-5-5',
  started: D, finished: D, status: 'succeeded',
  inputs: ['AGENTS.md', 'docs/content-intelligence/', 'docs/research/', 'src/lib/shipgate.ts'],
  outputs: ['scripts/kg/', 'knowledge/', 'docs/system/EVALUATION.md', 'docs/system/CONTRACT.md'],
  cost: 'one session; no external fetches',
});

// --- Decisions -----------------------------------------------------------------
const DEC_GRAPH = idFor.decision(D, 'knowledge-graph-in-repo');
const DEC_SCORING = idFor.decision(D, 'scoring-rubric');
const DEC_EDIT = idFor.decision(D, 'editorial-pass-before-release');
write({
  id: DEC_GRAPH, type: 'decision', about: 'Where long-term memory lives', date: D, by: 'project lead',
  outcome: 'Knowledge graph as git-tracked JSON in knowledge/nodes/, compiled to a gitignored knowledge/graph.json.',
  reason: 'No backend, GDPR, and git already gives history, review and an audit trail. No external database.',
  edges: [{ rel: 'ABOUT', to: RUN_SYSTEM }],
});
write({
  id: DEC_SCORING, type: 'decision', about: 'Two competing opportunity scoring rubrics', date: D, by: 'project lead',
  outcome: 'PLAYBOOK 0–5 rubric minus a 0–5 risk/duplication penalty is canonical. The external weighting (need 25, differentiation 20, demand 20, strategic 15, evidence 10, commercial 10) is a calibration hypothesis only.',
  reason: 'Demand is unknown until Search Console is connected; weights cannot be calibrated without Outcome data. Hard gates (evidence, YMYL reviewer, duplication) override any score.',
});
write({
  id: DEC_EDIT, type: 'decision', about: 'Release path for team drafts', date: D, by: 'project lead',
  outcome: 'Team output lands as draft and needs an editorial pass and fact-check before release; YMYL pages additionally need a named human reviewer.',
  reason: 'Drafts were hedged and partly unsourced; the gate in src/lib/shipgate.ts holds YMYL pages without reviewedBy.',
  edges: [{ rel: 'ABOUT', to: RUN_EDIT }],
});

// --- Lessons -------------------------------------------------------------------
const lessons = [
  ['use-strong-model-for-editorial', 'Small-model drafts hedge heavily ("no source we checked ...") and need rewriting; use a stronger model for editorial passes.',
    'Category-team drafts of 2026-10-10 had to be rewritten in an Opus editorial pass.', ['writer-editor', 'lead'], [RUN_TEAMS, RUN_EDIT]],
  ['worktree-needs-repo-cwd', 'Workflow worktrees fail when the session working directory is not the repository; start agents from the repo root.',
    'Worktree-based agent runs failed until the session cwd was the repo (observed 2026-10-10).', ['lead', 'publisher'], [RUN_TEAMS]],
  ['snippets-weak-for-ymyl', 'Search snippets alone are weak evidence for YMYL claims; fetch or manually confirm the primary page before a YMYL claim is supported with high confidence.',
    'docs/research/*.json was gathered from search snippets only; every migrated claim is confidence "medium" and needs revalidation.', ['category-researcher', 'fact-checker'], [RUN_TEAMS, RUN_EDIT]],
  ['check-inventory-first', 'Duplicate topics arise when teams do not check the page inventory first; query the graph (pages, opportunities) before proposing or writing.',
    'car-seat-installation-check vs how-to-install-a-car-seat; stroller brief vs held how-to-choose-a-stroller; wardrobe-planner brief vs how-many-baby-clothes-do-you-need.', ['category-researcher', 'lead', 'writer-editor'], [RUN_SPRINT, RUN_TEAMS]],
  ['editor-plus-adversarial-checker', 'An Opus editor paired with an adversarial fact-checker produced publishable non-YMYL pages; keep the pairing for every release.',
    'The 2026-10-10 editorial pass released 6 non-YMYL English pages that passed the gate and the audit.', ['writer-editor', 'fact-checker'], [RUN_EDIT, DEC_EDIT]],
];
for (const [slug, what, evidence, appliesTo, from] of lessons) {
  write({
    id: idFor.lesson(slug), type: 'lesson', what, evidence, appliesTo, created: D,
    edges: from.map((to) => ({ rel: 'LEARNED_FROM', to })),
  });
}

// --- Duplication incidents -----------------------------------------------------
// 1. Two car-seat pages answer the same job in different hubs.
const CS_A = must('page:en/safety/car-seat-installation-check');
const CS_B = must('page:en/on-the-go/how-to-install-a-car-seat');
write({
  id: idFor.opportunity('consolidate-car-seat-installation'), type: 'opportunity',
  title: 'Consolidate or clearly separate the two car-seat installation pages', category: 'safety',
  action: 'consolidate', state: 'proposed', priority: 'P1', demand: 'unknown',
  gates: { evidence: true, ymyl: true, duplicateOf: [CS_A, CS_B] },
  rationale: 'Both held YMYL pages cover the 1-inch test, harness and chest clip. Decide one canonical page (or install vs check split) before a reviewer spends time on both.',
  owner: 'content-intelligence-lead', reviewBy: '2026-11-10',
  edges: [{ rel: 'OVERLAPS', to: CS_A }, { rel: 'OVERLAPS', to: CS_B }],
}, { preserve: true });

// 2./3. Briefs written without checking pages that already existed or were in flight.
function flagDuplicate(oppId, pageId) {
  const opp = nodes.get(must(oppId));
  const dup = [...new Set([...(opp.gates?.duplicateOf ?? []), must(pageId)])].sort();
  write({ ...opp, gates: { ...opp.gates, duplicateOf: dup }, edges: [...(opp.edges ?? []), { rel: 'OVERLAPS', to: pageId }] });
}
flagDuplicate('opp:on-the-go-stroller-buying-guide', 'page:en/buying-guides/how-to-choose-a-stroller');
flagDuplicate('opp:clothing-size-wardrobe-planner', 'page:en/clothing/how-many-baby-clothes-do-you-need');
