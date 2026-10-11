/**
 * build-watchlist.mjs — regenerate knowledge/watchlist.json, the allowlist
 * of URLs the change-detection job (fetch.mjs) may request.
 *
 *   source      Evidence node URLs and Source node URLs (official bodies), plus
 *               official URLs cited in docs/content-intelligence/**.md
 *   competitor  every other URL cited in docs/content-intelligence/**.md
 *
 * Frequency: weekly for evidence behind claims cited by a published page,
 * monthly for everything else. Each entry keeps its `last` fetch state
 * (written by fetch.mjs) as long as the URL stays on the list.
 *
 * Deterministic: no timestamps, entries sorted by URL. Obeys knowledge/STOP.
 * Usage: node scripts/watch/build-watchlist.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { byType, loadGraph, neighbors, ROOT, slugify, stableStringify, stopped } from '../kg/lib.mjs';
import {
  canonicalUrl, evidenceCategory, hasFlag, hostOf, loadWatchlist, saveWatchlist, topicCategories, USER_AGENT, WATCHLIST_FILE,
} from './common.mjs';

if (stopped()) {
  console.log('knowledge/STOP is present: build-watchlist halted.');
  process.exit(0);
}

const DOCS_DIR = join(ROOT, 'docs/content-intelligence');
// Public bodies that have no Source node yet (e.g. the NHS) still count as
// official, never as competitors.
const OFFICIAL_SUFFIXES = ['.gov', 'nhs.uk', 'who.int', 'europa.eu', 'bund.de'];

const g = loadGraph();
const topics = topicCategories();
const entries = new Map(); // url -> { url, kind, category, frequency, refs:Set }

function add(url, { kind, category, weekly = false, ref }) {
  const u = canonicalUrl(url);
  if (!u) return;
  const e = entries.get(u) ?? { url: u, kind, category, weekly: false, refs: new Set() };
  if (kind === 'source') e.kind = 'source'; // official wins over competitor
  if (!e.category || e.category === 'all' || e.category === 'unassigned') e.category = category ?? e.category;
  e.weekly ||= weekly;
  if (ref) e.refs.add(ref);
  entries.set(u, e);
}

// --- Evidence ---------------------------------------------------------------
const liveClaims = new Set(byType(g, 'page').filter((p) => p.status === 'published')
  .flatMap((p) => neighbors(g, p.id, 'CITES').map((c) => c.id)));
for (const ev of byType(g, 'evidence').sort((a, b) => a.id.localeCompare(b.id))) {
  const claims = [...neighbors(g, ev.id, 'SUPPORTED_BY', 'in'), ...neighbors(g, ev.id, 'CONTRADICTED_BY', 'in')];
  add(ev.url, {
    kind: ev.sourceQuality === 'competitor' ? 'competitor' : 'source',
    category: evidenceCategory(g, ev, topics),
    weekly: claims.some((c) => liveClaims.has(c.id)),
    ref: ev.id,
  });
}

// --- Sources ----------------------------------------------------------------
for (const src of byType(g, 'source').sort((a, b) => a.id.localeCompare(b.id))) {
  if (src.url && src.status === 'active') add(src.url, { kind: 'source', category: 'all', ref: src.id });
}

// --- Content-intelligence docs ----------------------------------------------
const bare = (h) => h.replace(/^www\./, '');
const officialHosts = new Set([
  ...byType(g, 'source').filter((s) => s.url).map((s) => bare(hostOf(s.url))),
  ...byType(g, 'evidence').filter((e) => e.sourceQuality === 'primary-authority').map((e) => bare(hostOf(e.url))),
]);
function isOfficial(url) {
  const h = bare(hostOf(url));
  return officialHosts.has(h) || OFFICIAL_SUFFIXES.some((s) => h === s.replace(/^\./, '') || h.endsWith(s.startsWith('.') ? s : `.${s}`));
}

const knownCategories = new Set([...topics.values()]);
const categoryOfHeading = (h) => {
  const c = slugify(h.replace(/&/g, ' and '));
  return knownCategories.has(c) ? c : undefined;
};
const briefCategory = new Map(byType(g, 'brief').map((b) => [b.path, b.category]));

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') ? [p] : [];
  });
}
for (const file of walk(DOCS_DIR)) {
  const rel = relative(ROOT, file);
  let category = briefCategory.get(rel);
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const h = line.match(/^#{2,4}\s+(.+)$/);
    if (h && !briefCategory.has(rel)) category = categoryOfHeading(h[1]);
    for (const m of line.matchAll(/https?:\/\/[^\s)<>"'`\]]+/g)) {
      const url = m[0].replace(/[.,;:]+$/, '');
      if (!canonicalUrl(url)) continue;
      add(url, { kind: isOfficial(url) ? 'source' : 'competitor', category: category ?? 'unassigned', ref: rel });
    }
  }
}

// --- Write --------------------------------------------------------------------
const old = new Map(loadWatchlist().entries.map((e) => [e.url, e]));
const list = {
  about: 'Allowlist for scripts/watch/fetch.mjs. Regenerate with node scripts/watch/build-watchlist.mjs; `last` is fetch state (hash, title, last-modified, status only, never page text).',
  userAgent: USER_AGENT,
  entries: [...entries.values()].sort((a, b) => a.url.localeCompare(b.url)).map((e) => ({
    url: e.url,
    kind: e.kind,
    category: e.category ?? 'unassigned',
    frequency: e.weekly ? 'weekly' : 'monthly',
    refs: [...e.refs].sort(),
    ...(old.get(e.url)?.last ? { last: old.get(e.url).last } : {}),
  })),
};

const count = (k, v) => list.entries.filter((e) => e[k] === v).length;
const dropped = [...old.keys()].filter((u) => !entries.has(u));
console.log(`watchlist: ${list.entries.length} URLs (${count('kind', 'source')} source, ${count('kind', 'competitor')} competitor; ${count('frequency', 'weekly')} weekly, ${count('frequency', 'monthly')} monthly)${dropped.length ? `; ${dropped.length} dropped` : ''}`);

const before = existsSync(WATCHLIST_FILE) ? readFileSync(WATCHLIST_FILE, 'utf8') : '';
const changed = before !== stableStringify(list);
if (hasFlag('dry-run')) console.log(`dry run: ${changed ? 'would update' : 'no change to'} ${relative(ROOT, WATCHLIST_FILE)}`);
else if (changed) { saveWatchlist(list); console.log(`wrote ${relative(ROOT, WATCHLIST_FILE)}`); } else console.log('unchanged');
