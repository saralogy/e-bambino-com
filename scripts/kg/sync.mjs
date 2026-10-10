/**
 * sync.mjs — derive knowledge graph nodes from the repository (npm run kg:sync).
 *
 *   Page     every content collection, both languages, shipgate semantics
 *   Source   src/lib/sources.ts + the URLs on src/views/Sources.astro
 *   Brief    docs/content-intelligence/inbox/*.md, plus one Opportunity (and
 *            its Need) per brief, created once and then left to the workflow
 *   Claim /  docs/research/*.json (search-snippet facts from 2026-10-10)
 *   Evidence
 *
 * Idempotent: a second run produces no diff. It never deletes nodes; derived
 * Page and Source nodes whose content is gone are marked status "removed".
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { addDays, idFor, loadNodes, ROOT, slugify, stopped, writeNode } from './lib.mjs';
import { AUTHORITY, SYNC_OWNED_RELS } from './schema.mjs';

if (stopped()) {
  console.log('knowledge/STOP is present: kg:sync halted.');
  process.exit(0);
}

const CONTENT = join(ROOT, 'src/content');
const RESEARCH_DATE = '2026-10-10';
const REVALIDATE_BY = '2027-04-10';

// URL section per collection (mirrors SECTIONS in src/i18n/index.ts).
const SECTION = {
  namen: { en: 'names', de: 'namen' },
  checklisten: { en: 'checklists', de: 'checklisten' },
  ratgeber: { en: 'guides', de: 'ratgeber' },
  kaufberatung: { en: 'buying-guides', de: 'kaufberatung' },
  finanz: { de: 'finanz' },
};
// Collections whose routes apply src/lib/shipgate.ts.
const GATED = ['fragen', 'kaufberatung'];

const stats = { created: 0, updated: 0, unchanged: 0 };
const count = (r) => { stats[r]++; };
const ls = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

// ---------------------------------------------------------------------------
// Frontmatter: flat `key: value` lines, quoted strings, inline arrays. Nested
// YAML (buying-guide criteria) is skipped; we only need top-level scalars.
// ---------------------------------------------------------------------------
function parseValue(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if (v === 'true' || v === 'false') return v === 'true';
  if (v.startsWith('[')) {
    return [...v.matchAll(/"([^"]*)"|'([^']*)'|([^,\[\]\s][^,\[\]]*)/g)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function readMarkdown(file) {
  const txt = readFileSync(file, 'utf8');
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: txt };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w]*):(.*)$/);
    if (kv) fm[kv[1]] = parseValue(kv[2]);
  }
  return { fm, body: m[2] };
}

/** Same order as shipGate(): draft, then YMYL without reviewer, then no source. */
function gateStatus(fm) {
  if (fm.draft === true) return 'draft';
  if (fm.ymyl === true && !String(fm.reviewedBy ?? '').trim()) return 'held-ymyl';
  if (!(fm.quellen ?? []).length) return 'held-nosource';
  return 'published';
}

const dateOnly = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);

// ---------------------------------------------------------------------------
// 1. Pages
// ---------------------------------------------------------------------------
const pages = new Map(); // id -> node
const pageByUrl = new Map();
const pageBySlug = new Map(); // `${collection}/${lang}/${slug}` -> id

