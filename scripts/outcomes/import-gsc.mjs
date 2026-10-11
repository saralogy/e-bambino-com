/**
 * import-gsc.mjs — import Google Search Console page performance as Outcome nodes.
 *
 * Mode A (CSV, the "Pages" tab export: Page, Clicks, Impressions, CTR, Position):
 *   node scripts/outcomes/import-gsc.mjs --csv Pages.csv --period 2026-09-07..2026-10-04
 * Mode B (API, searchanalytics.query with dimension page):
 *   GSC_SERVICE_ACCOUNT_JSON='{...}' GSC_SITE=sc-domain:e-bambino.com \
 *   node scripts/outcomes/import-gsc.mjs --api [--period P | --windows 2]
 *   Without --period it imports the latest complete anchored 28-day windows.
 *
 * Options: --dry-run (write nothing), --unmapped-out <file> (markdown list).
 *
 * Writes outcome:<page>-<period> (MEASURES the Page), one Run node, and the
 * released -> measured transition for opportunities whose page now has data.
 * The first Outcome of a page is its baseline. Re-running the same period
 * updates the same nodes. URLs that match no Page node are reported.
 * Numbers are stored exactly as Search Console gives them; nothing is estimated.
 */
import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { byType, idFor, indexGraph, loadNodes, neighbors, stopped, today, writeNode } from '../kg/lib.mjs';
import {
  completeWindows, normalizeUrl, pageIndex, parseArgs, parseCsv, parseNumber, parsePeriod, round,
} from './common.mjs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const ROW_LIMIT = 25000;

// ---------------------------------------------------------------------------
// Mode A: CSV
// ---------------------------------------------------------------------------

// Header names in English and German Search Console exports.
const HEADERS = {
  url: /^(top pages|pages?|url|häufigste seiten|seiten?)$/i,
  clicks: /^(clicks|klicks)$/i,
  impressions: /^(impressions|impressionen)$/i,
  ctr: /^(ctr|klickrate)$/i,
  position: /^(position|average position|durchschnittliche position)$/i,
};

/** Rows from a Pages CSV export. CTR is converted from percent to a 0–1 fraction. */
export function readCsvRows(text) {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error('CSV is empty');
  const col = {};
  header.forEach((h, i) => {
    for (const [k, re] of Object.entries(HEADERS)) if (re.test(h.trim()) && col[k] === undefined) col[k] = i;
  });
  const missing = Object.keys(HEADERS).filter((k) => col[k] === undefined);
  if (missing.length) throw new Error(`CSV header is missing ${missing.join(', ')} (got: ${header.join(', ')})`);
  const rows = [];
  const bad = [];
  for (const r of body) {
    const row = {
      url: r[col.url],
      clicks: parseNumber(r[col.clicks]),
      impressions: parseNumber(r[col.impressions]),
      ctr: parseNumber(r[col.ctr]) / 100,
      position: parseNumber(r[col.position]),
    };
    if ([row.clicks, row.impressions, row.ctr, row.position].some(Number.isNaN)) bad.push(r.join(','));
    else rows.push(row);
  }
  return { rows, bad };
}

// ---------------------------------------------------------------------------
// Mode B: API (JWT bearer grant, RS256, no dependencies)
// ---------------------------------------------------------------------------

const b64url = (s) => Buffer.from(s).toString('base64url');

/** Signed JWT assertion for a service account. */
export function signJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key).toString('base64url');
  return `${head}.${claims}.${sig}`;
}

