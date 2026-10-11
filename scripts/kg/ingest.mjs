/**
 * ingest.mjs — turn a researcher's findings bundle into graph nodes (npm run kg:ingest -- <bundle.json>).
 *
 * Research agents are read-only: they return a findings bundle (format in
 * .claude/content-intelligence/BRIEF-TEMPLATE.md) and the lead saves it to
 * docs/content-intelligence/bundles/<date>-<category>.json. This script:
 *
 *   1. validates the bundle (exit 1 on any error, nothing written);
 *   2. writes Need, Claim, Evidence and Observation nodes with deterministic IDs;
 *   3. routes every opportunity proposal through propose() (dedupe first);
 *   4. links proposals to their claims (CITES) and needs (TARGETS);
 *   5. writes one Run node with PRODUCED edges to everything above.
 *
 * Observations and claims stay separate: an observation (competitor, SERP,
 * format) is never evidence for a claim, and competitor URLs are rejected as
 * evidence. Re-ingesting the same bundle produces no diff.
 *
 * Usage: npm run kg:ingest -- <bundle.json> [--dry-run] [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, forcedYmyl, get, idFor, loadGraph, ROOT, slugify, stopped, today, writeNode } from './lib.mjs';
import { INTENTS, LANGS, TYPES } from './schema.mjs';

export const FORMAT = 'e-bambino-findings/1';
const HUBS = ['clothing', 'on-the-go', 'diapering', 'feeding', 'bath-and-care', 'breastfeeding', 'nursery', 'play', 'safety'];
const MAX_CLAIMS = 50; // CONTRACT §10: at most 50 new claims per run
const MAX_OBSERVED = 500;
const enumOf = (type, field) => TYPES[type][field].enum;
const RANK = { low: 0, medium: 1, high: 2 };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+$/.test(v);
const isRef = (v) => typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v);
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

/**
 * Validate a bundle against the format and the graph. Returns { errors, warnings }.
 * References are bundle refs ("c1") or IDs of existing nodes ("claim:…", "opp:…").
 */