for (const collection of readdirSync(CONTENT).filter((d) => !d.includes('.')).sort()) {
  for (const lang of ['en', 'de']) {
    const dir = join(CONTENT, collection, lang);
    for (const f of ls(dir, '.md')) {
      const { fm, body } = readMarkdown(join(dir, f));
      const fileSlug = basename(f, '.md');
      const slug = collection === 'fragen' ? fm.slug || fileSlug : fileSlug;
      const base = lang === 'de' ? '/de' : '';
      const url = collection === 'fragen' ? `${base}/${fm.hub}/${slug}/` : `${base}/${SECTION[collection]?.[lang] ?? collection}/${slug}/`;
      const gated = GATED.includes(collection);
      const id = idFor.page(lang, url);
      const internalLinks = [...new Set([...body.matchAll(/\]\((\/[^)\s#]*)/g)].map((m) => m[1]))].sort();
      pages.set(id, {
        id, type: 'page', lang, collection, slug, url, gated,
        hub: fm.hub || undefined,
        title: fm.title || fm.frage || slug,
        status: gated ? gateStatus(fm) : fm.draft === true ? 'draft' : 'published',
        ymyl: fm.ymyl === true,
        reviewedBy: String(fm.reviewedBy ?? '').trim() || undefined,
        quellen: Array.isArray(fm.quellen) ? fm.quellen : [],
        translationOf: fm.translationOf || undefined,
        updated: dateOnly(fm.updatedDate) ?? dateOnly(fm.date),
        internalLinks,
        edges: [],
      });
      pageByUrl.set(url, id);
      pageBySlug.set(`${collection}/${lang}/${slug}`, id);
    }
  }
}
// Derived page-to-page edges.
for (const p of pages.values()) {
  for (const href of p.internalLinks) {
    const to = pageByUrl.get(href.endsWith('/') ? href : `${href}/`);
    if (to && to !== p.id) p.edges.push({ rel: 'LINKS_TO', to });
  }
  if (p.translationOf) {
    const to = pageBySlug.get(`${p.collection}/de/${p.translationOf}`);
    if (to) p.edges.push({ rel: 'TRANSLATION_OF', to });
  }
}

// ---------------------------------------------------------------------------
// 2. Sources
// ---------------------------------------------------------------------------
const sourcesTs = readFileSync(join(ROOT, 'src/lib/sources.ts'), 'utf8');
const registered = Object.fromEntries(
  [...sourcesTs.matchAll(/^\s*'?([\w-]+)'?:\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]),
);
const sourcesAstro = readFileSync(join(ROOT, 'src/views/Sources.astro'), 'utf8');
const listed = [...sourcesAstro.matchAll(/org:\s*'([^']+)',\s*url:\s*'([^']+)',\s*voll:\s*\{\s*en:\s*'([^']+)'/g)]
  .map((m) => ({ org: m[1], url: m[2], fullName: m[3] }));

const sources = new Map();
const keyForOrg = (org) => Object.keys(registered).find((k) => registered[k] === org) ?? slugify(org);
for (const { org, url, fullName } of listed) {
  const key = keyForOrg(org);
  sources.set(key, { key, name: org, url, fullName });
}
for (const [key, name] of Object.entries(registered)) if (!sources.has(key)) sources.set(key, { key, name });
for (const [key, s] of [...sources.entries()].sort()) {
  const [jurisdiction, authority] = AUTHORITY[key] ?? ['unknown', 'other'];
  sources.set(key, {
    id: idFor.source(key), type: 'source', ...s, jurisdiction, authority,
    registered: key in registered, status: 'active', edges: [],
  });
}

// ---------------------------------------------------------------------------
// 3. Briefs, their Opportunities and Needs (authored once, then preserved)
// ---------------------------------------------------------------------------
const briefDir = join(ROOT, 'docs/content-intelligence/inbox');
const authored = []; // [node, preserve]
const enFrageSlugs = new Map([...pages.values()].filter((p) => p.lang === 'en').map((p) => [p.slug, p.id]));

function actionFromDecision(line) {
  const d = line.toLowerCase();
  if (/^(do not|don't|reject)/.test(d)) return 'reject';
  if (/^(extend|update|improve)/.test(d)) return 'improve';
  if (/^(merge|consolidate)/.test(d)) return 'consolidate';
  if (/^redirect/.test(d)) return 'redirect';
  if (/^(build|create)/.test(d)) return 'create';
  return 'monitor';
}

for (const f of ls(briefDir, '.md')) {
  const fileSlug = basename(f, '.md');
  const txt = readFileSync(join(briefDir, f), 'utf8');
  const field = (name) => txt.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm'))?.[1].trim();
  const title = txt.match(/^# (?:Content opportunity(?: brief)?:\s*)?(.+)$/m)?.[1].trim() ?? fileSlug;
  const decisionLine = field('Decision') ?? '';
  const category = slugify((field('Category') ?? '').replace('&', 'and'));
  const researchDate = field('Research date') ?? RESEARCH_DATE;
  const oppSlug = fileSlug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const oppId = idFor.opportunity(oppSlug);
  const h1 = txt.match(/^\*\*H1:\*\*\s*(.+)$/m)?.[1].trim();
  const overlaps = [...new Set([...txt.matchAll(/`([a-z0-9-]+)`/g)].map((m) => enFrageSlugs.get(m[1])).filter(Boolean))];

  authored.push([{
    id: idFor.brief(fileSlug), type: 'brief', path: `docs/content-intelligence/inbox/${f}`, status: 'inbox',
    title, category, priority: field('Priority'), decisionLine, researchDate,
    edges: [{ rel: 'SPECIFIES', to: oppId }],
  }, true]);
  const oppEdges = overlaps.map((to) => ({ rel: 'OVERLAPS', to }));
  if (h1) {
    const needId = idFor.need(oppSlug);
    oppEdges.push({ rel: 'TARGETS', to: needId });
    authored.push([{ id: needId, type: 'need', question: h1, intent: 'unknown', audience: 'expecting and new parents', lang: 'en', edges: [] }, true]);
  }
  authored.push([{
    id: oppId, type: 'opportunity', title, category,
    action: actionFromDecision(decisionLine), state: 'proposed', priority: field('Priority'),
    demand: 'unknown',
    gates: { evidence: false, ymyl: /`ymyl: true`/.test(txt), duplicateOf: [] },
    rationale: `From brief ${f}. Decision line: "${decisionLine}". Not yet scored against the PLAYBOOK rubric.`,
    owner: 'content-intelligence-lead', reviewBy: addDays(researchDate, 90),
    edges: oppEdges,
  }, true]);
}

// ---------------------------------------------------------------------------
// 4. Claims and Evidence from docs/research/*.json
// ---------------------------------------------------------------------------
const claims = new Map();
const evidence = new Map();
const addTopic = (node, topic) => { if (!node.topics.includes(topic)) node.topics.push(topic); node.topics.sort(); };

for (const f of ls(join(ROOT, 'docs/research'), '.json')) {
  const { pieces = [] } = JSON.parse(readFileSync(join(ROOT, 'docs/research', f), 'utf8'));
  for (const piece of pieces) {
    const pageId = enFrageSlugs.get(piece.slug);
    const page = pageId && pages.get(pageId);
    const ymyl = page ? page.ymyl : true; // no page yet: treat as YMYL until decided

    for (const fact of piece.facts ?? []) {
      const cid = idFor.claim(fact.claim);
      const eid = idFor.evidence(fact.url, fact.claim);
      if (!claims.has(cid)) {
        claims.set(cid, { id: cid, type: 'claim', text: fact.claim.trim(), kind: 'fact', ymyl, confidence: 'medium', status: 'supported', topics: [], edges: [] });
      }
      const claim = claims.get(cid);
      claim.ymyl = claim.ymyl || ymyl;
      addTopic(claim, piece.slug);
      claim.edges.push({ rel: 'SUPPORTED_BY', to: eid });

      if (!evidence.has(eid)) {
        const official = ['official', 'professional'].includes(AUTHORITY[fact.sourceKey]?.[1]);
        evidence.set(eid, {
          id: eid, type: 'evidence', url: fact.url, sourceKey: fact.sourceKey,
          accessed: RESEARCH_DATE, retrievalMethod: 'search-snippet',
          sourceQuality: official ? 'primary-authority' : 'secondary',
          revalidateBy: REVALIDATE_BY, topics: [],
          edges: sources.has(fact.sourceKey) ? [{ rel: 'FROM', to: idFor.source(fact.sourceKey) }] : [],
        });
      }
      addTopic(evidence.get(eid), piece.slug);
      if (page) page.edges.push({ rel: 'CITES', to: cid });
    }

    // Open questions the researcher could not source: kept as unsupported hypotheses.
    for (const text of piece.unverified ?? []) {
      const cid = idFor.claim(text);
      if (!claims.has(cid)) {
        claims.set(cid, { id: cid, type: 'claim', text: text.trim(), kind: 'hypothesis', ymyl, confidence: 'low', status: 'unsupported', topics: [], edges: [] });
      }
      addTopic(claims.get(cid), piece.slug);
    }
  }
}

// ---------------------------------------------------------------------------
// Write everything, then mark vanished derived nodes as removed.
// ---------------------------------------------------------------------------
for (const p of pages.values()) count(writeNode(p, { replaceRels: SYNC_OWNED_RELS.page }));
for (const s of sources.values()) count(writeNode(s));
for (const [node, preserve] of authored) count(writeNode(node, { preserve }));
for (const c of claims.values()) count(writeNode(c));
for (const e of evidence.values()) count(writeNode(e));

for (const node of loadNodes().values()) {
  const gone = (node.type === 'page' && !pages.has(node.id)) || (node.type === 'source' && !sources.has(node.key));
  if (gone && node.status !== 'removed') count(writeNode({ ...node, status: 'removed' }));
}

console.log(`kg:sync  pages ${pages.size}  sources ${sources.size}  claims ${claims.size}  evidence ${evidence.size}  authored ${authored.length}`);
console.log(`         created ${stats.created}  updated ${stats.updated}  unchanged ${stats.unchanged}`);
