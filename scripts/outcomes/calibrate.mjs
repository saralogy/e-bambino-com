/**
 * calibrate.mjs — compare Opportunity scores with search Outcomes (the learning loop).
 *
 *   node scripts/outcomes/calibrate.mjs [--dry-run] [--min-items 20] [--nodes dir]
 *
 * Uses released opportunities (released, measured, improve, consolidate,
 * retire) that have PLAYBOOK scores and an implementing page with an Outcome
 * in a shared 28-day window (like periods only). Below --min-items (20) it
 * reports "insufficient data, no weight change" and writes nothing.
 * Otherwise it computes Spearman rank correlations between each score
 * dimension and impressions, and PROPOSES (never applies) rubric weight
 * multipliers as a Decision node (by agent:outcomes, state proposed) for a
 * human to approve. Strong, clear associations become Lesson nodes with
 * LEARNED_FROM edges to the decision, the run and the outcomes behind them.
 * Correlation is reported as association only, never as cause.
 * With --nodes (a test copy of the graph) it never writes; it prints instead.
 */
import {
  byType, idFor, loadGraph, neighbors, NODES_DIR, relationAllowed, stopped, today, typeOfId, validateNode, writeNode,
} from '../kg/lib.mjs';
import { SCORE_DIMENSIONS, SCORE_PENALTY } from '../kg/schema.mjs';
import { parseArgs, parsePeriod, round, WINDOW_DAYS } from './common.mjs';

const args = parseArgs();
const MIN_ITEMS = Number(args['min-items'] ?? 20);
const RELEASED = ['released', 'measured', 'improve', 'consolidate', 'retire'];
const DIMS = [...SCORE_DIMENSIONS, SCORE_PENALTY];
const SIGNAL = 0.3; // |rho| at or above this moves a proposed multiplier
const LESSON = 0.5; // |rho| at or above this is a "clear pattern" worth a Lesson

