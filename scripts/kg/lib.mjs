/**
 * lib.mjs — read, validate, write and query the knowledge graph.
 *
 * Storage: one JSON file per node at knowledge/nodes/<type>/<id-safe>.json,
 * edges stored on the source node. Files are written with sorted keys and a
 * 2-space indent so diffs stay small and re-runs are idempotent.
 * knowledge/graph.json is a compiled, gitignored view (buildGraph).
 *
 * Dependency-free ESM. Schema lives in schema.mjs.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPROVED_OR_LATER, COMMON_FIELDS, PREFIX, REJECT_ROLES, RELATIONS, TRANSITIONS, TYPES, TYPE_BY_PREFIX,
} from './schema.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const KG_DIR = join(ROOT, 'knowledge');
export const NODES_DIR = join(KG_DIR, 'nodes');
export const GRAPH_FILE = join(KG_DIR, 'graph.json');
export const STOP_FILE = join(KG_DIR, 'STOP');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** True when knowledge/STOP exists: every automated job must halt. */
export const stopped = () => existsSync(STOP_FILE);

/** Today as YYYY-MM-DD (UTC). */
export const today = () => new Date().toISOString().slice(0, 10);

/** Add days to a YYYY-MM-DD date. */
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const sha1 = (s) => createHash('sha1').update(s).digest('hex');
export const hash12 = (s) => sha1(s).slice(0, 12);

/** Normalize claim text for hashing: lowercase, single spaces, trimmed. */
export const normalizeText = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

