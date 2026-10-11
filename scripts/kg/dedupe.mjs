/**
 * dedupe.mjs — content inventory and gap matching (npm run kg:dedupe).
 *
 * Ranks existing Pages (published, held, draft), Briefs and other
 * Opportunities by overlap with an Opportunity or a free-text title/question,
 * and suggests an action: create, improve, consolidate, redirect, monitor or
 * reject. Similarity never decides alone: every match at or above
 * CHECK_THRESHOLD is marked "needs human check".
 *
 * Similarity = lexical (TF-IDF cosine over unigrams + bigrams on the topic
 * fields and on all fields, plus word-bigram Jaccard) over title, question,
 * slug/URL and headings, then scaled by metadata (same hub/category, language,
 * intent, format). Thresholds were set against the three known duplicate
 * incidents (docs/system/EVALUATION.md); treat scores as a ranking, not a verdict.
 *
 * Usage:
 *   npm run kg:dedupe -- "<text>" [--hub x] [--lang en] [--intent x] [--top 8] [--json]
 *   npm run kg:dedupe -- opp:<slug>          match an existing opportunity
 *   npm run kg:dedupe -- page:en/<hub>/<slug> match an existing page (consolidate or monitor)
 *   npm run kg:dedupe -- --all               every opportunity in the graph
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { byType, get, loadGraph, neighbors, ROOT, slugify } from './lib.mjs';

export const CHECK_THRESHOLD = 0.3; // at or above: overlap, needs human check
export const HIGH_THRESHOLD = 0.45; // at or above: likely the same topic

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(`
a an the and or but if of to in on at by for from with without into onto over under about as is are was were be been
being do does did doing have has had can could should would will may might must shall i you your yours we our it its
this that these those there here what which who whom whose when where why how more most some any all each
every no not only own same so than too very just also up down out off again further then once first new vs versus per
get getting need needs use using one two
der die das den dem des ein eine einen einem einer und oder aber wenn von zu im in am an auf mit ohne fur für ist sind
war waren sein wie was wer wann wo warum welche welcher welches ich sie du wir es ihr ihre ihren nicht nur auch ab bis
`.trim().split(/\s+/));

/** Light stemmer: plural and verb endings for English, a few German ones. */
export function stem(t) {
  if (t.length <= 3 || /^\d+$/.test(t)) return t;
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith('sses')) return t.slice(0, -2);
  if (t.endsWith('ing') && t.length > 5) return t.slice(0, -3);
  if (t.endsWith('ed') && t.length > 4) return t.slice(0, -2);
  if (t.endsWith('es') && /(ch|sh|x|ss)es$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
  if (/(en|er|e|n)$/.test(t) && t.length > 5 && /[äöüß]/.test(t)) return t.replace(/(en|er|e|n)$/, '');
  return t;
}

/** Canonical forms for a few near-synonyms (applied after stemming). */
const SYNONYMS = {
  buy: 'choose', pick: 'choose', select: 'choose', purchase: 'choose',
  clothing: 'clothe', wardrobe: 'clothe', outfit: 'clothe', garment: 'clothe', layette: 'clothe',
  installation: 'install', childproof: 'babyproof', infant: 'baby',
  pram: 'stroller', buggy: 'stroller', pushchair: 'stroller', nappy: 'diaper', nappie: 'diaper',
};

/** Normalized, stopword-free, stemmed tokens. */
export function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? SYNONYMS[stem(t)] ?? stem(t)); // "clothing" must not become "cloth" (diapers)
}

const bigrams = (toks) => toks.slice(1).map((t, i) => `${toks[i]}_${t}`);

// ---------------------------------------------------------------------------
// Inventory: one document per candidate node
// ---------------------------------------------------------------------------

