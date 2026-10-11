/**
 * propose.mjs — the single entry point for adding an opportunity (npm run kg:propose).
 *
 * Runs dedupe first, then creates or updates opp:<slug> with OVERLAPS edges
 * to every page and opportunity at or above the check threshold. Idempotent
 * by ID: re-running with the same input changes nothing.
 *
 * Similarity never decides alone. Overlaps set gates.overlapCheck to
 * "needs-human", which blocks approval (score.mjs) until a lead or human
 * records a Decision and sets it to "resolved:<decision id>". The requested
 * action is kept; dedupe's suggestion goes into the output and notes.
 *
 * Usage:
 *   npm run kg:propose -- --title "<title>" [--question "<parent question>"] [--category <hub>]
 *       [--slug x] [--lang en] [--intent unknown] [--ymyl] [--priority P2] [--action create]
 *       [--rationale "..."] [--owner x] [--dry-run]
 *   npm run kg:propose -- --refresh opp:<slug>      re-run dedupe for one opportunity
 *   npm run kg:propose -- --refresh-all             ... for every opportunity
 */
import { fileURLToPath } from 'node:url';
import { buildInventory, dedupe, queryForText } from './dedupe.mjs';
import { addDays, byType, get, idFor, loadGraph, slugify, stopped, today, writeNode } from './lib.mjs';
import { INTENTS, LANGS, TYPES } from './schema.mjs';

export const AGENT = 'agent:propose';
const ACTIONS = TYPES.opportunity.action.enum;
const PRIORITIES = TYPES.opportunity.priority.enum;
const FINISHED = ['rejected', 'retire'];