/** fetch with up to 3 attempts, a 30 s timeout each, and exponential backoff on 429 and 5xx. */
async function fetchRetry(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
    if (res.ok || attempt === 3 || (res.status !== 429 && res.status < 500)) return res;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

async function accessToken(sa) {
  const res = await fetchRetry(sa.token_uri || TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(sa) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`token request failed: HTTP ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`);
  return body.access_token;
}

/** All page rows for one period, paging through startRow. */
async function queryPages(token, site, { start, end }) {
  const rows = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const res = await fetchRetry(`${API}/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page'], type: 'web', dataState: 'final', rowLimit: ROW_LIMIT, startRow }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`searchAnalytics.query failed: HTTP ${res.status} ${body.error?.message ?? ''}`);
    for (const r of body.rows ?? []) rows.push({ url: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
    if ((body.rows ?? []).length < ROW_LIMIT) return rows;
  }
}

// ---------------------------------------------------------------------------
// Mapping and writing
// ---------------------------------------------------------------------------

/**
 * Group rows by Page node. Several URLs for one page (http/https, www, query
 * strings) are merged: clicks and impressions summed, CTR recomputed,
 * position weighted by impressions. Returns { byPage, unmapped }.
 */
export function mapRows(rows, pages) {
  const index = pageIndex(pages);
  const byPage = new Map();
  const unmapped = [];
  for (const row of rows) {
    const { path, error } = normalizeUrl(row.url);
    const page = path && index.get(path);
    if (!page) { unmapped.push({ ...row, reason: error ?? `no Page node for ${path}` }); continue; }
    if (!byPage.has(page.id)) byPage.set(page.id, { page, rows: [] });
    byPage.get(page.id).rows.push(row);
  }
  return { byPage, unmapped };
}

function metrics(rows) {
  if (rows.length === 1) {
    const [r] = rows;
    return { clicks: r.clicks, impressions: r.impressions, ctr: round(r.ctr, 6), position: round(r.position, 2) };
  }
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const position = impressions ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr: impressions ? round(clicks / impressions, 6) : 0, position: round(position, 2) };
}

/** Write Outcome nodes for one period. Mutates `nodes` so later periods see earlier writes. */
function writeOutcomes(nodes, period, byPage, how, dryRun) {
  const written = [];
  const counts = { created: 0, updated: 0, unchanged: 0 };
  for (const { page, rows } of [...byPage.values()].sort((a, b) => a.page.id.localeCompare(b.page.id))) {
    const id = idFor.outcome(page.id, period);
    const existing = nodes.get(id);
    const others = [...nodes.values()].filter((n) => n.type === 'outcome' && n.page === page.id && n.id !== id);
    const node = {
      id,
      type: 'outcome',
      page: page.id,
      period,
      source: 'gsc',
      ...metrics(rows),
      baseline: existing ? existing.baseline : others.length === 0,
      notes: `${how}${rows.length > 1 ? `; merged from ${rows.length} URLs` : ''}`,
      edges: [{ rel: 'MEASURES', to: page.id }],
    };
    const result = dryRun ? (existing ? 'updated' : 'created') : writeNode(node);
    if (counts[result] !== undefined) counts[result]++;
    nodes.set(id, { ...existing, ...node });
    written.push(node);
  }
  return { written, counts };
}

/** released -> measured for opportunities whose implementing page has an Outcome. */
function markMeasured(nodes, dryRun) {
  const g = indexGraph(nodes);
  const measuredPages = new Set(byType(g, 'outcome').map((o) => o.page));
  const moved = [];
  for (const opp of byType(g, 'opportunity')) {
    if (opp.state !== 'released') continue;
    const pages = neighbors(g, opp.id, 'IMPLEMENTS', 'in').filter((p) => measuredPages.has(p.id));
    if (!pages.length) continue;
    const entry = { from: 'released', to: 'measured', by: 'measurement', date: today(), reason: `Outcome data imported for ${pages.map((p) => p.id).join(', ')}` };
    if (!dryRun) writeNode({ ...opp, state: 'measured', history: [...(opp.history ?? []), entry] });
    moved.push(opp.id);
  }
  return moved;
}

function unmappedMarkdown(period, unmapped) {
  const lines = [`### Unmapped Search Console URLs, ${period} (${unmapped.length})`, ''];
  if (!unmapped.length) return [...lines, 'None.', ''].join('\n');
  lines.push('| URL | Clicks | Impressions | Reason |', '|---|---:|---:|---|');
  for (const u of [...unmapped].sort((a, b) => b.impressions - a.impressions)) lines.push(`| ${u.url} | ${u.clicks} | ${u.impressions} | ${u.reason} |`);
  return [...lines, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  if (stopped()) {
    console.log('knowledge/STOP is present: outcome import halted, nothing written.');
    return;
  }
  const dryRun = Boolean(args['dry-run']);
  const batches = []; // [{ period, rows, how, input }]

  if (args.csv) {
    if (!args.period) throw new Error('--csv needs --period YYYY-MM-DD..YYYY-MM-DD (the date range of the export)');
    parsePeriod(args.period);
    const { rows, bad } = readCsvRows(readFileSync(args.csv, 'utf8'));
    for (const b of bad) console.log(`skipped unreadable CSV row: ${b}`);
    batches.push({ period: args.period, rows, how: `gsc csv export (${args.csv.split('/').pop()})`, input: args.csv });
    if (/(^|\/)fixtures\//.test(args.csv)) console.log('NOTE: fixture input. Delete the Outcome and Run nodes this writes; never commit them.');
  } else if (args.api) {
    const json = process.env.GSC_SERVICE_ACCOUNT_JSON;
    const site = process.env.GSC_SITE;
    if (!json || !site) {
      console.log(`Search Console API import skipped: ${!json ? 'GSC_SERVICE_ACCOUNT_JSON' : 'GSC_SITE'} is not set. See docs/system/MEASUREMENT.md.`);
      return;
    }
    const sa = JSON.parse(json);
    if (!sa.client_email || !sa.private_key) throw new Error('GSC_SERVICE_ACCOUNT_JSON lacks client_email or private_key');
    const periods = args.period ? [args.period] : completeWindows(today(), Number(args.windows ?? 2));
    const token = await accessToken(sa);
    for (const period of periods) {
      const rows = await queryPages(token, site, parsePeriod(period));
      batches.push({ period, rows, how: 'gsc api searchanalytics.query (dimension page, web, final)', input: `gsc-api:${site}` });
    }
  } else {
    console.log('Usage: import-gsc.mjs --csv <Pages.csv> --period YYYY-MM-DD..YYYY-MM-DD | --api [--period P] [--windows N] [--dry-run] [--unmapped-out file]');
    process.exitCode = 2;
    return;
  }

  const nodes = loadNodes();
  const pages = [...nodes.values()].filter((n) => n.type === 'page');
  const produced = [];
  const md = [];
  for (const { period, rows, how } of batches.sort((a, b) => a.period.localeCompare(b.period))) {
    const { days } = parsePeriod(period);
    const { byPage, unmapped } = mapRows(rows, pages);
    const { written, counts } = writeOutcomes(nodes, period, byPage, how, dryRun);
    produced.push(...written.map((o) => o.id));
    const baselines = written.filter((o) => o.baseline).length;
    console.log(`${period} (${days} days): ${rows.length} rows, ${byPage.size} pages mapped, ${unmapped.length} unmapped; outcomes ${JSON.stringify(counts)}, ${baselines} baseline(s)${dryRun ? ' [dry run]' : ''}`);
    if (days !== 28) console.log(`  note: ${days}-day period; reports compare 28-day windows only.`);
    for (const u of unmapped) console.log(`  unmapped: ${u.url} (${u.impressions} impressions) - ${u.reason}`);
    md.push(unmappedMarkdown(period, unmapped));
  }
  if (args['unmapped-out']) writeFileSync(args['unmapped-out'], md.join('\n'));

  const moved = markMeasured(nodes, dryRun);
  for (const id of moved) console.log(`opportunity ${id}: released -> measured`);
  if (dryRun || !produced.length) return;

  const date = today();
  const label = batches.map((b) => b.period).join('_');
  writeNode({
    id: idFor.run(date, `outcomes-import-${label}`),
    type: 'run',
    agent: 'outcomes import (scripts/outcomes/import-gsc.mjs)',
    model: 'none (deterministic script)',
    started: date,
    finished: date,
    status: 'succeeded',
    inputs: [...new Set(batches.map((b) => b.input))],
    outputs: [`${produced.length} outcome node(s)`, ...moved.map((id) => `${id} -> measured`)],
    cost: `${batches.length} period(s); ${args.api ? 'Search Console API calls' : 'local CSV, no network'}`,
    edges: [...produced, ...moved].map((to) => ({ rel: 'PRODUCED', to })),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`import-gsc: ${e.message}`);
    process.exit(1);
  });
}
