/**
 * common.mjs — shared helpers for the outcome scripts (import, report, calibrate).
 *
 * Periods are "YYYY-MM-DD..YYYY-MM-DD" (both days inclusive). The default
 * measurement window is 28 days, anchored to WINDOW_EPOCH (a Monday) so every
 * window holds four of each weekday and consecutive windows never overlap.
 */
import { addDays } from '../kg/lib.mjs';

export const WINDOW_DAYS = 28;
export const WINDOW_EPOCH = '2026-01-05'; // Monday; window k starts at epoch + 28k
export const GSC_LAG_DAYS = 3; // Search Console data is final after about 2–3 days
export const SITE_HOSTS = ['e-bambino.com', 'www.e-bambino.com'];

const DAY = 86400000;
const PERIOD = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

/** Days between two YYYY-MM-DD dates (b - a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Parse "start..end". Returns { start, end, days } or throws. */
export function parsePeriod(p) {
  const m = String(p ?? '').match(PERIOD);
  if (!m) throw new Error(`period must be YYYY-MM-DD..YYYY-MM-DD, got "${p}"`);
  const [, start, end] = m;
  if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) throw new Error(`invalid date in period "${p}"`);
  const days = daysBetween(start, end) + 1;
  if (days < 1) throw new Error(`period "${p}" ends before it starts`);
  return { start, end, days };
}

export const formatPeriod = (start, end) => `${start}..${end}`;

/** The anchored 28-day window with index k. */
export function windowAt(k) {
  const start = addDays(WINDOW_EPOCH, k * WINDOW_DAYS);
  return formatPeriod(start, addDays(start, WINDOW_DAYS - 1));
}

/** The latest anchored window whose data is final on `date`, and the `count - 1` windows before it (oldest first). */
export function completeWindows(date, count = 1) {
  const lastFinal = addDays(date, -GSC_LAG_DAYS);
  const k = Math.floor((daysBetween(WINDOW_EPOCH, lastFinal) + 1) / WINDOW_DAYS) - 1;
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(windowAt(k - i));
  return out;
}

/**
 * Normalize a Search Console URL to a site path like "/clothing/x/".
 * Returns { path } or { error } (foreign host, unparseable).
 */
export function normalizeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return { error: 'not a URL' };
  }
  const host = u.hostname.toLowerCase();
  if (!SITE_HOSTS.includes(host)) return { error: `foreign host ${host}` };
  let path = decodeURIComponent(u.pathname).replace(/\/index\.html?$/, '/').replace(/\/{2,}/g, '/');
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  return { path: path.toLowerCase() };
}

/** Map of normalized URL path -> Page node. */
export function pageIndex(pages) {
  const m = new Map();
  for (const p of pages) m.set(String(p.url).toLowerCase(), p);
  return m;
}

/** Minimal CSV parser: commas, quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** Parse a number from a GSC export cell: "1,234", "3.4%", "3,4 %" (German), "". */
export function parseNumber(cell) {
  let v = String(cell ?? '').replace(/[%\s ]/g, '');
  if (v === '') return NaN;
  if (v.includes(',') && v.includes('.')) v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  else if (v.includes(',')) v =/,\d{3}$/.test(v) && !/^0,/.test(v) ? v.replace(/,/g, '') : v.replace(',', '.');
  else v = v.replace(/,/g, '');
  return Number(v);
}

/** Round to n decimals without float noise. */
export const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;

/** Tiny argv parser: --flag, --key value, --key=value. Positional args in _. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split(/=(.*)/s);
    if (v !== undefined) out[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

/** Outcomes of one page, oldest period first. */
export function outcomesByPage(outcomes) {
  const m = new Map();
  for (const o of outcomes) {
    if (!m.has(o.page)) m.set(o.page, []);
    m.get(o.page).push(o);
  }
  for (const list of m.values()) list.sort((a, b) => a.period.localeCompare(b.period));
  return m;
}
