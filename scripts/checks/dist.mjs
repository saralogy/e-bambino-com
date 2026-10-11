/**
 * dist.mjs — shared helpers for the checks over the built site in dist/.
 *
 * Reads only. Dependency-free ESM: a small regex HTML reader is enough for the
 * markup Astro emits (no third-party parser, no network).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { ROOT, STOP_FILE, stopped } from '../kg/lib.mjs';

export const SITE = 'https://e-bambino.com';
// CHECK_DIST points the checks at another build folder (used to test the checks).
export const DIST = process.env.CHECK_DIST ? resolve(process.env.CHECK_DIST) : join(ROOT, 'dist');

/** Read-only checks still run when knowledge/STOP exists; they only say so. */
export function stopNotice() {
  if (stopped()) console.log(`Notice: ${relative(ROOT, STOP_FILE)} is present. Read-only check runs; automated jobs are halted.`);
}

/** Every file under dir, as paths relative to dir with forward slashes. */
export function listFiles(dir = DIST) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

/** URL path a dist file is served at: a/index.html -> /a/, 404.html -> /404.html. */
export function urlForFile(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Does a URL path resolve to a file in dist? Returns the file or null. */
export function resolvePath(path, dir = DIST) {
  let p;
  try { p = decodeURIComponent(path); } catch { p = path; }
  const clean = p.replace(/^\/+/, '');
  const candidates = p.endsWith('/') ? [`${clean}index.html`] : [clean, `${clean}/index.html`];
  for (const c of candidates) {
    const f = join(dir, c);
    if (existsSync(f) && statSync(f).isFile()) return c;
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
export const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (ENTITIES[e.toLowerCase()] !== undefined) return ENTITIES[e.toLowerCase()];
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return m;
});

/** Parse the attributes of one tag's attribute string. Keys are lowercased. */
export function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g)) {
    attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** Markup with comments, scripts and styles removed (their bodies hold no real tags). */
const stripRaw = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/gi, '<$1$2></$1>');

/** All start tags as { name, attrs }. */
export function tags(html) {
  return [...stripRaw(html).matchAll(/<([a-zA-Z][\w-]*)(\s[^>]*)?>/g)]
    .map((m) => ({ name: m[1].toLowerCase(), attrs: parseAttrs(m[2] ?? '') }));
}

/** Inner text of every <tag>…</tag> (scripts and styles stripped). */
export function elementTexts(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...stripRaw(html).matchAll(re)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
}

/** Raw bodies of <script type="application/ld+json"> blocks. */
export const jsonLdBlocks = (html) => [...html.replace(/<!--[\s\S]*?-->/g, '')
  .matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((m) => /application\/ld\+json/i.test(parseAttrs(m[1]).type ?? ''))
  .map((m) => m[2]);

export const isRedirectStub = (t) => t.some((x) => x.name === 'meta' && (x.attrs['http-equiv'] ?? '').toLowerCase() === 'refresh');
export const isNoindex = (t) => t.some((x) => x.name === 'meta' && (x.attrs.name ?? '').toLowerCase() === 'robots' && /noindex/i.test(x.attrs.content ?? ''));
export const redirectTarget = (t) => {
  const meta = t.find((x) => x.name === 'meta' && (x.attrs['http-equiv'] ?? '').toLowerCase() === 'refresh');
  return meta?.attrs.content?.match(/url=(.+)$/i)?.[1].trim();
};

/** Every HTML page in dist with its URL, markup and parsed tags. */
export function htmlPages(dir = DIST) {
  return listFiles(dir).filter((f) => f.endsWith('.html')).map((file) => {
    const html = readFileSync(join(dir, file), 'utf8');
    const t = tags(html);
    return { file, url: urlForFile(file), html, tags: t, redirect: isRedirectStub(t), noindex: isNoindex(t) };
  });
}

/** Fail early with a clear message when there is no build. */
export function requireDist() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/ has no build. Run `npm run build` first.');
    process.exit(2);
  }
}

/** Print errors and warnings in two lists; return the exit code. */
export function report(name, errors, warnings, summary = '') {
  console.log(`${name}: ${errors.length} error(s), ${warnings.length} warning(s)${summary ? ` — ${summary}` : ''}`);
  if (errors.length) console.log(`\nErrors:\n${errors.map((e) => `  ✗ ${e}`).join('\n')}`);
  if (warnings.length) console.log(`\nWarnings:\n${warnings.map((w) => `  ! ${w}`).join('\n')}`);
  return errors.length ? 1 : 0;
}
