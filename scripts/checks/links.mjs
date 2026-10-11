/**
 * links.mjs — internal link check over the built site (node scripts/checks/links.mjs).
 *
 *   Links      every href, src, srcset and poster in dist/*.html, url() in CSS,
 *              and the site URLs listed in llms.txt / llms-full.txt must
 *              resolve to a file in dist/
 *   Routes     no two files may serve the same route (a.html vs a/index.html,
 *              or paths that differ only in case)
 *   Redirects  every redirect stub must point to a page that exists; loops fail,
 *              chains warn
 *
 * Errors exit 1. Warnings (missing trailing slash, redirect chains) do not.
 * Read-only; runs even when knowledge/STOP exists. Usage: [--json]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, htmlPages, listFiles, redirectTarget, report, requireDist, resolvePath, stopNotice } from './dist.mjs';

stopNotice();
requireDist();

const errors = [];
const warnings = [];
const pages = htmlPages();
const files = listFiles();

// Turn a raw reference into an internal URL path, or null when it is external.
function internalPath(raw, baseUrl) {
  const v = String(raw ?? '').trim();
  if (!v || v.startsWith('#') || /^(mailto|tel|data|javascript|blob|sms):/i.test(v)) return null;
  if (/^\/\//.test(v)) return v.startsWith('//e-bambino.com') ? internalPath(`https:${v}`, baseUrl) : null;
  let u;
  try { u = new URL(v, `${SITE}${baseUrl}`); } catch { return { bad: v }; }
  if (u.origin !== SITE && u.origin !== SITE.replace('https:', 'http:')) return null;
  return u.pathname;
}

// Collect references per source file.
const refs = []; // { from, raw, path }
const add = (from, raw, baseUrl) => {
  const p = internalPath(raw, baseUrl);
  if (p) refs.push({ from, raw, path: p });
};
for (const page of pages) {
  for (const { name, attrs } of page.tags) {
    // Hints are not resources; canonical and hreflang are checked by seo.mjs.
    if (name === 'link' && /\b(preconnect|dns-prefetch|canonical|alternate)\b/i.test(attrs.rel ?? '')) continue;
    for (const a of ['href', 'src', 'poster']) if (attrs[a] !== undefined) add(page.file, attrs[a], page.url);
    for (const a of ['srcset', 'imagesrcset']) {
      for (const part of (attrs[a] ?? '').split(',')) add(page.file, part.trim().split(/\s+/)[0], page.url);
    }
  }
}
for (const css of files.filter((f) => f.endsWith('.css'))) {
  const base = `/${css.split('/').slice(0, -1).join('/')}${css.includes('/') ? '/' : ''}`;
  for (const m of readFileSync(join(DIST, css), 'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(css, m[1], base);
}
for (const txt of files.filter((f) => /^llms(-full)?\.txt$/.test(f))) {
  for (const m of readFileSync(join(DIST, txt), 'utf8').matchAll(/https:\/\/e-bambino\.com[^\s)\]>"']*/g)) add(txt, m[0], '/');
}

// 1. Broken links.
const broken = new Map(); // path -> Set(from)
for (const r of refs) {
  if (r.path.bad) { errors.push(`${r.from}: unparseable link "${r.path.bad}"`); continue; }
  const hit = resolvePath(r.path);
  if (!hit) {
    if (!broken.has(r.path)) broken.set(r.path, new Set());
    broken.get(r.path).add(r.from);
  } else if (!r.path.endsWith('/') && hit.endsWith('index.html')) {
    warnings.push(`${r.from}: link "${r.raw}" has no trailing slash (site uses trailingSlash: always)`);
  }
}
for (const [path, from] of [...broken].sort()) {
  const list = [...from].sort();
  errors.push(`broken link ${path} — from ${list.slice(0, 5).join(', ')}${list.length > 5 ? ` and ${list.length - 5} more` : ''}`);
}

// 2. Duplicate routes.
const routeKey = (f) => f.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/').toLowerCase();
const byRoute = new Map();
for (const f of files) {
  const k = routeKey(f);
  byRoute.set(k, [...(byRoute.get(k) ?? []), f]);
}
for (const [k, list] of byRoute) if (list.length > 1) errors.push(`duplicate route /${k}: ${list.join(', ')}`);

// 3. Redirect targets.
const stubs = new Map(pages.filter((p) => p.redirect).map((p) => [p.url, p]));
for (const stub of stubs.values()) {
  const raw = redirectTarget(stub.tags);
  const target = raw && internalPath(raw, stub.url);
  if (!raw) { errors.push(`${stub.file}: redirect stub without a target`); continue; }
  if (!target) { warnings.push(`${stub.file}: redirects off-site to ${raw}`); continue; }
  if (target === stub.url) { errors.push(`${stub.file}: redirects to itself`); continue; }
  if (!resolvePath(target)) { errors.push(`redirect ${stub.url} -> ${target}: target does not exist`); continue; }
  if (stubs.has(target)) {
    const next = internalPath(redirectTarget(stubs.get(target).tags), target);
    if (next === stub.url) errors.push(`redirect loop ${stub.url} <-> ${target}`);
    else warnings.push(`redirect chain ${stub.url} -> ${target} -> ${next}`);
  }
}

const summary = `${refs.length} references in ${pages.length} HTML pages, ${stubs.size} redirect stubs`;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ errors, warnings, summary }, null, 2));
  process.exit(errors.length ? 1 : 0);
}
process.exit(report('links', errors, warnings, summary));