/** Average ranks (ties share the mean rank). */
function ranks(xs) {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Spearman rank correlation, or null when either side has no variance. */
export function spearman(xs, ys) {
  const a = ranks(xs);
  const b = ranks(ys);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/** Released, scored opportunities with their outcomes per 28-day period. */
function collect(g) {
  const items = [];
  for (const opp of byType(g, 'opportunity')) {
    if (!RELEASED.includes(opp.state) || !opp.scores) continue;
    const perPeriod = new Map();
    for (const page of neighbors(g, opp.id, 'IMPLEMENTS', 'in')) {
      for (const o of neighbors(g, page.id, 'MEASURES', 'in')) {
        if (parsePeriod(o.period).days !== WINDOW_DAYS) continue;
        const cur = perPeriod.get(o.period) ?? { impressions: 0, clicks: 0, outcomes: [] };
        cur.impressions += o.impressions;
        cur.clicks += o.clicks;
        cur.outcomes.push(o.id);
        perPeriod.set(o.period, cur);
      }
    }
    items.push({ opp, perPeriod });
  }
  return items;
}

/** The 28-day period shared by the most items (latest on a tie). */
function sharedPeriod(items) {
  const count = new Map();
  for (const { perPeriod } of items) for (const p of perPeriod.keys()) count.set(p, (count.get(p) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0];
}

function multiplier(dim, rho) {
  if (rho === null) return 1;
  const r = dim === SCORE_PENALTY ? -rho : rho; // a useful penalty goes with lower outcomes
  if (r >= SIGNAL) return 1.25;
  if (r <= -SIGNAL) return 0.75;
  return 1;
}

function main() {
  if (stopped()) {
    console.log('knowledge/STOP is present: calibration halted, nothing written.');
    return;
  }
  const testGraph = Boolean(args.nodes);
  const dryRun = Boolean(args['dry-run']) || testGraph;
  const g = loadGraph(args.nodes ?? NODES_DIR);
  const items = collect(g);
  const period = sharedPeriod(items);
  const measured = items.filter((it) => period && it.perPeriod.has(period));

  console.log(`Released and scored opportunities: ${items.length}; measured in a shared ${WINDOW_DAYS}-day window${period ? ` (${period})` : ''}: ${measured.length}.`);
  if (measured.length < MIN_ITEMS) {
    console.log(`Insufficient data, no weight change: ${measured.length} of ${MIN_ITEMS} released and measured opportunities needed.`);
    return;
  }

  const impressions = measured.map((it) => it.perPeriod.get(period).impressions);
  const rho = {};
  const mult = {};
  for (const dim of [...DIMS, 'net']) {
    const xs = measured.map((it) => Number(it.opp.scores[dim]));
    rho[dim] = xs.some(Number.isNaN) ? null : spearman(xs, impressions);
    if (rho[dim] !== null) rho[dim] = round(rho[dim], 3);
    if (dim !== 'net') mult[dim] = multiplier(dim, rho[dim]);
  }
  const date = today();
  const n = measured.length;
  const fmt = (d) => `${d} ${rho[d] === null ? 'n/a' : rho[d]}`;
  const changed = DIMS.filter((d) => mult[d] !== 1);
  const runId = idFor.run(date, 'outcomes-calibrate');
  const decisionId = idFor.decision(date, 'rubric-weight-proposal');
  const outcomeIds = measured.flatMap((it) => it.perPeriod.get(period).outcomes);

  const decision = {
    id: decisionId,
    type: 'decision',
    about: 'PLAYBOOK rubric weights (calibration against Search Console outcomes)',
    outcome: changed.length
      ? `Proposed, not applied: ${changed.map((d) => `${d} x${mult[d]}`).join(', ')}; all other dimensions x1.`
      : 'Proposed, not applied: no weight change (no dimension reached the signal threshold).',
    reason: `Spearman rank correlation of each score with impressions in ${period} across ${n} released opportunities: ${[...DIMS, 'net'].map(fmt).join(', ')}. `
      + `Threshold |rho| >= ${SIGNAL}. This is an association only: demand, timing and topic also differ between pages. A human must approve before PLAYBOOK or schema.mjs changes.`,
    by: 'agent:outcomes',
    date,
    state: 'proposed',
    proposal: { method: 'spearman', metric: 'impressions', period, n, rho, multipliers: mult, applied: false },
    edges: measured.map((it) => ({ rel: 'ABOUT', to: it.opp.id })),
  };
  const lessons = DIMS.filter((d) => rho[d] !== null && Math.abs(rho[d]) >= LESSON).map((d) => ({
    id: idFor.lesson(`outcomes-${date}-${d}-${rho[d] > 0 ? 'rises' : 'falls'}-with-impressions`),
    type: 'lesson',
    what: `The "${d}" score ${rho[d] > 0 ? 'rose' : 'fell'} with search impressions across ${n} released opportunities (Spearman rho ${rho[d]}). This is an association, not proof that the dimension predicts or causes traffic.`,
    evidence: `${n} opportunities, Outcome nodes for ${period}, see ${decisionId}.`,
    appliesTo: ['lead'],
    created: date,
    edges: [{ rel: 'LEARNED_FROM', to: decisionId }, { rel: 'LEARNED_FROM', to: runId }, ...outcomeIds.map((to) => ({ rel: 'LEARNED_FROM', to }))],
  }));
  const run = {
    id: runId,
    type: 'run',
    agent: 'outcomes calibration (scripts/outcomes/calibrate.mjs)',
    model: 'none (deterministic script)',
    started: date,
    finished: date,
    status: 'succeeded',
    inputs: [`${n} opportunities`, `outcomes ${period}`],
    outputs: [decisionId, ...lessons.map((l) => l.id)],
    cost: 'local computation, no network',
    edges: [decision, ...lessons].map((x) => ({ rel: 'PRODUCED', to: x.id })),
  };

  console.log(`Correlations (n=${n}, ${period}): ${[...DIMS, 'net'].map(fmt).join(', ')}`);
  console.log(decision.outcome);
  for (const l of lessons) console.log(`lesson: ${l.what}`);
  const nodes = [decision, ...lessons, run];
  const problems = nodes.flatMap((x) => [
    ...validateNode(x),
    ...x.edges.filter((e) => !relationAllowed(e.rel, x.type, typeOfId(e.to))).map((e) => `${x.id}: ${e.rel} -> ${e.to} not allowed`),
  ]);
  if (problems.length) throw new Error(`refusing to write invalid nodes:\n${problems.join('\n')}`);
  if (dryRun) {
    console.log(`[${testGraph ? 'test graph' : 'dry run'}] nothing written. Would write (validated): ${nodes.map((x) => x.id).join(', ')}`);
    return;
  }
  // preserve: a human may already have moved today's proposal on; never overwrite that.
  for (const node of nodes) console.log(`${writeNode(node, { preserve: node.type !== 'run' })} ${node.id}`);
}

main();