/** Overlap targets from dedupe matches: pages and opportunities (a brief counts as its opportunity). */
function overlapTargets(g, matches, selfId) {
  const out = new Map();
  for (const m of matches.filter((x) => x.needsHumanCheck)) {
    const targets = m.kind === 'brief' ? (g.out.get(m.id) ?? []).filter((e) => e.rel === 'SPECIFIES').map((e) => e.to) : [m.id];
    for (const to of targets) {
      if (to === selfId || (m.kind !== 'page' && m.kind !== 'brief' && m.kind !== 'opportunity')) continue;
      if (!out.has(to) || out.get(to) < m.score) out.set(to, m.score);
    }
  }
  return [...out].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Create or update an opportunity. input: { title, question?, category?, slug?,
 * lang?, intent?, ymyl?, priority?, action?, rationale?, owner? } or { refresh: id }.
 * Returns { id, created, node, need, dedupe, writes } (writes empty on dryRun).
 */
export function propose(input, { dryRun = false, g = loadGraph(), inv = buildInventory(g) } = {}) {
  const existing = input.refresh ? get(g, input.refresh) : get(g, idFor.opportunity(input.slug || slugify(input.title ?? '')));
  if (input.refresh && !existing) throw new Error(`not found: ${input.refresh}`);
  const id = existing?.id ?? idFor.opportunity(input.slug || slugify(input.title));
  const date = today();

  // 1. Dedupe first.
  let dd;
  if (existing) dd = dedupe(existing, { top: 8 }, g, inv);
  else {
    const q = queryForText(input.title, { hub: input.category, lang: input.lang, intent: input.intent, ymyl: input.ymyl });
    q.id = id;
    q.kind = 'opportunity';
    q.fields.question = input.question ?? '';
    dd = dedupe(q, { top: 8 }, g, inv);
  }
  const overlaps = overlapTargets(g, dd.matches, id);
  const known = new Set((existing?.edges ?? []).filter((e) => e.rel === 'OVERLAPS').map((e) => e.to));
  const added = overlaps.filter(([to]) => !known.has(to));
  const edges = overlaps.map(([to, s]) => ({ rel: 'OVERLAPS', to, note: `dedupe ${s}; needs human check` }));

  // 2. The need (parent question), created once.
  let need = null;
  if (!existing && input.question) {
    need = {
      id: idFor.need(slugify(input.slug || input.title)), type: 'need', question: input.question,
      intent: input.intent ?? 'unknown', audience: 'expecting and new parents', lang: input.lang ?? 'en', edges: [],
    };
    edges.push({ rel: 'TARGETS', to: need.id });
  }

  // 3. The opportunity: new in state proposed, or updated with new overlaps.
  const oldGates = existing?.gates ?? { evidence: false, ymyl: !!input.ymyl, duplicateOf: [] };
  const overlapCheck = added.length || (!existing && overlaps.length) ? 'needs-human'
    : oldGates.overlapCheck ?? (overlaps.length ? 'needs-human' : 'clear');
  const node = { id, type: 'opportunity', edges, gates: { ...oldGates, overlapCheck } };
  if (!existing) {
    Object.assign(node, {
      title: input.title, category: input.category ?? 'unknown', action: input.action ?? 'create', state: 'proposed',
      priority: input.priority, demand: 'unknown', owner: input.owner ?? 'content-intelligence-lead', reviewBy: addDays(date, 90),
      rationale: input.rationale ?? `Proposed ${date} via kg:propose. Dedupe suggestion: ${dd.suggestion.action}.`,
      notes: `dedupe ${date}: ${dd.suggestion.action}${dd.suggestion.needsHumanCheck ? ' (needs human check)' : ''}. ${dd.suggestion.reasons.join(' ')}`,
    });
  } else if (added.length && existing.state === 'scored') {
    // New overlap after scoring: send back so the lead rescores (scored -> proposed is a lead transition).
    node.state = 'proposed';
    node.history = [...(existing.history ?? []), { from: 'scored', to: 'proposed', by: AGENT, role: 'lead', date, reason: `new overlap: ${added.map(([to]) => to).join(', ')}` }];
  }

  const writes = [];
  if (!dryRun) {
    if (stopped()) throw new Error('knowledge/STOP is present: kg:propose halted.');
    if (need) writes.push([need.id, writeNode(need, { preserve: true })]);
    writes.push([id, writeNode(node)]);
    const changed = writes.filter(([, r]) => r !== 'unchanged').map(([nid]) => nid);
    if (changed.length) {
      writeNode({
        id: idFor.run(date, 'propose'), type: 'run', agent: AGENT, model: 'none (deterministic script)', started: date, finished: date,
        status: 'succeeded', inputs: ['kg:dedupe inventory'], outputs: ['opportunity nodes with OVERLAPS edges'], cost: 'local computation only',
        edges: changed.map((to) => ({ rel: 'PRODUCED', to })),
      });
    }
  }
  return { id, created: !existing, node, need, dedupe: dd, added: added.map(([to]) => to), writes };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--ymyl', '--dry-run', '--refresh-all', '--json'].includes(a)) o[a.slice(2)] = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  }
  return o;
}

function validate(o) {
  if (o.action && !ACTIONS.includes(o.action)) return `--action must be one of ${ACTIONS.join(', ')}`;
  if (o.priority && !PRIORITIES.includes(o.priority)) return `--priority must be one of ${PRIORITIES.join(', ')}`;
  if (o.lang && !LANGS.includes(o.lang)) return `--lang must be one of ${LANGS.join(', ')}`;
  if (o.intent && !INTENTS.includes(o.intent)) return `--intent must be one of ${INTENTS.join(', ')}`;
  return null;
}

function report(r, dryRun) {
  console.log(`\n${dryRun ? '[dry-run] ' : ''}${r.created ? 'create' : 'update'} ${r.id}`);
  console.log(`  dedupe suggestion: ${r.dedupe.suggestion.action}${r.dedupe.suggestion.needsHumanCheck ? ' [needs human check]' : ''}`);
  for (const reason of r.dedupe.suggestion.reasons) console.log(`    - ${reason}`);
  for (const e of r.node.edges.filter((x) => x.rel === 'OVERLAPS')) console.log(`  OVERLAPS ${e.to}  (${e.note})${r.added.includes(e.to) ? '  new' : ''}`);
  console.log(`  gates.overlapCheck: ${r.node.gates.overlapCheck}${r.node.state ? `  state: ${r.node.state}` : ''}`);
  for (const [id, res] of r.writes) console.log(`  ${res.padEnd(9)} ${id}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2));
  const err = validate(o);
  if (err || !(o.title || o.refresh || o['refresh-all'])) {
    console.log(err ?? 'usage: npm run kg:propose -- --title "<title>" [--question ".."] [--category hub] [--ymyl] [--dry-run] | --refresh opp:<slug> | --refresh-all');
    process.exit(1);
  }
  const dryRun = !!o['dry-run'];
  if (!dryRun && stopped()) { console.log('knowledge/STOP is present: kg:propose halted.'); process.exit(0); }
  let g = loadGraph();
  const inputs = o['refresh-all']
    ? byType(g, 'opportunity').filter((x) => !FINISHED.includes(x.state)).map((x) => ({ refresh: x.id })).sort((a, b) => a.refresh.localeCompare(b.refresh))
    : o.refresh ? [{ refresh: o.refresh }]
      : [{ ...o, ymyl: !!o.ymyl }];
  for (const input of inputs) {
    const r = propose(input, { dryRun, g });
    report(r, dryRun);
    if (!dryRun) g = loadGraph(); // later proposals see earlier writes
  }
}
