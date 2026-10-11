/**
 * score.mjs — PLAYBOOK opportunity scoring and hard gates (npm run kg:score).
 *
 * Canonical score (CONTRACT §5): six dimensions rated 0–5 (utility, evidence,
 * gap, differentiation, links, fit) minus a 0–5 risk/duplication penalty.
 * net = sum(dimensions) - penalty. Every rating is derived from graph and
 * brief signals by the rules below and explained in `assumptions`; they are
 * prioritization aids, not demand forecasts. A lead can pin a rating by
 * listing it in `scores.manual` (e.g. ["utility"]); pinned values are kept.
 *
 * Hypothesis score: the external weights in CALIBRATION_HYPOTHESIS, computed
 * over known components only and labelled as a hypothesis. Never used to rank.
 * Demand stays "unknown" unless Outcome nodes exist for a related page.
 *
 * Hard gates override any score: no evidence, YMYL without a named human
 * reviewer, create on a duplicate, or an overlap still waiting for a human
 * check each block approval.
 *
 * Usage:
 *   npm run kg:score [-- opp:<slug>] [--json]   print scores and gates
 *   npm run kg:score -- --write                 store scores; proposed -> scored
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_THRESHOLD, HIGH_THRESHOLD, buildInventory, dedupe, formatOf } from './dedupe.mjs';
import { byType, get, idFor, loadGraph, looksAgent, neighbors, ROOT, stopped, today, writeNode } from './lib.mjs';
import { CALIBRATION_HYPOTHESIS, SCORE_DIMENSIONS } from './schema.mjs';

export const AGENT = 'agent:gap-scoring';
export const METHOD = 'playbook-v1 (derived from graph and brief signals)';
export const HYPOTHESIS_LABEL = 'hypothesis only: CALIBRATION_HYPOTHESIS weights over known components; not used for ranking';

const clamp = (x, lo = 0, hi = 5) => Math.max(lo, Math.min(hi, Math.round(x)));
const LIVE = ['published', 'held-ymyl', 'held-nosource', 'draft'];

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** Text of the briefs that specify this opportunity (empty when none). */
function briefText(g, opp) {
  return neighbors(g, opp.id, 'SPECIFIES', 'in')
    .map((b) => join(ROOT, b.path)).filter(existsSync)
    .map((f) => readFileSync(f, 'utf8')).join('\n');
}