export function slugify(s) {
  return String(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Deterministic ID builders. Same input, same ID, every run. */
export const idFor = {
  page: (lang, urlPath) => `page:${lang}/${urlPath.replace(/^\/(de\/)?/, '').replace(/\/$/, '')}`,
  source: (key) => `source:${key}`,
  claim: (text) => `claim:${hash12(normalizeText(text))}`,
  evidence: (url, claimText) => `evidence:${hash12(`${url}\n${normalizeText(claimText)}`)}`,
  observation: (url, observed) => `obs:${hash12(`${url}\n${normalizeText(observed)}`)}`,
  opportunity: (slug) => `opp:${slug}`,
  brief: (fileSlug) => `brief:${fileSlug}`,
  need: (slug) => `need:${slug}`,
  lesson: (slug) => `lesson:${slug}`,
  run: (date, slug) => `run:${date}-${slug}`,
  decision: (date, slug) => `decision:${date}-${slug}`,
  outcome: (pageId, period) => `outcome:${pageId.replace(/^page:/, '')}-${period}`,
  change: (date, hash) => `change:${date}-${hash.slice(0, 12)}`,
  review: (pageId, date, reviewer) => `review:${pageId.replace(/^page:/, '')}-${date}-${slugify(reviewer)}`,
};

/** Node type for an ID, from its prefix (undefined if unknown). */
export const typeOfId = (id) => TYPE_BY_PREFIX[String(id).split(':')[0]];

/** File-name-safe form of an ID (the prefix becomes the folder). */
export function idSafe(id) {
  const rest = String(id).slice(String(id).indexOf(':') + 1);
  return rest.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\//g, '__').replace(/[^A-Za-z0-9._-]/g, '_');
}

export const nodePath = (node) => join(NODES_DIR, node.type, `${idSafe(node.id)}.json`);

/** JSON with recursively sorted object keys, 2-space indent, trailing newline. */
export function stableStringify(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]));
    }
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** Drop undefined, null and empty-string fields (keeps empty arrays and false). */
function clean(node) {
  return Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/** Deduplicate and sort edges by rel, then to. */
export function normalizeEdges(edges = []) {
  const seen = new Map();
  for (const e of edges) {
    if (!e || !e.rel || !e.to) continue;
    const k = `${e.rel}\u0000${e.to}`;
    seen.set(k, { ...seen.get(k), ...clean(e) });
  }
  return [...seen.values()].sort((a, b) => (a.rel + a.to < b.rel + b.to ? -1 : a.rel + a.to > b.rel + b.to ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Load / write
// ---------------------------------------------------------------------------

/** Load every node file. Returns Map<id, node>. Throws on unreadable JSON. */
export function loadNodes(dir = NODES_DIR) {
  const nodes = new Map();
  if (!existsSync(dir)) return nodes;
  for (const type of readdirSync(dir, { withFileTypes: true })) {
    if (!type.isDirectory()) continue;
    for (const f of readdirSync(join(dir, type.name))) {
      if (!f.endsWith('.json')) continue;
      const file = join(dir, type.name, f);
      let node;
      try {
        node = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        throw new Error(`Unreadable node file ${file}: ${e.message}`);
      }
      node.__file = file;
      if (nodes.has(node.id)) throw new Error(`Duplicate node id ${node.id} in ${file}`);
      nodes.set(node.id, node);
    }
  }
  return nodes;
}

/**
 * Write a node, merging with what is on disk.
 *   preserve: existing field values win; new ones only fill gaps (authored nodes)
 *   replaceRels: edges with these rels are replaced by the new set; all other
 *                edges are merged (union), so writes never duplicate or drop edges
 * Returns 'created' | 'updated' | 'unchanged'.
 */
export function writeNode(node, { preserve = false, replaceRels = [] } = {}) {
  if (!node.id || !node.type) throw new Error('writeNode: id and type are required');
  const file = nodePath(node);
  const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  const { __file, ...incoming } = node;

  let merged = clean(incoming);
  if (old) {
    const { edges: oldEdges = [], ...oldFields } = old;
    const fields = preserve ? { ...merged, ...clean(oldFields) } : { ...clean(oldFields), ...merged };
    const kept = oldEdges.filter((e) => !replaceRels.includes(e.rel));
    merged = { ...fields, edges: [...kept, ...(incoming.edges ?? [])] };
  }
  merged.edges = normalizeEdges(merged.edges);

  const text = stableStringify(merged);
  if (old && stableStringify(old) === text) return 'unchanged';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return old ? 'updated' : 'created';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function checkType(v, t) {
  switch (t) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'date': return typeof v === 'string' && DATE.test(v);
    case 'datetime': return typeof v === 'string' && DATETIME.test(v);
    case 'array': return Array.isArray(v);
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    default: return false;
  }
}

/** Validate one node against the schema. Returns a list of error strings. */
export function validateNode(node) {
  const errs = [];
  const at = node?.id ?? '(no id)';
  const spec = TYPES[node?.type];
  if (!spec) return [`${at}: unknown type "${node?.type}"`];
  if (typeOfId(node.id) !== node.type) errs.push(`${at}: id prefix does not match type "${node.type}" (expected "${PREFIX[node.type]}:")`);

  const fields = { ...COMMON_FIELDS, ...spec };
  for (const [k, v] of Object.entries(node)) {
    if (k === '__file') continue;
    const f = fields[k];
    if (!f) { errs.push(`${at}: unknown field "${k}"`); continue; }
    if (!checkType(v, f.t)) errs.push(`${at}: field "${k}" must be ${f.t}`);
    else if (f.enum && !f.enum.includes(v)) errs.push(`${at}: field "${k}" = "${v}" not in [${f.enum.join(', ')}]`);
    else if (f.max && v.length > f.max) errs.push(`${at}: field "${k}" longer than ${f.max} chars`);
  }
  for (const [k, f] of Object.entries(fields)) {
    if (f.req && node[k] === undefined) errs.push(`${at}: missing required field "${k}"`);
  }
  for (const e of node.edges ?? []) {
    if (!e?.rel || !e?.to) errs.push(`${at}: malformed edge ${JSON.stringify(e)}`);
  }
  if (node.__file && node.__file !== nodePath(node)) errs.push(`${at}: stored at ${node.__file}, expected ${nodePath(node)}`);

  // Type-specific invariants that need no other node.
  if (node.type === 'review' && node.result === 'approve' && (node.reviewerKind !== 'human' || node.byKind !== 'human')) {
    errs.push(`${at}: an approving Review must be by a human reviewer and recorded by a human (agents may never approve)`);
  }
  if (node.type === 'opportunity') {
    for (const h of node.history ?? []) {
      const allowed = h.to === 'rejected' ? REJECT_ROLES : TRANSITIONS[h.from]?.[h.to];
      if (!allowed) errs.push(`${at}: illegal transition ${h.from} -> ${h.to}`);
    }
    const last = node.history?.at(-1);
    if (last && last.to !== node.state) errs.push(`${at}: state "${node.state}" does not match last history entry "${last.to}"`);
    if (node.state !== 'proposed' && node.state !== 'rejected' && !node.scores) errs.push(`${at}: state "${node.state}" requires scores`);
  }
  return errs;
}

/** Edge relation check: is rel allowed from this node type to that one? */
export function relationAllowed(rel, fromType, toType) {
  const r = RELATIONS[rel]?.[fromType];
  return r === '*' || (Array.isArray(r) && r.includes(toType));
}

/**
 * Validate the whole graph: node schema, dangling edges, disallowed relations,
 * duplicate edges and illegal states. Returns { errors: string[] } — every
 * entry is structural and should fail CI.
 */
export function validateGraph(nodes) {
  const errors = [];
  for (const node of nodes.values()) {
    errors.push(...validateNode(node));
    const seen = new Set();
    for (const e of node.edges ?? []) {
      const key = `${e.rel} ${e.to}`;
      if (seen.has(key)) errors.push(`${node.id}: duplicate edge ${key}`);
      seen.add(key);
      const target = nodes.get(e.to);
      if (!target) { errors.push(`${node.id}: dangling edge ${e.rel} -> ${e.to}`); continue; }
      if (!RELATIONS[e.rel]) errors.push(`${node.id}: unknown relation ${e.rel}`);
      else if (!relationAllowed(e.rel, node.type, target.type)) errors.push(`${node.id}: relation ${node.type} -${e.rel}-> ${target.type} is not allowed`);
    }
  }

  // Illegal state: a YMYL opportunity cannot be released without a human
  // approving Review of the page that implements it.
  const g = indexGraph(nodes);
  for (const opp of byType(g, 'opportunity')) {
    if (!['released', 'measured', 'improve', 'consolidate', 'retire'].includes(opp.state) || !opp.gates?.ymyl) continue;
    const pages = neighbors(g, opp.id, 'IMPLEMENTS', 'in');
    const approved = pages.some((p) => neighbors(g, p.id, 'OF', 'in').some((rv) => rv.result === 'approve' && rv.reviewerKind === 'human'));
    if (!approved) errors.push(`${opp.id}: YMYL opportunity in state "${opp.state}" has no human approving Review of an implementing page`);
  }
  // Hard gates are enforced once an opportunity is approved.
  for (const opp of byType(g, 'opportunity')) {
    if (!APPROVED_OR_LATER.includes(opp.state)) continue;
    if (opp.gates?.duplicateOf?.length && opp.action === 'create') errors.push(`${opp.id}: duplicates ${opp.gates.duplicateOf.join(', ')}; action must be improve or consolidate, not create`);
  }
  return { errors };
}

// ---------------------------------------------------------------------------
// Graph view and queries
// ---------------------------------------------------------------------------

/** Build an in-memory index { nodes, out, in } from a node map. */
export function indexGraph(nodes) {
  const out = new Map();
  const inn = new Map();
  for (const n of nodes.values()) {
    out.set(n.id, n.edges ?? []);
    for (const e of n.edges ?? []) {
      if (!inn.has(e.to)) inn.set(e.to, []);
      inn.get(e.to).push({ rel: e.rel, from: n.id });
    }
  }
  return { nodes, out, in: inn };
}

/** Load nodes from disk and index them. */
export const loadGraph = (dir = NODES_DIR) => indexGraph(loadNodes(dir));

/** Write knowledge/graph.json: nodes (without file paths) plus adjacency lists. */
export function buildGraph(nodes = loadNodes(), file = GRAPH_FILE) {
  const g = indexGraph(nodes);
  const ids = [...nodes.keys()].sort();
  const out = {
    generated: new Date().toISOString(),
    counts: countByType(nodes),
    nodes: Object.fromEntries(ids.map((id) => { const { __file, ...n } = nodes.get(id); return [id, n]; })),
    adjacency: Object.fromEntries(ids.map((id) => [id, {
      out: (g.out.get(id) ?? []).map(({ rel, to }) => ({ rel, to })),
      in: (g.in.get(id) ?? []).slice().sort((a, b) => (a.rel + a.from).localeCompare(b.rel + b.from)),
    }])),
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

export function countByType(nodes) {
  const c = {};
  for (const n of nodes.values()) c[n.type] = (c[n.type] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort());
}

/** All nodes of a type. */
export const byType = (g, type) => [...g.nodes.values()].filter((n) => n.type === type);

/** One node by id (undefined if missing). */
export const get = (g, id) => g.nodes.get(id);

/**
 * Neighbouring nodes. direction: 'out' (edges on this node), 'in' (edges
 * pointing here) or 'both'. rel filters by relation when given.
 */
export function neighbors(g, id, rel, direction = 'out') {
  const res = [];
  if (direction !== 'in') for (const e of g.out.get(id) ?? []) if (!rel || e.rel === rel) res.push(g.nodes.get(e.to));
  if (direction !== 'out') for (const e of g.in.get(id) ?? []) if (!rel || e.rel === rel) res.push(g.nodes.get(e.from));
  return res.filter(Boolean);
}

/** Case-insensitive full-text search over every string field of every node. */
export function search(g, text) {
  const q = normalizeText(text);
  return [...g.nodes.values()].filter((n) => {
    const { __file, edges, ...fields } = n;
    return normalizeText(JSON.stringify(fields)).includes(q);
  });
}
