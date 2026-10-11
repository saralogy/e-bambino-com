/**
 * fetch.mjs — change detection for watched URLs (knowledge/watchlist.json).
 *
 * For each due URL: honor robots.txt (cached per host, our user agent), wait
 * at least 5 s between requests to one host, 20 s timeout, at most 3 attempts.
 * The main text (script/style/nav/footer and similar removed, whitespace
 * normalized) is hashed with sha256. Only the hash, the <title>, the
 * Last-Modified header and the fetch status are stored. Page text never is.
 *
 * On a changed hash: a ChangeEvent node AFFECTS the Evidence, Source and
 * Observation nodes with that URL, and every claim backed by that evidence
 * gets `revalidate: <change id>`. 4xx/5xx, robots-disallowed and network
 * errors are recorded in the entry's `last.status` and never count as current.
 * One Run node per day (run:<date>-watch) summarizes the day's checks.
 *
 * Idempotent per day: a URL checked today is not due again today.
 * Obeys knowledge/STOP. No dependencies.
 *
 * Usage: node scripts/watch/fetch.mjs [--dry-run] [--limit 60] [--max-minutes 20]
 *                                      [--summary <file.md>] [--today YYYY-MM-DD]
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { idFor, loadGraph, neighbors, stopped, writeNode } from '../kg/lib.mjs';
import {
  canonicalUrl, daysBetween, flag, FREQUENCY_DAYS, hasFlag, hostOf, loadWatchlist, md, nodesForUrl, runDate,
  saveWatchlist, UA_TOKEN, USER_AGENT,
} from './common.mjs';

if (stopped()) {
  console.log('knowledge/STOP is present: watch fetch halted, nothing written.');
  process.exit(0);
}

const DRY = hasFlag('dry-run');
const LIMIT = Math.min(Number(flag('limit', 60)), 200); // CONTRACT §10 caps a run at 200 URLs
const MAX_MS = Number(flag('max-minutes', 20)) * 60000;
const TIMEOUT_MS = 20000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ATTEMPTS = 3;
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
// 5 s per host. Only the local self-test may shorten it, and only for loopback hosts.
const hostDelay = (host) => (LOOPBACK.test(host) && process.env.WATCH_TEST_HOST_DELAY_MS ? Number(process.env.WATCH_TEST_HOST_DELAY_MS) : 5000);

const DATE = runDate();
const startedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// ---------------------------------------------------------------------------
// Due selection
// ---------------------------------------------------------------------------
const list = loadWatchlist();
const isDue = (e) => !e.last?.checked || (e.last.checked < DATE && daysBetween(e.last.checked, DATE) >= FREQUENCY_DAYS[e.frequency]);

/** Never checked first, then the oldest check, weekly before monthly, then URL. */
function selectDue(entries) {
  const due = entries.filter((e) => canonicalUrl(e.url) && isDue(e)).sort((a, b) => (a.last?.checked ?? '').localeCompare(b.last?.checked ?? '')
    || (a.frequency === b.frequency ? 0 : a.frequency === 'weekly' ? -1 : 1) || a.url.localeCompare(b.url));
  return due.slice(0, LIMIT);
}

/** Interleave hosts so the per-host delay overlaps with other hosts' requests. */
function interleave(entries) {
  const byHost = new Map();
  for (const e of entries) {
    const h = hostOf(e.url);
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h).push(e);
  }
  const queues = [...byHost.values()];
  const out = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift());
  return out;
}

const due = interleave(selectDue(list.entries));