/** The "Differentiated utility" section of a brief (or '' when absent). */
const utilitySection = (txt) => txt.match(/^## Differentiated utility\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? '';

/** Original-utility formats from PLAYBOOK step 6, as regex groups. */
const FORMATS = {
  checklist: /checklist/i,
  'comparison table or matrix': /\b(table|matrix|comparison)\b/i,
  'planner or worksheet': /\b(planner|worksheet|sheet|template)\b/i,
  calculator: /\b(calculator|calculation|sensitivity|worked example)\b/i,
  'decision tree or chooser': /\b(decision tree|chooser|flow)\b/i,
  'measurement guide': /\bmeasur/i,
};

/** Infant-formula marketing is restricted in the EU (AGENTS.md §5.3). */
const LEGAL_RISK = /infant formula|formula (stage|milk|feeding)|s[äa]uglings(anfangs)?nahrung|pre-?nahrung/i;
const RANKING_WORDS = /\b(best|top \d+|ranking|testsieger|deals?)\b/i;

/** Claims with current supporting evidence. Returns { claim, evidence[] } or null. */
function supportedClaim(g, claim, now) {
  if (claim.status !== 'supported') return null;
  const ev = neighbors(g, claim.id, 'SUPPORTED_BY').filter((e) => e.revalidateBy >= now);
  return ev.length ? { claim, ev } : null;
}

/**
 * Related evidence: supported claims cited by pages that overlap or implement
 * the opportunity, plus claims gathered for those pages' slugs.
 */
export function relatedEvidence(g, opp, now = today()) {
  const pages = [...neighbors(g, opp.id, 'OVERLAPS'), ...neighbors(g, opp.id, 'IMPLEMENTS', 'in')].filter((n) => n.type === 'page');
  const slugs = new Set(pages.map((p) => p.slug));
  const claims = new Map();
  for (const p of pages) for (const c of neighbors(g, p.id, 'CITES')) claims.set(c.id, c);
  for (const c of byType(g, 'claim')) if ((c.topics ?? []).some((t) => slugs.has(t))) claims.set(c.id, c);
  const supported = [...claims.values()].map((c) => supportedClaim(g, c, now)).filter(Boolean);
  const ev = supported.flatMap((s) => s.ev);
  return {
    claims: supported.length,
    primary: supported.filter((s) => s.ev.some((e) => e.sourceQuality === 'primary-authority')).length,
    nonSnippet: ev.some((e) => e.retrievalMethod !== 'search-snippet'),
  };
}

/** Outcome data on pages that implement or overlap the opportunity. */
function outcomesFor(g, opp) {
  const pages = [...neighbors(g, opp.id, 'IMPLEMENTS', 'in'), ...neighbors(g, opp.id, 'OVERLAPS')].filter((n) => n.type === 'page');
  return pages.flatMap((p) => neighbors(g, p.id, 'MEASURES', 'in'));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const UTILITY_BY_PRIORITY = { P0: 5, P1: 4, P2: 3, P3: 2 };
const COMMERCIAL_BY_INTENT = { transactional: 5, comparative: 4, informational: 2, navigational: 1 };

/**
 * Score one opportunity. ctx: { g, inv, now }. Returns
 * { scores, gates, blocking, evidenceCount, overlaps, suggestion, demand }.
 */
export function scoreOpportunity(opp, ctx) {
  const { g, inv, now = today() } = ctx;
  const brief = briefText(g, opp);
  const dd = dedupe(opp, { top: 8 }, g, inv);
  const lang = dd.query.lang;
  const pageMatches = dd.matches.filter((m) => m.kind === 'page' && LIVE.includes(m.status) && m.lang === lang);
  const topPage = pageMatches[0]?.score ?? 0;
  const dupOf = opp.gates?.duplicateOf ?? [];
  const ymyl = !!opp.gates?.ymyl;
  const reviewer = String(opp.gates?.reviewer ?? '').trim();
  const rel = relatedEvidence(g, opp, now);
  const why = {};

  // utility: the researcher's priority in the brief (a judgement, not demand).
  const utility = UTILITY_BY_PRIORITY[opp.priority] ?? 3;
  why.utility = `priority ${opp.priority ?? 'unset'} from the brief (researcher judgement, not measured demand)`;

  // evidence: supported claims with current evidence in the related pages.
  let evidence = rel.claims === 0 ? 0 : rel.claims <= 2 ? 1 : rel.claims <= 5 ? 2 : 3;
  if (rel.primary >= 3) evidence += 1;
  if (rel.nonSnippet) evidence += 1;
  if (!rel.nonSnippet) evidence = Math.min(evidence, ymyl ? 2 : 3);
  evidence = clamp(evidence);
  why.evidence = rel.claims === 0
    ? 'no supported claim with current evidence on overlapping or implementing pages'
    : `${rel.claims} related supported claim(s) on overlapping pages, ${rel.primary} with primary-authority evidence; ${rel.nonSnippet ? 'some non-snippet evidence' : `snippet-only, capped at ${ymyl ? 2 : 3} (lesson:snippets-weak-for-ymyl)`}`;

  // gap: inverse of the closest same-language page match.
  let gap = topPage >= HIGH_THRESHOLD ? 1 : topPage >= CHECK_THRESHOLD ? 2 : topPage >= 0.2 ? 4 : 5;
  if (dupOf.length) gap = Math.min(gap, 1);
  why.gap = `closest page ${pageMatches[0]?.id ?? 'none'} at ${topPage}${dupOf.length ? `; duplicateOf ${dupOf.join(', ')}` : ''}`;

  // differentiation: original-utility formats named in the title or the brief.
  const utilityText = `${opp.title}\n${utilitySection(brief)}\n${opp.rationale}`;
  const formats = Object.entries(FORMATS).filter(([, re]) => re.test(utilityText)).map(([k]) => k);
  const differentiation = clamp(1 + formats.length);
  why.differentiation = formats.length ? `formats: ${formats.join(', ')}` : 'no original-utility format named';

  // links: cluster size in the hub plus published overlapping pages to link from.
  const hubPages = byType(g, 'page').filter((p) => p.hub === opp.category && p.lang === lang && p.status !== 'removed');
  const linkFrom = neighbors(g, opp.id, 'OVERLAPS').filter((p) => p.type === 'page' && p.status === 'published');
  const links = clamp(Math.floor(hubPages.length / 2) + (linkFrom.length ? 1 : 0));
  why.links = `${hubPages.length} ${lang} page(s) in hub ${opp.category}; ${linkFrom.length} published overlapping page(s)`;

  // fit: neutral, no-paid-placement brand; tools and checklists are a core value.
  const legal = LEGAL_RISK.test(`${opp.title}\n${brief}`);
  const ranking = RANKING_WORDS.test(opp.title);
  const tool = ['tool', 'checklisten', 'kaufberatung'].includes(formatOf(opp.title)) || formats.length >= 2;
  const fit = clamp(4 + (tool ? 1 : 0) - (ranking ? 1 : 0) - (legal ? 2 : 0));
  why.fit = [tool ? 'tool/checklist/buying-guide format (+1)' : 'plain answer format', ranking ? 'ranking words (-1)' : '', legal ? 'infant-formula topic (-2)' : ''].filter(Boolean).join('; ');

  // penalty: duplication, YMYL burden, legal risk, no unique value.
  const parts = [];
  if (dupOf.length) parts.push(opp.action === 'create' ? ['create on a confirmed duplicate', 3] : ['work on an existing duplicate page', 1]);
  else if (topPage >= HIGH_THRESHOLD) parts.push(['unconfirmed high overlap', 1]);
  if (ymyl) parts.push(['YMYL review burden', 1]);
  if (ymyl && !reviewer) parts.push(['no named reviewer lined up', 1]);
  if (legal) parts.push(['legal risk (infant formula)', 1]);
  if (differentiation <= 1) parts.push(['no unique value identified', 1]);
  const penalty = clamp(parts.reduce((s, [, p]) => s + p, 0));
  why.penalty = parts.length ? parts.map(([k, p]) => `${k} +${p}`).join('; ') : 'none';

  // A lead may pin individual ratings; pinned values win.
  const manual = opp.scores?.manual ?? [];
  const derived = { utility, evidence, gap, differentiation, links, fit, penalty };
  for (const k of manual) if (typeof opp.scores?.[k] === 'number') { derived[k] = opp.scores[k]; why[k] = `pinned by lead (${why[k]})`; }
  const net = SCORE_DIMENSIONS.reduce((s, k) => s + derived[k], 0) - derived.penalty;

  // Demand: unknown unless measured.
  const outcomes = outcomesFor(g, opp);
  const demand = outcomes.length
    ? `measured: ${outcomes.reduce((s, o) => s + o.impressions, 0)} impressions, ${outcomes.reduce((s, o) => s + o.clicks, 0)} clicks (${[...new Set(outcomes.map((o) => o.source))].join(', ')}, ${outcomes.length} period(s))`
    : 'unknown';

  const hypothesis = hypothesisScore(g, opp, derived, outcomes);
  const gates = hardGates(opp, dd, { ymyl, reviewer, dupOf });

  const scores = {
    ...derived, net, manual: manual.length ? manual : undefined, method: METHOD,
    assumptions: SCORE_DIMENSIONS.concat('penalty').map((k) => `${k}: ${why[k]}`).join(' | '),
    hypothesis,
    hardGates: gates,
  };
  if (!scores.manual) delete scores.manual;
  return {
    scores, gates, blocking: gates.blocking, evidenceCount: rel.claims, demand,
    overlaps: dd.matches.filter((m) => m.needsHumanCheck), suggestion: dd.suggestion,
  };
}

/** Secondary score with the external weights, over known components only. */
export function hypothesisScore(g, opp, d, outcomes = []) {
  const intent = neighbors(g, opp.id, 'TARGETS')[0]?.intent;
  // Demand: percentile of measured impressions among all measured pages (only when measured).
  let demand = null;
  if (outcomes.length) {
    const byPage = (os) => os.reduce((m, o) => m.set(o.page, (m.get(o.page) ?? 0) + o.impressions), new Map());
    const all = [...byPage(byType(g, 'outcome')).values()].sort((a, b) => a - b);
    const mine = Math.max(...byPage(outcomes).values());
    demand = all.length ? Math.round((5 * all.filter((x) => x <= mine).length) / all.length) : null;
  }
  const components = {
    need: d.utility,
    differentiation: d.differentiation,
    demand,
    strategic: Math.round((d.fit + d.links) / 2),
    evidence: d.evidence,
    commercial: COMMERCIAL_BY_INTENT[intent] ?? null,
  };
  let sum = 0;
  let weight = 0;
  for (const [k, w] of Object.entries(CALIBRATION_HYPOTHESIS)) {
    if (components[k] === null || components[k] === undefined) continue;
    sum += w * components[k];
    weight += w;
  }
  const unknown = Object.keys(CALIBRATION_HYPOTHESIS).filter((k) => components[k] === null || components[k] === undefined);
  return {
    label: HYPOTHESIS_LABEL,
    score: weight ? Math.round((sum / weight) * 100) / 100 : null, // 0–5 over known weights
    coverage: Math.round(weight * 100) / 100, // share of the weights that are known
    unknown,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, v ?? 'unknown'])),
  };
}