export function validateBundle(b, g) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { errors: ['bundle must be a JSON object'], warnings };
  if (b.format !== FORMAT) err(`format must be "${FORMAT}"`);
  for (const k of ['label', 'category', 'agent']) if (typeof b[k] !== 'string' || !b[k].trim()) err(`${k} is required`);
  if (!isDate(b.date)) err('date must be YYYY-MM-DD');
  else if (b.date > today()) err(`date ${b.date} is in the future`);
  if (b.lang !== undefined && !LANGS.includes(b.lang)) err(`lang must be one of ${LANGS.join(', ')}`);
  if (b.category && !HUBS.includes(b.category)) warnings.push(`category "${b.category}" is not an English hub slug (${HUBS.join(', ')})`);
  if (!Array.isArray(b.inventoryQueries) || !b.inventoryQueries.length || !b.inventoryQueries.every((q) => typeof q === 'string' && q.trim())) {
    err('inventoryQueries must list the graph queries run before proposing (lesson:check-inventory-first)');
  }
  const sections = ['observations', 'claims', 'evidence', 'needs', 'proposals'];
  const bad = sections.filter((s) => b[s] !== undefined && !Array.isArray(b[s]));
  if (bad.length) return { errors: [...errors, ...bad.map((s) => `${s} must be an array`)], warnings };

  // Refs are unique across the whole bundle.
  const refs = new Map(); // ref -> section
  for (const s of sections) {
    for (const [i, item] of (b[s] ?? []).entries()) {
      if (!isRef(item?.ref)) { err(`${s}[${i}]: ref must match [a-z][a-z0-9-]*`); continue; }
      if (refs.has(item.ref)) err(`${s}[${i}]: duplicate ref "${item.ref}"`);
      refs.set(item.ref, s);
    }
  }
  // A link must point at a ref in the right section, or at an existing node of the right type.
  const link = (where, value, allowed) => {
    if (refs.has(value)) {
      if (!allowed.sections.includes(refs.get(value))) err(`${where}: "${value}" is a ${refs.get(value)} ref; expected ${allowed.sections.join(' or ')}`);
      return;
    }
    const node = String(value).includes(':') ? get(g, value) : null;
    if (!node) err(`${where}: unknown ref or node "${value}"`);
    else if (!allowed.types.includes(node.type)) err(`${where}: ${value} is a ${node.type}; expected ${allowed.types.join(' or ')}`);
  };
  const list = (where, v) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) { err(`${where} must be an array`); return []; }
    return v;
  };

  const obsUrls = new Set();
  for (const [i, o] of (b.observations ?? []).entries()) {
    const at = `observations[${i}] (${o.ref})`;
    if (!isUrl(o.url)) err(`${at}: url must be http(s)`);
    if (!isDate(o.accessed) || o.accessed > today()) err(`${at}: accessed must be a past YYYY-MM-DD date`);
    if (!enumOf('observation', 'kind').includes(o.kind)) err(`${at}: kind must be one of ${enumOf('observation', 'kind').join(', ')}`);
    if (typeof o.observed !== 'string' || !o.observed.trim()) err(`${at}: observed is required`);
    else if (o.observed.length > MAX_OBSERVED) err(`${at}: observed is longer than ${MAX_OBSERVED} chars (summarize; never copy page text)`);
    for (const a of list(`${at}.about`, o.about)) link(`${at}.about`, a, { sections: ['needs', 'proposals'], types: ['need', 'opportunity'] });
    if (isUrl(o.url)) obsUrls.add(o.url);
  }

  const claims = b.claims ?? [];
  if (claims.length > MAX_CLAIMS) err(`${claims.length} claims; at most ${MAX_CLAIMS} per run (split the bundle)`);
  for (const [i, c] of claims.entries()) {
    const at = `claims[${i}] (${c.ref})`;
    if (typeof c.text !== 'string' || !c.text.trim()) err(`${at}: text is required`);
    if (!enumOf('claim', 'kind').includes(c.kind)) err(`${at}: kind must be one of ${enumOf('claim', 'kind').join(', ')}`);
    if (typeof c.ymyl !== 'boolean') err(`${at}: ymyl must be true or false`);
    if (c.confidence !== undefined && !(c.confidence in RANK)) err(`${at}: confidence must be high, medium or low`);
  }

  const supported = new Set();
  for (const [i, e] of (b.evidence ?? []).entries()) {
    const at = `evidence[${i}] (${e.ref})`;
    if (!isUrl(e.url)) err(`${at}: url must be http(s)`);
    if (!isDate(e.accessed) || e.accessed > today()) err(`${at}: accessed must be a past YYYY-MM-DD date`);
    if (!enumOf('evidence', 'retrievalMethod').includes(e.retrievalMethod)) err(`${at}: retrievalMethod must be one of ${enumOf('evidence', 'retrievalMethod').join(', ')}`);
    if (!enumOf('evidence', 'sourceQuality').includes(e.sourceQuality)) err(`${at}: sourceQuality must be one of ${enumOf('evidence', 'sourceQuality').join(', ')}`);
    if (e.sourceQuality === 'competitor') err(`${at}: a competitor page is an observation, never evidence; move it to observations`);
    if (typeof e.quote !== 'string' || !e.quote.trim()) err(`${at}: quote is required (the exact words that support the claim)`);
    else if (e.quote.length > 300) err(`${at}: quote is ${e.quote.length} chars; at most 300`);
    if (obsUrls.has(e.url)) err(`${at}: ${e.url} is also an observation; an observation is never evidence for a claim`);
    if (e.sourceKey !== undefined && !get(g, idFor.source(e.sourceKey))) warnings.push(`${at}: sourceKey "${e.sourceKey}" has no Source node (register it in src/lib/sources.ts first)`);
    const sup = list(`${at}.supports`, e.supports);
    const con = list(`${at}.contradicts`, e.contradicts);
    if (!sup.length && !con.length) err(`${at}: must support or contradict at least one claim`);
    for (const c of [...sup, ...con]) link(`${at}`, c, { sections: ['claims'], types: ['claim'] });
    for (const c of sup) supported.add(c);
  }
  for (const c of claims) {
    if (c.kind === 'fact' && !supported.has(c.ref)) warnings.push(`claim ${c.ref}: fact without supporting evidence; stored as unsupported`);
  }

  for (const [i, n] of (b.needs ?? []).entries()) {
    const at = `needs[${i}] (${n.ref})`;
    if (typeof n.question !== 'string' || !n.question.trim()) err(`${at}: question is required`);
    if (!INTENTS.includes(n.intent)) err(`${at}: intent must be one of ${INTENTS.join(', ')}`);
    if (n.lang !== undefined && !LANGS.includes(n.lang)) err(`${at}: lang must be one of ${LANGS.join(', ')}`);
  }

  for (const [i, p] of (b.proposals ?? []).entries()) {
    const at = `proposals[${i}] (${p.ref})`;
    if (typeof p.title !== 'string' || !p.title.trim()) err(`${at}: title is required`);
    if (typeof p.rationale !== 'string' || !p.rationale.trim()) err(`${at}: rationale is required`);
    if (typeof p.ymyl !== 'boolean') err(`${at}: ymyl must be true or false`);
    if (p.action !== undefined && !enumOf('opportunity', 'action').includes(p.action)) err(`${at}: action must be one of ${enumOf('opportunity', 'action').join(', ')}`);
    if (p.priority !== undefined && !enumOf('opportunity', 'priority').includes(p.priority)) err(`${at}: priority must be one of P0..P3`);
    if (p.intent !== undefined && !INTENTS.includes(p.intent)) err(`${at}: intent must be one of ${INTENTS.join(', ')}`);
    if (p.slug !== undefined && p.slug !== slugify(p.slug)) err(`${at}: slug must be lowercase-hyphenated`);
    if (p.brief !== undefined && get(g, p.brief)?.type !== 'brief') err(`${at}: brief "${p.brief}" is not a brief node`);
    for (const c of list(`${at}.claims`, p.claims)) link(`${at}.claims`, c, { sections: ['claims'], types: ['claim'] });
    for (const n of list(`${at}.needs`, p.needs)) link(`${at}.needs`, n, { sections: ['needs'], types: ['need'] });
    if (!list(`${at}.claims`, p.claims).length) warnings.push(`${at}: no claims cited; the evidence gate cannot pass`);
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD plus whole months (day clamped to the target month). */
function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Source key for an evidence URL: given, or the Source node whose URL host matches. */
function sourceKeyFor(e, sources) {
  if (e.sourceKey) return e.sourceKey;
  const host = hostOf(e.url);
  return sources.find((s) => s.url && (host === hostOf(s.url) || host.endsWith(`.${hostOf(s.url)}`)))?.key;
}

/**
 * Confidence the evidence can carry. Snippet-only evidence never yields high
 * (lesson:snippets-weak-for-ymyl); hypotheses stay low.
 */
function derivedConfidence(kind, evidence) {
  if (kind === 'hypothesis') return 'low';
  let best = 'low';
  for (const ev of evidence) {
    const primary = ev.sourceQuality === 'primary-authority';
    const snippet = ev.retrievalMethod === 'search-snippet';
    const c = primary && !snippet ? 'high' : primary || (!snippet && ev.sourceQuality === 'secondary') ? 'medium' : 'low';
    if (RANK[c] > RANK[best]) best = c;
  }
  return best;
}

/** propose() from the parallel builder, or null when propose.mjs is not there. */
async function loadPropose() {
  try {
    return (await import('./propose.mjs')).propose;
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes('propose.mjs')) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

/**
 * Ingest a parsed bundle. Returns { runId, writes: [[id, result]], warnings }.
 * With dryRun nothing is written and writes list the planned IDs.
 */
export async function ingest(b, { path = 'bundle', dryRun = false } = {}) {
  let g = loadGraph();
  const { errors, warnings } = validateBundle(b, g);
  if (errors.length) return { errors, warnings, writes: [] };

  const writes = [];
  const produced = new Set();
  const write = (node, opts) => {
    produced.add(node.id);
    writes.push([node.id, dryRun ? 'planned' : writeNode(node, opts)]);
  };
  const lang = b.lang ?? 'en';
  const sources = [...g.nodes.values()].filter((n) => n.type === 'source');
  const refId = new Map(); // bundle ref -> node id (claims, needs, proposals)

  // Needs: authored once, then preserved.
  for (const n of b.needs ?? []) {
    const id = idFor.need(slugify(n.slug ?? n.question));
    refId.set(n.ref, id);
    write({ id, type: 'need', question: n.question.trim(), intent: n.intent, audience: n.audience ?? 'expecting and new parents', lang: n.lang ?? lang, edges: [] }, { preserve: true });
  }

  // Claims and evidence. Evidence IDs hash url + claim text, so one bundle
  // entry that supports two claims becomes two Evidence nodes.
  // YMYL by declaration: a bundle may raise ymyl but never keep it false for a
  // YMYL hub or a sleep/car-seat/medicine/fever/formula/allergy topic.
  const claimText = new Map();
  for (const c of b.claims ?? []) {
    refId.set(c.ref, idFor.claim(c.text));
    claimText.set(refId.get(c.ref), { ...c, ymyl: c.ymyl || forcedYmyl(b.category, c.text) });
  }
  const resolveClaim = (r) => refId.get(r) ?? r;
  const textOf = (id) => claimText.get(id)?.text ?? get(g, id).text;
  const ymylOf = (id) => claimText.get(id)?.ymyl || get(g, id)?.ymyl === true;

  const newEvidence = new Map(); // evidence id -> node
  const claimEdges = new Map(); // claim id -> edges
  for (const e of b.evidence ?? []) {
    const key = sourceKeyFor(e, sources);
    for (const [rel, list] of [['SUPPORTED_BY', e.supports ?? []], ['CONTRADICTED_BY', e.contradicts ?? []]]) {
      for (const r of list) {
        const cid = resolveClaim(r);
        const eid = idFor.evidence(e.url, textOf(cid));
        newEvidence.set(eid, {
          id: eid, type: 'evidence', url: e.url, sourceKey: key, accessed: e.accessed,
          retrievalMethod: e.retrievalMethod, quote: e.quote.trim(), sourceQuality: e.sourceQuality,
          revalidateBy: addMonths(e.accessed, ymylOf(cid) ? 3 : 6), topics: [b.category],
          edges: key && get(g, idFor.source(key)) ? [{ rel: 'FROM', to: idFor.source(key) }] : [],
        });
        if (!claimEdges.has(cid)) claimEdges.set(cid, []);
        claimEdges.get(cid).push({ rel, to: eid });
      }
    }
  }
  for (const ev of newEvidence.values()) {
    const old = get(g, ev.id);
    if (!old) { write(ev); continue; }
    // Same URL and claim already on file (e.g. from kg:sync): keep its fields
    // and only fill a missing quote, noting when that quote was retrieved.
    if (old.quote && old.quote !== ev.quote) warnings.push(`${ev.id}: already has a different quote; kept the one on file`);
    const fill = old.quote ? {} : { quote: ev.quote, notes: `quote added from a ${ev.retrievalMethod} accessed ${ev.accessed} (bundle "${b.label}")` };
    write({ id: ev.id, type: 'evidence', ...fill, edges: ev.edges }, { preserve: true });
  }

  // Claim status and confidence come from every evidence edge the claim has
  // after this ingest (old and new), so a re-run computes the same values.
  const evidenceNode = (id) => newEvidence.get(id) ?? get(g, id);
  for (const cid of new Set([...claimText.keys(), ...claimEdges.keys()])) {
    const old = get(g, cid);
    const c = claimText.get(cid);
    const edges = [...(old?.edges ?? []), ...(claimEdges.get(cid) ?? [])];
    const sup = edges.filter((x) => x.rel === 'SUPPORTED_BY').map((x) => evidenceNode(x.to)).filter(Boolean);
    const contested = edges.some((x) => x.rel === 'CONTRADICTED_BY');
    const kind = c?.kind ?? old.kind;
    const status = contested ? 'contested' : sup.length ? 'supported' : old?.status ?? 'unsupported';
    let confidence = derivedConfidence(kind, sup);
    if (c?.confidence && RANK[c.confidence] < RANK[confidence]) confidence = c.confidence; // a bundle may only lower it
    write({
      id: cid, type: 'claim', text: c?.text.trim() ?? old.text, kind, ymyl: !!(c?.ymyl || old?.ymyl), confidence, status,
      // Claims the bundle only links to keep their topics, so kg:sync and ingest never fight over them.
      topics: c ? [...new Set([...(old?.topics ?? []), b.category])].sort() : old.topics, edges: claimEdges.get(cid) ?? [],
    });
  }

  // Proposals: dedupe first via propose(); fallback creates a plain proposed opportunity.
  const propose = dryRun ? null : await loadPropose();
  if (!propose) warnings.push(dryRun ? 'dry run: propose() not called' : 'scripts/kg/propose.mjs not found: proposals created in state proposed WITHOUT dedupe; run kg:propose --refresh on them once it exists');
  if (!dryRun) g = loadGraph(); // propose and the gate check below see the claims just written
  for (const p of b.proposals ?? []) {
    const slug = p.slug ?? slugify(p.title);
    const id = idFor.opportunity(slug);
    const claimIds = (p.claims ?? []).map(resolveClaim);
    const evidenceIds = claimIds.flatMap((cid) => (claimEdges.get(cid) ?? []).filter((x) => x.rel === 'SUPPORTED_BY').map((x) => x.to));
    const question = p.question ?? (p.needs ?? []).map((r) => (b.needs ?? []).find((n) => n.ref === r)?.question).find(Boolean);
    const ymyl = p.ymyl || forcedYmyl(b.category, p.title, p.rationale, question);
    refId.set(p.ref, id);
    if (propose) {
      const r = await propose({
        title: p.title, question, category: b.category, lang, intent: p.intent ?? 'unknown', rationale: p.rationale, evidenceIds,
        slug, ymyl, priority: p.priority, action: p.action,
      });
      const action = r.action ?? (r.created ? 'created' : 'updated');
      const matches = r.matches ?? r.dedupe?.matches ?? [];
      console.log(`propose  ${r.id}  ${action}  ${matches.length} dedupe match(es)`);
      if (r.id !== id) warnings.push(`propose returned ${r.id}, expected ${id}`);
      produced.add(r.id);
    } else if (!dryRun && !get(g, id)) {
      write({
        id, type: 'opportunity', title: p.title.trim(), category: b.category, action: p.action ?? 'create', state: 'proposed',
        priority: p.priority, demand: 'unknown', gates: { evidence: false, ymyl, duplicateOf: [] },
        rationale: p.rationale.trim(), owner: 'content-intelligence-lead', reviewBy: addDays(b.date, 90),
        notes: 'Created by kg:ingest without dedupe (propose.mjs missing). Run kg:propose --refresh on it before scoring.', edges: [],
      }, { preserve: true });
    } else if (dryRun) {
      writes.push([id, 'planned']);
    }
    // Links the proposal rests on. Only edges are added; propose owns the fields.
    const edges = [
      ...claimIds.map((to) => ({ rel: 'CITES', to })),
      ...(p.needs ?? []).map((r) => ({ rel: 'TARGETS', to: refId.get(r) ?? r })),
    ];
    if (edges.length && !dryRun) write({ id, type: 'opportunity', edges });
    // The brief is an input, not a product of this run: link it without a PRODUCED edge.
    if (p.brief && !dryRun) writes.push([p.brief, writeNode({ id: p.brief, type: 'brief', edges: [{ rel: 'SPECIFIES', to: id }] }, { preserve: true })]);
  }

  // Evidence gate: set gates.evidence (never unset it) when a cited claim is
  // supported by primary-authority evidence; YMYL needs more than a snippet.
  if (!dryRun) {
    g = loadGraph();
    for (const p of b.proposals ?? []) {
      const opp = get(g, refId.get(p.ref));
      if (!opp || opp.gates?.evidence === true) continue;
      const ymyl = opp.gates?.ymyl === true;
      const ok = (opp.edges ?? []).filter((x) => x.rel === 'CITES').map((x) => get(g, x.to)).some((c) => c?.status === 'supported'
        && (g.out.get(c.id) ?? []).filter((x) => x.rel === 'SUPPORTED_BY').map((x) => get(g, x.to))
          .some((ev) => ev?.sourceQuality === 'primary-authority' && !((ymyl || c.ymyl) && ev.retrievalMethod === 'search-snippet')));
      if (ok) write({ ...opp, gates: { ...opp.gates, evidence: true } });
      else if (ymyl || (p.claims ?? []).length) warnings.push(`${opp.id}: evidence gate stays false (no cited claim supported by primary-authority evidence${ymyl ? '; YMYL also needs more than a search snippet' : ''})`);
    }
  }

  // Observations: what competitors and SERPs show. ABOUT needs or opportunities only.
  for (const o of b.observations ?? []) {
    write({
      id: idFor.observation(o.url, o.observed), type: 'observation', url: o.url, accessed: o.accessed, observed: o.observed.trim(), kind: o.kind,
      edges: (o.about ?? []).map((r) => ({ rel: 'ABOUT', to: refId.get(r) ?? r })),
    });
  }

  // One Run node for the research run that produced the bundle.
  const runId = idFor.run(b.date, slugify(`${b.label}-${b.category}`));
  const count = (s) => `${(b[s] ?? []).length} ${s}`;
  write({
    id: runId, type: 'run', agent: b.agent, model: b.model ?? 'unrecorded',
    started: b.started ?? b.date, finished: b.finished ?? b.date, status: 'succeeded',
    inputs: [path, ...b.inventoryQueries], outputs: ['observations', 'claims', 'evidence', 'needs', 'proposals'].map(count),
    cost: b.cost ?? 'not recorded', notes: `Findings bundle "${b.label}", ingested with npm run kg:ingest.`,
    edges: [...produced].filter((id) => id !== runId).map((to) => ({ rel: 'PRODUCED', to })),
  });
  return { errors: [], warnings, writes, runId };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  if (!file) {
    console.log('usage: npm run kg:ingest -- <bundle.json> [--dry-run] [--json]');
    process.exit(1);
  }
  if (!dryRun && stopped()) {
    console.log('knowledge/STOP is present: kg:ingest halted.');
    process.exit(0);
  }
  const abs = resolve(process.cwd(), file);
  if (!existsSync(abs)) { console.log(`not found: ${file}`); process.exit(1); }
  let bundle;
  try { bundle = JSON.parse(readFileSync(abs, 'utf8')); } catch (e) { console.log(`invalid JSON in ${file}: ${e.message}`); process.exit(1); }
  const path = relative(ROOT, abs);
  if (!path.startsWith('docs/content-intelligence/bundles/')) console.log(`note: bundles belong in docs/content-intelligence/bundles/ (got ${path})`);

  const r = await ingest(bundle, { path, dryRun });
  if (args.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    for (const e of r.errors) console.log(`ERROR ${e}`);
    for (const w of r.warnings) console.log(`WARN  ${w}`);
    const tally = {};
    for (const [, res] of r.writes) tally[res] = (tally[res] ?? 0) + 1;
    for (const [id, res] of r.writes) if (res !== 'unchanged') console.log(`${res.padEnd(9)} ${id}`);
    console.log(`\nkg:ingest  ${path}  ${r.errors.length} error(s)  ${r.warnings.length} warning(s)  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join('  ') || 'no writes'}`);
  }
  process.exit(r.errors.length ? 1 : 0);
}