/** Frontmatter scalars + H2/H3 headings of a content file (flat YAML only). */
function readContent(file) {
  const txt = readFileSync(file, 'utf8');
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const fm = {};
  for (const line of (m?.[1] ?? '').split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]\w*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  const headings = [...(m?.[2] ?? txt).matchAll(/^#{2,3}\s+(.+)$/gm)].map((h) => h[1].trim());
  // Buying guides keep their structure in nested YAML (criteria, types).
  for (const n of (m?.[1] ?? '').matchAll(/^\s+- name:\s*["']?([^"'\n]+)/gm)) headings.push(n[1].trim());
  return { fm, headings };
}

/** Map `${collection}/${lang}/${slug}` -> { fm, headings } for every content file. */
function contentIndex() {
  const idx = new Map();
  const dir = join(ROOT, 'src/content');
  if (!existsSync(dir)) return idx;
  for (const collection of readdirSync(dir).filter((d) => !d.includes('.'))) {
    for (const lang of ['en', 'de']) {
      const sub = join(dir, collection, lang);
      if (!existsSync(sub)) continue;
      for (const f of readdirSync(sub).filter((x) => x.endsWith('.md'))) {
        const c = readContent(join(sub, f));
        const slug = (collection === 'fragen' && c.fm.slug) || basename(f, '.md');
        idx.set(`${collection}/${lang}/${slug}`, c);
      }
    }
  }
  return idx;
}

/** Title, H1 and question-form outline lines of a brief file. */
function readBrief(path) {
  const file = join(ROOT, path);
  if (!existsSync(file)) return { headings: [] };
  const txt = readFileSync(file, 'utf8');
  const h1 = txt.match(/^\*\*H1:\*\*\s*(.+)$/m)?.[1].trim();
  const pageTitle = txt.match(/^\*\*Title:\*\*\s*(.+)$/m)?.[1].trim();
  const questions = [...txt.matchAll(/^-\s+(.+\?)\s*$/gm)].map((q) => q[1].trim());
  return { h1, headings: [pageTitle, ...questions].filter(Boolean) };
}

const slugWords = (id) => String(id).split(/[:/]/).at(-1).replace(/-/g, ' ');

/** Page format a title asks for, in collection terms (question page when nothing else fits). */
export function formatOf(title = '') {
  const t = title.toLowerCase();
  if (/buying guide|how to choose|choosing|kaufberatung/.test(t)) return 'kaufberatung';
  if (/checklist|checkliste/.test(t)) return 'checklisten';
  if (/planner|calculator|worksheet|tool|rechner/.test(t)) return 'tool';
  if (/\bguide\b|ratgeber/.test(t)) return 'ratgeber';
  return 'fragen';
}

/**
 * Build the candidate inventory from the graph. Each doc carries weighted
 * fields (title and question count double) and metadata for scaling.
 */
export function buildInventory(g) {
  const content = contentIndex();
  const docs = [];
  for (const p of byType(g, 'page')) {
    // Removed pages stay in the inventory (title and URL only) so a match can suggest a redirect.
    const c = content.get(`${p.collection}/${p.lang}/${p.slug}`) ?? { fm: {}, headings: [] };
    docs.push({
      id: p.id, kind: 'page', status: p.status, lang: p.lang, hub: p.hub ?? '', intent: c.fm.intention ?? 'unknown',
      format: p.collection, title: p.title, url: p.url,
      fields: { title: p.title, question: c.fm.frage ?? '', slug: p.url.replace(/[/-]+/g, ' ').trim(), headings: c.headings.join(' . ') },
    });
  }
  for (const o of byType(g, 'opportunity')) {
    const q = queryForOpportunity(g, o);
    docs.push({ id: o.id, kind: 'opportunity', status: o.state, lang: q.lang, hub: q.hub ?? '', intent: q.intent, format: q.format, title: o.title, fields: q.fields });
  }
  for (const b of byType(g, 'brief')) {
    const br = readBrief(b.path);
    docs.push({
      id: b.id, kind: 'brief', status: b.status, lang: 'en', hub: b.category ?? '', intent: 'unknown', format: formatOf(b.title), title: b.title ?? b.id,
      specifies: neighbors(g, b.id, 'SPECIFIES').map((n) => n.id),
      fields: { title: b.title ?? '', question: br.h1 ?? '', slug: slugWords(b.id).replace(/^\d{4} \d{2} \d{2} /, ''), headings: br.headings.join(' . ') },
    });
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Vectors and similarity
// ---------------------------------------------------------------------------

const FIELD_WEIGHT = { title: 2, question: 2, slug: 1, headings: 1 };
const TOPIC_FIELDS = ['title', 'question', 'slug'];

/** Term-frequency map over weighted fields (unigrams + bigrams). */
function termFreq(fields, keys = Object.keys(fields)) {
  const tf = new Map();
  for (const f of keys) {
    for (const sentence of String(fields[f] ?? '').split(/\s\.\s/)) {
      const toks = tokens(sentence);
      for (const t of [...toks, ...bigrams(toks)]) tf.set(t, (tf.get(t) ?? 0) + (FIELD_WEIGHT[f] ?? 1));
    }
  }
  return tf;
}

/** Word-bigram set over the topic-defining fields. */
function bigramSet(fields) {
  const set = new Set();
  for (const f of TOPIC_FIELDS) for (const b of bigrams(tokens(fields[f]))) set.add(b);
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function cosine(a, b) {
  let dot = 0;
  for (const [t, w] of a) if (b.has(t)) dot += w * b.get(t);
  const norm = (v) => Math.sqrt([...v.values()].reduce((s, w) => s + w * w, 0));
  const d = norm(a) * norm(b);
  return d ? dot / d : 0;
}

/** Lexical blend: topic fields weigh most; headings add context; bigram Jaccard rewards shared phrases. */
export const LEXICAL_WEIGHTS = { topicCosine: 0.5, fullCosine: 0.25, bigramJaccard: 0.25 };

/** Metadata multipliers applied to the lexical score. */
export const META_WEIGHTS = { sameHub: 0.15, sameLang: 0.05, sameIntent: 0.05, sameFormat: 0.1 };

/** Precompute TF-IDF vectors for the inventory; returns a matcher. */
export function makeMatcher(docs) {
  const full = docs.map((d) => termFreq(d.fields));
  const df = new Map();
  for (const tf of full) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length + 1;
  const idf = (t) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
  const weigh = (tf) => new Map([...tf].map(([t, c]) => [t, (1 + Math.log(c)) * idf(t)]));
  const fullVecs = full.map(weigh);
  const topicVecs = docs.map((d) => weigh(termFreq(d.fields, TOPIC_FIELDS)));
  const bis = docs.map((d) => bigramSet(d.fields));
  const W = LEXICAL_WEIGHTS;

  return function match(query) {
    const qFull = weigh(termFreq(query.fields));
    const qTopic = weigh(termFreq(query.fields, TOPIC_FIELDS));
    const qb = bigramSet(query.fields);
    return docs.map((d, i) => {
      const topic = cosine(qTopic, topicVecs[i]);
      const all = cosine(qFull, fullVecs[i]);
      const jac = jaccard(qb, bis[i]);
      const lexical = W.topicCosine * topic + W.fullCosine * all + W.bigramJaccard * jac;
      const meta = {
        sameHub: !!query.hub && d.hub === query.hub,
        sameLang: !!query.lang && d.lang === query.lang,
        sameIntent: !!query.intent && query.intent !== 'unknown' && d.intent === query.intent,
        sameFormat: !!query.format && d.format === query.format,
      };
      // Metadata scales a lexical match; it never creates one on its own.
      const factor = 1 + META_WEIGHTS.sameHub * meta.sameHub + META_WEIGHTS.sameLang * meta.sameLang
        + META_WEIGHTS.sameIntent * meta.sameIntent + META_WEIGHTS.sameFormat * meta.sameFormat;
      const score = Math.min(1, lexical * factor);
      return { doc: d, score: round(score), lexical: round(lexical), cosine: round(topic), jaccard: round(jac), meta };
    });
  };
}

const round = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const band = (s) => (s >= HIGH_THRESHOLD ? 'high' : s >= CHECK_THRESHOLD ? 'check' : 'low');
const LIVE = ['published', 'held-ymyl', 'held-nosource', 'draft'];
const DONE_OPP = ['rejected', 'retire'];
const list = (ms) => ms.map((m) => `${m.doc.id} (${m.doc.status}, ${m.score})`).join(', ');

/**
 * Suggest an action from the ranked matches. Returns { action, reasons,
 * needsHumanCheck }. A suggestion, never a decision.
 *   pair(idA, idB): similarity between two inventory docs (for consolidation)
 *   hubOf(id): hub of an inventory doc
 */
export function classify(query, matches, pair = () => 0, hubOf = () => undefined) {
  const lang = query.lang ?? 'en';
  const above = matches.filter((m) => m.score >= CHECK_THRESHOLD);
  const pagesAbove = above.filter((m) => m.doc.kind === 'page' && LIVE.includes(m.doc.status) && m.doc.lang === lang);
  const highPages = pagesAbove.filter((m) => m.score >= HIGH_THRESHOLD);
  const highWork = above.filter((m) => m.score >= HIGH_THRESHOLD && m.doc.kind !== 'page' && !DONE_OPP.includes(m.doc.status));
  const rejected = above.filter((m) => m.doc.kind === 'opportunity' && m.doc.status === 'rejected');
  const removed = above.filter((m) => m.doc.kind === 'page' && m.doc.status === 'removed');
  // Existing pages in different hubs that already duplicate each other: a
  // matched page plus a matched or declared (OVERLAPS) page, mutual >= CHECK.
  // Siblings in one hub share vocabulary by design, so they do not count.
  const others = [...new Set([...pagesAbove.map((m) => m.doc.id), ...(query.declared ?? [])])];
  const dupPair = pagesAbove
    .flatMap((m) => others.filter((o) => o !== m.doc.id && hubOf(o) !== m.doc.hub && pair(m.doc.id, o) >= CHECK_THRESHOLD).map((o) => [m.doc.id, o]))[0];
  const crossHub = pagesAbove.filter((m) => m.doc.hub !== query.hub);
  const top = pagesAbove[0];
  const reasons = [];
  let action;

  if (query.kind === 'page') {
    // An existing page: merge with a near-duplicate or a cross-hub overlap; otherwise keep and watch.
    const merge = [...new Set([...highPages, ...crossHub])];
    action = merge.length ? 'consolidate' : 'monitor';
    reasons.push(merge.length
      ? `this page overlaps ${list(merge)}: keep one canonical page, merge the rest and redirect their URLs`
      : pagesAbove.length ? `partial overlap with sibling pages in the same hub (${list(pagesAbove)}): keep both, link them, watch for cannibalization once Outcome data exists`
        : 'no overlapping page: keep');
  } else if (highPages.length >= 2 || dupPair) {
    action = 'consolidate';
    const ids = dupPair ? `${dupPair[0]} and ${dupPair[1]} (mutual ${pair(...dupPair)})` : highPages.map((m) => m.doc.id).join(', ');
    reasons.push(`existing pages already overlap each other: ${ids}; merge or clearly separate them before adding anything`);
  } else if (highPages.length === 1) {
    action = 'improve';
    reasons.push(`${list(highPages)} already covers this topic: improve ${top.doc.status === 'published' ? 'the live page' : 'and release the held page'} instead of creating a new one`);
  } else if (highWork.length) {
    action = 'consolidate';
    reasons.push(`overlaps work already in the pipeline: ${list(highWork)}; merge the proposals`);
  } else if (top && top.doc.hub === query.hub && (top.doc.format === query.format || top.doc.status !== 'published')) {
    action = 'improve';
    reasons.push(`closest page ${list([top])} is in the same hub and ${top.doc.format === query.format ? 'the same format' : 'not yet released'}: finishing it is cheaper than a parallel page`);
  } else if (rejected.length) {
    action = 'reject';
    reasons.push(`matches a rejected opportunity: ${list(rejected)}; reopen only with new evidence`);
  } else if (removed.length) {
    action = 'redirect';
    reasons.push(`matches a removed page: ${list(removed)}; point its old URL at the new page`);
  } else if (above.length) {
    action = 'create';
    reasons.push(`partial overlap only (${list(above.slice(0, 3))}): narrow the scope and link to these pages`);
  } else {
    action = 'create';
    reasons.push(`no existing page, brief or opportunity reaches ${CHECK_THRESHOLD}`);
  }
  if (action === 'create' && query.ymyl && !query.hasEvidence) {
    reasons.push('YMYL topic with no linked evidence yet: the evidence and reviewer gates block approval until both exist');
  }
  return { action, reasons, needsHumanCheck: above.length > 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Query document for an Opportunity node (with its needs, brief and declared overlaps). */
export function queryForOpportunity(g, opp) {
  const needs = neighbors(g, opp.id, 'TARGETS');
  const briefs = neighbors(g, opp.id, 'SPECIFIES', 'in').map((b) => readBrief(b.path));
  return {
    id: opp.id, kind: 'opportunity', lang: needs[0]?.lang ?? 'en', hub: opp.category, intent: needs[0]?.intent ?? 'unknown',
    format: formatOf(opp.title), ymyl: !!opp.gates?.ymyl, hasEvidence: !!opp.gates?.evidence,
    declared: neighbors(g, opp.id, 'OVERLAPS').filter((n) => n.type === 'page').map((n) => n.id),
    fields: {
      title: opp.title,
      question: [...needs.map((n) => n.question), ...briefs.map((b) => b.h1)].filter(Boolean).join(' . '),
      slug: slugWords(opp.id),
      headings: briefs.flatMap((b) => b.headings).join(' . '),
    },
  };
}

/** Query document for free text (a title or a question). */
export function queryForText(text, { hub, lang = 'en', intent = 'unknown', ymyl = false } = {}) {
  return {
    id: null, kind: 'text', lang, hub, intent, format: formatOf(text), ymyl: !!ymyl, hasEvidence: false, declared: [],
    fields: { title: text, question: '', slug: slugify(text).replace(/-/g, ' '), headings: '' },
  };
}

/** IDs that are the query itself or its own brief/need (not competitors). */
function selfIds(g, query) {
  const ids = new Set();
  if (!query.id) return ids;
  ids.add(query.id);
  for (const n of neighbors(g, query.id, 'SPECIFIES', 'in')) ids.add(n.id);
  for (const n of neighbors(g, query.id, 'TARGETS')) ids.add(n.id);
  return ids;
}

/**
 * Rank the inventory against an Opportunity (id or node), a Page id or free
 * text. opts: { hub, lang, intent, ymyl, top }. Pass a prebuilt inventory to
 * avoid re-reading content when calling in a loop.
 * Returns { query, matches: [{ id, kind, status, score, band, needsHumanCheck, ... }], suggestion }.
 */
export function dedupe(input, opts = {}, g = loadGraph(), inv = null) {
  const docs = inv ?? buildInventory(g);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const node = typeof input === 'string' ? get(g, input) : input;
  let query;
  if (node?.type === 'opportunity') query = queryForOpportunity(g, node);
  else if (node?.type === 'page') query = { ...byId.get(node.id), kind: 'page', ymyl: node.ymyl, hasEvidence: true, declared: [] };
  else if (input && typeof input === 'object' && input.fields) query = input; // prebuilt query (propose)
  else query = queryForText(String(input), opts);
  if (opts.hub) query.hub = opts.hub;

  // The query's own nodes stay out of the pool, so IDF (and every score) is
  // the same before and after the opportunity is written: propose stays idempotent.
  const skip = selfIds(g, query);
  const pool = docs.filter((d) => !skip.has(d.id) && !(d.kind === 'brief' && d.specifies?.some((s) => skip.has(s))));
  const match = makeMatcher(pool);
  const top = opts.top ?? 8;
  const ranked = match(query)
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));
  const pair = (a, b) => (byId.has(a) && byId.has(b) ? match(byId.get(a)).find((m) => m.doc.id === b)?.score ?? 0 : 0);
  const matches = ranked.slice(0, top).map((m) => ({
    id: m.doc.id, kind: m.doc.kind, status: m.doc.status, lang: m.doc.lang, hub: m.doc.hub, format: m.doc.format, title: m.doc.title,
    score: m.score, band: band(m.score), needsHumanCheck: m.score >= CHECK_THRESHOLD,
    lexical: m.lexical, cosine: m.cosine, jaccard: m.jaccard, meta: m.meta,
  }));
  const suggestion = classify(query, ranked.slice(0, top), pair, (id) => byId.get(id)?.hub);
  return { query: { id: query.id, kind: query.kind, title: query.fields.title, hub: query.hub, lang: query.lang, format: query.format }, matches, suggestion };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printResult(r) {
  console.log(`\n${r.query.id ?? 'text'}: "${r.query.title}"  (hub ${r.query.hub || '-'}, ${r.query.lang})`);
  console.log(`  suggestion: ${r.suggestion.action}${r.suggestion.needsHumanCheck ? '  [needs human check]' : ''}`);
  for (const reason of r.suggestion.reasons) console.log(`    - ${reason}`);
  for (const m of r.matches) {
    const flag = m.needsHumanCheck ? ' needs human check' : '';
    console.log(`  ${m.score.toFixed(3)} ${m.band.padEnd(5)} ${m.kind.padEnd(11)} ${String(m.status).padEnd(13)} ${m.id}${flag}`);
  }
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all' || a === '--json') opts[a.slice(2)] = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  if (opts.top) opts.top = Number(opts.top);
  return opts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const g = loadGraph();
  const inv = buildInventory(g);
  const inputs = opts.all ? byType(g, 'opportunity').map((o) => o.id).sort() : [opts._.join(' ')];
  if (!inputs[0]) {
    console.log('usage: npm run kg:dedupe -- "<text>" [--hub x] [--lang en] [--intent x] [--top n] [--json] | opp:<slug> | --all');
    process.exit(1);
  }
  const results = inputs.map((x) => dedupe(x, opts, g, inv));
  if (opts.json) console.log(JSON.stringify(results, null, 2));
  else results.forEach(printResult);
}
