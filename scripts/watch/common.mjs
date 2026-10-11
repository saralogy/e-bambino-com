/**
 * common.mjs — shared helpers for the watch jobs (build-watchlist, fetch,
 * revalidate). Graph access goes through scripts/kg/lib.mjs.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, byType, KG_DIR, neighbors, ROOT, stableStringify, today } from '../kg/lib.mjs';

export const WATCHLIST_FILE = join(KG_DIR, 'watchlist.json');
export const USER_AGENT = 'e-bambino-watch/1.0 (+https://e-bambino.com/about/)';
export const UA_TOKEN = 'e-bambino-watch';

/** Days between two checks, per frequency. Slightly under 7/28 so schedule jitter never skips a cycle. */
export const FREQUENCY_DAYS = { weekly: 6, monthly: 27 };

/** Read a `--name value` flag (or `--name=value`). */
export function flag(name, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}
export const hasFlag = (name) => process.argv.slice(2).includes(`--${name}`);

/** The run date: --today YYYY-MM-DD (tests and backfills) or the real UTC date. */
export function runDate() {
  const d = flag('today');
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`--today must be YYYY-MM-DD, got "${d}"`);
  return d ?? today();
}

/** Whole days from date a to date b (YYYY-MM-DD). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export { addDays };

/** Canonical form for comparing URLs: no fragment, lowercase host. */
export function canonicalUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
export const hostOf = (u) => new URL(u).host;

/** Load the watchlist ({ entries: [] } when missing). */
export function loadWatchlist(file = WATCHLIST_FILE) {
  if (!existsSync(file)) return { entries: [] };
  return JSON.parse(readFileSync(file, 'utf8'));
}
export const saveWatchlist = (list, file = WATCHLIST_FILE) => writeFileSync(file, stableStringify(list));

/**
 * Research topic slug -> category, from docs/research/<category>.json.
 * Evidence and claims carry these slugs in `topics`.
 */
export function topicCategories() {
  const dir = join(ROOT, 'docs/research');
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const category = f.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const p of data.pieces ?? []) if (p.slug && !map.has(p.slug)) map.set(p.slug, category);
  }
  return map;
}

/** Most frequent value in a list (ties: alphabetical), or undefined. */
export function mostCommon(list) {
  const c = new Map();
  for (const v of list) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/**
 * Owner category of a claim: its research topic, else the hub of a page
 * that cites it, else "unassigned".
 */
export function claimCategory(g, claim, topics = topicCategories()) {
  const fromTopic = mostCommon((claim.topics ?? []).map((t) => topics.get(t)));
  if (fromTopic) return fromTopic;
  return mostCommon(neighbors(g, claim.id, 'CITES', 'in').map((p) => p.hub)) ?? 'unassigned';
}

/** Owner category of an evidence node (same rule, through its topics and claims). */
export function evidenceCategory(g, ev, topics = topicCategories()) {
  const fromTopic = mostCommon((ev.topics ?? []).map((t) => topics.get(t)));
  if (fromTopic) return fromTopic;
  const claims = [...neighbors(g, ev.id, 'SUPPORTED_BY', 'in'), ...neighbors(g, ev.id, 'CONTRADICTED_BY', 'in')];
  return mostCommon(claims.map((c) => claimCategory(g, c, topics))) ?? 'unassigned';
}

/** Nodes in the graph that carry this URL (evidence, source, observation). */
export function nodesForUrl(g, url) {
  const want = canonicalUrl(url);
  return ['evidence', 'source', 'observation'].flatMap((t) => byType(g, t)).filter((n) => n.url && canonicalUrl(n.url) === want);
}

/** Markdown-safe one-liner. */
export const md = (s, max = 160) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export { today };