/** Hard gates (CONTRACT §4, §5). Any failure blocks approval whatever the score. */
export function hardGates(opp, dd, { ymyl, reviewer, dupOf }) {
  const blocking = [];
  const evidence = opp.gates?.evidence === true;
  if (!evidence) blocking.push('evidence: no source evidence linked to the opportunity (gates.evidence is false)');
  const reviewerOk = !ymyl || (reviewer && !looksAgent(reviewer));
  if (!reviewerOk) blocking.push('ymyl: no named human reviewer lined up (gates.reviewer); approval is a human transition');
  const duplicateOk = !(dupOf.length && opp.action === 'create');
  if (!duplicateOk) blocking.push(`duplicate: action "create" on ${dupOf.join(', ')}; must be improve or consolidate`);
  const resolved = String(opp.gates?.overlapCheck ?? '').startsWith('resolved');
  const pending = dd.matches.filter((m) => m.needsHumanCheck);
  const overlapOk = resolved || pending.length === 0;
  if (!overlapOk) blocking.push(`overlap: ${pending.map((m) => `${m.id} (${m.score})`).join(', ')} needs a human check (record a Decision, then set gates.overlapCheck)`);
  const pass = (ok) => (ok ? 'pass' : 'fail');
  return { evidence: pass(evidence), ymyl: pass(reviewerOk), duplicate: pass(duplicateOk), overlap: pass(overlapOk), blocking };
}