if (DRY) {
  const hosts = new Map();
  for (const e of due) hosts.set(hostOf(e.url), (hosts.get(hostOf(e.url)) ?? 0) + 1);
  const busiest = Math.max(0, ...hosts.values());
  console.log(`dry run ${DATE}: ${due.length} of ${list.entries.length} watched URLs due (limit ${LIMIT}), ${hosts.size} hosts; no network, no writes.`);
  for (const [h, n] of [...hosts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${h}`);
  console.log(`busiest host needs at least ${Math.ceil(((busiest + 1) * 5) / 60)} min at 5 s per request (robots.txt included).`);
  for (const e of due.slice(0, 15)) console.log(`  due  ${e.frequency.padEnd(7)} ${e.kind.padEnd(10)} ${e.url}`);
  if (due.length > 15) console.log(`  ... ${due.length - 15} more`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// HTTP with per-host rate limit, timeout, size cap
// ---------------------------------------------------------------------------
const lastRequest = new Map();
let requests = 0;

async function politeGet(url, headers = {}) {
  const host = hostOf(url);
  const wait = (lastRequest.get(host) ?? 0) + hostDelay(host) - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest.set(host, Date.now());
  requests++;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5', ...headers },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const body = await readCapped(res);
    return { status: res.status, headers: res.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res) {
  if (!res.body) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw Object.assign(new Error('response over 5 MB'), { code: 'too-large' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// robots.txt (RFC 9309): our group, else "*"; longest match wins, Allow on ties
// ---------------------------------------------------------------------------
const robotsCache = new Map(); // origin -> { rules } | { allowAll } | { disallowAll }

function parseRobots(text) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (cur && (key === 'allow' || key === 'disallow')) {
      if (val) cur.rules.push({ allow: key === 'allow', path: val });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && UA_TOKEN.includes(a)));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(path, rule) {
  const anchored = rule.endsWith('$');
  const body = (anchored ? rule.slice(0, -1) : rule).split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

function robotsAllows(rules, url) {
  const u = new URL(url);
  const path = u.pathname + u.search;
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(path, r.path)) continue;
    const len = r.path.replace(/\*|\$$/g, '').length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}

async function robotsFor(url) {
  const origin = new URL(url).origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let entry;
  try {
    const res = await politeGet(`${origin}/robots.txt`, { accept: 'text/plain' });
    if (res.status >= 200 && res.status < 300) entry = { rules: parseRobots(res.body.toString('utf8')) };
    else if (res.status >= 400 && res.status < 500) entry = { allowAll: true }; // RFC 9309: unavailable means no restrictions
    else entry = { disallowAll: true }; // 5xx or an unfollowed redirect: assume complete disallow
  } catch {
    entry = { disallowAll: true }; // unreachable: assume complete disallow
  }
  robotsCache.set(origin, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Main-text extraction (hash input only; never stored)
// ---------------------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

function extract(html) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  let doc = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'nav', 'footer', 'header', 'aside', 'form']) {
    doc = doc.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
  }
  const main = doc.match(/<main\b[\s\S]*?<\/main\s*>/i)?.[0] ?? doc.match(/<body\b[\s\S]*<\/body\s*>/i)?.[0] ?? doc;
  const text = decode(main.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return { title: title.slice(0, 200), text };
}

// ---------------------------------------------------------------------------
// Check one URL. Returns the new `last` state (no page text in it).
// ---------------------------------------------------------------------------
const TRANSIENT = (r) => r.error || r.httpStatus === 429 || r.httpStatus >= 500;

async function attempt(url, prev) {
  const robots = await robotsFor(url);
  if (robots.disallowAll) return { status: 'robots-unavailable' };
  if (robots.rules && !robotsAllows(robots.rules, url)) return { status: 'robots-disallowed' };

  let target = url;
  for (let hop = 0; hop <= 3; hop++) {
    const headers = prev?.contentHash && prev.lastModified ? { 'if-modified-since': prev.lastModified } : {};
    let res;
    try {
      res = await politeGet(target, headers);
    } catch (e) {
      return { status: e.code === 'too-large' ? 'too-large' : e.name === 'AbortError' ? 'error-timeout' : 'error-network', error: !e.code };
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      const next = loc && canonicalUrl(new URL(loc, target).toString());
      if (!next || hostOf(next) !== hostOf(url)) return { status: 'redirect-offsite', httpStatus: res.status };
      if (robots.rules && !robotsAllows(robots.rules, next)) return { status: 'robots-disallowed' };
      target = next;
      continue;
    }
    if (res.status === 304 && prev?.contentHash) {
      return { status: 'ok', httpStatus: 304, contentHash: prev.contentHash, title: prev.title, lastModified: prev.lastModified };
    }
    if (res.status < 200 || res.status >= 300) return { status: `http-${res.status}`, httpStatus: res.status };
    const type = res.headers.get('content-type') ?? '';
    const isHtml = /html|xml/i.test(type) || (!type && /^\s*</.test(res.body.toString('utf8', 0, 200)));
    const { title, text } = isHtml ? extract(res.body.toString('utf8')) : { title: '', text: null };
    return {
      status: 'ok',
      httpStatus: res.status,
      contentHash: `sha256:${text === null ? createHash('sha256').update(res.body).digest('hex') : sha256(text)}`,
      title: title || undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
    };
  }
  return { status: 'redirect-loop' };
}

async function check(entry) {
  let r;
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    r = await attempt(entry.url, entry.last);
    r.attempts = n;
    if (!TRANSIENT(r) || n === MAX_ATTEMPTS) break;
    await sleep(hostDelay(hostOf(entry.url)) * 2 ** (n - 1)); // exponential backoff: 5 s, 10 s
  }
  return r;
}

// ---------------------------------------------------------------------------
// Graph writes on a change
// ---------------------------------------------------------------------------
const g = loadGraph();
const produced = [];

function recordChange(entry, prev, cur) {
  const affected = nodesForUrl(g, entry.url);
  const evidence = affected.filter((n) => n.type === 'evidence');
  const claims = [...new Map(evidence.flatMap((ev) => [
    ...neighbors(g, ev.id, 'SUPPORTED_BY', 'in'), ...neighbors(g, ev.id, 'CONTRADICTED_BY', 'in'),
  ]).map((c) => [c.id, c])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const id = idFor.change(DATE, createHash('sha1').update(`${entry.url}\n${cur.contentHash}`).digest('hex'));
  const titleNote = prev.title !== cur.title ? ` Title changed from "${prev.title ?? ''}" to "${cur.title ?? ''}".` : '';
  writeNode({
    id,
    type: 'change',
    url: entry.url,
    detected: flag('today') ? DATE : startedAt, // a simulated run date (--today) wins over the wall clock
    oldHash: prev.contentHash,
    newHash: cur.contentHash,
    summary: `Main-text hash changed on a watched ${entry.kind} page (${entry.category}).${titleNote} Last-Modified: ${cur.lastModified ?? 'not sent'}. ${evidence.length} evidence node(s) and ${claims.length} claim(s) need a re-check.`,
    edges: affected.map((n) => ({ rel: 'AFFECTS', to: n.id })),
  });
  produced.push(id);
  for (const c of claims) {
    writeNode({ id: c.id, type: 'claim', revalidate: id });
    produced.push(c.id);
  }
  return { id, evidence: evidence.length, claims: claims.length };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const results = [];
const deadline = Date.now() + MAX_MS;
let budgetHit = false;

for (const entry of due) {
  if (stopped()) {
    console.log('knowledge/STOP appeared: halting. Progress so far is in the watchlist; no Run node written.');
    process.exit(0);
  }
  if (Date.now() > deadline) { budgetHit = true; break; }
  const prev = entry.last ?? {};
  const r = await check(entry);
  const ok = r.status === 'ok';
  const changed = ok && prev.contentHash && prev.contentHash !== r.contentHash;
  // Failures keep the last good hash and title; they describe okAt, not today.
  entry.last = {
    checked: DATE,
    status: r.status,
    httpStatus: r.httpStatus,
    attempts: r.attempts,
    contentHash: ok ? r.contentHash : prev.contentHash,
    title: ok ? r.title : prev.title,
    lastModified: ok ? r.lastModified : prev.lastModified,
    okAt: ok ? DATE : prev.okAt,
    changedAt: changed ? DATE : prev.changedAt,
  };
  for (const k of Object.keys(entry.last)) if (entry.last[k] === undefined) delete entry.last[k];
  const res = { url: entry.url, kind: entry.kind, category: entry.category, status: r.status, baseline: ok && !prev.contentHash, changed: Boolean(changed) };
  if (changed) Object.assign(res, recordChange(entry, prev, r));
  results.push(res);
  console.log(`${res.changed ? 'CHANGED ' : ok ? 'ok      ' : 'FAILED  '}${r.status.padEnd(18)} ${entry.url}`);
  saveWatchlist(list); // save as we go, so an interrupted run keeps its progress
}

// Day summary from the watchlist state: re-runs on the same day converge.
const todays = list.entries.filter((e) => e.last?.checked === DATE);
const counts = {
  checked: todays.length,
  ok: todays.filter((e) => e.last.status === 'ok').length,
  changed: todays.filter((e) => e.last.changedAt === DATE).length,
  failed: todays.filter((e) => e.last.status !== 'ok').length,
  robotsBlocked: todays.filter((e) => e.last.status.startsWith('robots-')).length,
  stillDue: list.entries.filter(isDue).length,
};

const runId = idFor.run(DATE, 'watch');
const old = g.nodes.get(runId);
if (results.length || !old) {
  const failures = todays.filter((e) => e.last.status !== 'ok').map((e) => `${e.last.status} ${e.url}`);
  writeNode({
    id: runId,
    type: 'run',
    agent: 'watch (scripts/watch/fetch.mjs)',
    model: 'none (deterministic script)',
    started: old?.started ?? startedAt,
    finished: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    status: budgetHit ? 'stopped' : 'succeeded',
    inputs: ['knowledge/watchlist.json'],
    outputs: Object.entries(counts).map(([k, v]) => `${k}: ${v}`),
    cost: `${requests} HTTP request(s) in the latest invocation (robots.txt included); limit ${LIMIT}`,
    notes: [
      budgetHit ? 'Time budget reached; remaining URLs stay due.' : '',
      failures.length ? `Not current: ${failures.slice(0, 20).join('; ')}${failures.length > 20 ? `; ... ${failures.length - 20} more` : ''}` : '',
    ].filter(Boolean).join(' ') || undefined,
    edges: produced.map((to) => ({ rel: 'PRODUCED', to })),
  });
}

// ---------------------------------------------------------------------------
// Summary (stdout, and --summary <file> for the PR body)
// ---------------------------------------------------------------------------
const lines = [
  `## Change detection ${DATE}`,
  '',
  `Checked today: ${counts.checked} (ok ${counts.ok}, changed ${counts.changed}, not current ${counts.failed}, robots ${counts.robotsBlocked}). Still due: ${counts.stillDue}. This invocation: ${results.length} URL(s), ${requests} request(s)${budgetHit ? ', time budget reached' : ''}.`,
  '',
];
const changedToday = todays.filter((e) => e.last.changedAt === DATE);
if (changedToday.length) {
  lines.push('### Changed pages', '', '| URL | Kind | Category | Title |', '|---|---|---|---|');
  for (const e of changedToday) lines.push(`| ${e.url} | ${e.kind} | ${e.category} | ${md(e.last.title, 80)} |`);
  lines.push('');
}
const failedToday = todays.filter((e) => e.last.status !== 'ok');
if (failedToday.length) {
  lines.push('### Not current (failed, blocked or gone)', '', '| URL | Status | Last OK |', '|---|---|---|');
  for (const e of failedToday) lines.push(`| ${e.url} | ${e.last.status} | ${e.last.okAt ?? 'never'} |`);
  lines.push('');
}
const summary = lines.join('\n');
console.log(`\n${summary}`);
const summaryFile = flag('summary');
if (summaryFile) writeFileSync(summaryFile, `${summary}\n`);