/**
 * Score every opportunity (or the given ids) as of a date (evidence currency).
 * Returns [{ opp, result }].
 */
export function scoreAll(g = loadGraph(), ids = null, asOf = today()) {
  const inv = buildInventory(g);
  const now = asOf;
  return byType(g, 'opportunity')
    .filter((o) => !ids || ids.includes(o.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((opp) => ({ opp, result: scoreOpportunity(opp, { g, inv, now }) }));
}

// ---------------------------------------------------------------------------
// Write: store scores, move proposed -> scored, record the Run
// ---------------------------------------------------------------------------

function write(rows) {
  const date = today();
  const runId = idFor.run(date, 'gap-scoring');
  const changed = [];
  for (const { opp, result } of rows) {
    if (['rejected', 'retire'].includes(opp.state)) continue;
    const node = { id: opp.id, type: 'opportunity', scores: result.scores, demand: result.demand };
    // Sync-authored rationales say "Not yet scored"; keep the text honest once scored.
    if (opp.rationale?.endsWith('Not yet scored against the PLAYBOOK rubric.')) {
      node.rationale = opp.rationale.replace('Not yet scored against the PLAYBOOK rubric.', 'Scored against the PLAYBOOK rubric by kg:score (see scores.assumptions).');
    }
    if (opp.state === 'proposed') {
      node.state = 'scored';
      node.history = [...(opp.history ?? []), {
        from: 'proposed', to: 'scored', by: AGENT, role: 'lead', date,
        reason: `PLAYBOOK net ${result.scores.net} (penalty ${result.scores.penalty}); demand ${result.demand}`,
      }];
    }
    // Replace the whole scores object (writeNode merges top-level fields only).
    const r = writeNode(node);
    if (r !== 'unchanged') changed.push(opp.id);
    console.log(`${r.padEnd(9)} ${opp.id}`);
  }
  if (changed.length) {
    const prev = get(loadGraph(), runId);
    writeNode({
      id: runId, type: 'run', agent: AGENT, model: 'claude-opus-5-5', started: prev?.started ?? date, finished: date,
      status: 'succeeded', inputs: ['knowledge/nodes/opportunity', 'docs/content-intelligence/inbox', 'src/content'],
      outputs: ['scores on opportunities', 'proposed -> scored transitions'], cost: 'local computation only; no fetches, no searches',
      edges: changed.map((to) => ({ rel: 'PRODUCED', to })),
    });
  }
  console.log(`kg:score  ${changed.length} opportunity node(s) changed  run ${runId}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ids = args.filter((a) => a.startsWith('opp:'));
  const rows = scoreAll(loadGraph(), ids.length ? ids : null);
  if (args.includes('--write')) {
    if (stopped()) { console.log('knowledge/STOP is present: kg:score --write halted.'); process.exit(0); }
    write(rows);
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(rows.map(({ opp, result }) => ({ id: opp.id, ...result })), null, 2));
  } else {
    for (const { opp, result: r } of rows.sort((a, b) => b.result.scores.net - a.result.scores.net || a.opp.id.localeCompare(b.opp.id))) {
      const s = r.scores;
      console.log(`\n${opp.id}  net ${s.net}  (u${s.utility} e${s.evidence} g${s.gap} d${s.differentiation} l${s.links} f${s.fit} -p${s.penalty})  hypothesis ${s.hypothesis.score ?? 'n/a'} [coverage ${s.hypothesis.coverage}]`);
      console.log(`  action ${opp.action}  suggested ${r.suggestion.action}  state ${opp.state}  demand ${r.demand}`);
      console.log(`  gates evidence ${s.hardGates.evidence}  ymyl ${s.hardGates.ymyl}  duplicate ${s.hardGates.duplicate}  overlap ${s.hardGates.overlap}`);
      for (const b of r.blocking) console.log(`  BLOCKED ${b}`);
    }
  }
}
