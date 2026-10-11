/**
 * seo.mjs — technical SEO check over the built site (node scripts/checks/seo.mjs).
 *
 *   Pages      every indexable page (not noindex, not a redirect stub) has
 *              exactly one canonical (absolute, https://e-bambino.com, trailing
 *              slash), a title, a meta description and exactly one h1
 *   hreflang   alternates point to existing pages that link back (reciprocal)
 *   Sitemap    lists every indexable page, no noindex page, no redirect stub,
 *              nothing missing from dist/
 *   robots     the * group still allows / and the sitemap is listed
 *   JSON-LD    every block parses and has @context; Article has headline,
 *              datePublished, author, publisher; BreadcrumbList positions are
 *              1..n; an @id ending in #organization is defined on the page
 *
 * Errors exit 1; warnings are listed separately and never fail the run.
 * Read-only; runs even when knowledge/STOP exists. Usage: [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, elementTexts, htmlPages, report, requireDist, resolvePath, stopNotice } from './dist.mjs';

stopNotice();
requireDist();

const errors = [];
const warnings = [];
const pages = htmlPages();
const byUrl = new Map(pages.map((p) => [p.url, p]));
const indexable = pages.filter((p) => !p.redirect && !p.noindex);

const sitePath = (href) => (href?.startsWith(`${SITE}/`) ? href.slice(SITE.length) : null);
const linksOf = (page, rel) => page.tags.filter((t) => t.name === 'link' && (t.attrs.rel ?? '').toLowerCase().split(/\s+/).includes(rel));
const metaContent = (page, name) => page.tags.filter((t) => t.name === 'meta' && (t.attrs.name ?? '').toLowerCase() === name).map((t) => t.attrs.content ?? '');
const canonicalOf = (page) => linksOf(page, 'canonical')[0]?.attrs.href;

// ---------------------------------------------------------------------------
// 1. Canonical, title, description, h1
// ---------------------------------------------------------------------------
const canonicalOwners = new Map();
for (const p of indexable) {
  const at = p.url;
  const canon = linksOf(p, 'canonical').map((l) => l.attrs.href ?? '');
  if (canon.length !== 1) errors.push(`${at}: ${canon.length} canonical links (expected exactly 1)`);
  for (const c of canon) {
    if (!c.startsWith(`${SITE}/`)) errors.push(`${at}: canonical "${c}" is not absolute on ${SITE}`);
    else if (!new URL(c).pathname.endsWith('/') || /[?#]/.test(c)) errors.push(`${at}: canonical "${c}" must end with a slash and carry no query or hash`);
    else if (!resolvePath(new URL(c).pathname)) errors.push(`${at}: canonical "${c}" does not exist in dist/`);
    else if (sitePath(c) !== at) warnings.push(`${at}: canonical points elsewhere (${c}) although the page is indexable`);
  }
  if (canon.length === 1) canonicalOwners.set(canon[0], [...(canonicalOwners.get(canon[0]) ?? []), at]);

  const titles = elementTexts(p.html, 'title');
  if (titles.length !== 1 || !titles[0]) errors.push(`${at}: ${titles.length ? 'empty title' : 'no title'}${titles.length > 1 ? ` (${titles.length} titles)` : ''}`);
  const desc = metaContent(p, 'description');
  if (desc.length !== 1 || !desc[0].trim()) errors.push(`${at}: ${desc.length > 1 ? `${desc.length} meta descriptions` : 'missing or empty meta description'}`);
  else if (desc[0].trim().length < 50 || desc[0].trim().length > 160) warnings.push(`${at}: meta description is ${desc[0].trim().length} characters (aim for 50–160)`);
  const h1 = elementTexts(p.html, 'h1');
  if (h1.length !== 1) errors.push(`${at}: ${h1.length} h1 elements (expected exactly 1)`);
  else if (!h1[0]) errors.push(`${at}: empty h1`);
}
for (const [c, owners] of canonicalOwners) if (owners.length > 1) errors.push(`duplicate canonical ${c} on ${owners.join(', ')}`);
for (const p of pages.filter((x) => x.noindex && !x.redirect)) {
  const c = canonicalOf(p);
  if (c && sitePath(c) && !resolvePath(new URL(c).pathname)) warnings.push(`${p.url} (noindex): canonical ${c} does not exist in dist/`);
}

// ---------------------------------------------------------------------------
// 2. hreflang reciprocity
// ---------------------------------------------------------------------------
const alternates = (p) => linksOf(p, 'alternate').filter((l) => l.attrs.hreflang).map((l) => ({ lang: l.attrs.hreflang, href: l.attrs.href ?? '' }));
let hreflangPages = 0;
for (const p of indexable) {
  const alts = alternates(p);
  if (!alts.length) continue;
  hreflangPages++;
  const self = canonicalOf(p);
  const langs = alts.map((a) => a.lang);
  for (const l of new Set(langs)) if (langs.filter((x) => x === l).length > 1) errors.push(`${p.url}: hreflang "${l}" appears more than once`);
  if (!langs.includes('x-default')) warnings.push(`${p.url}: hreflang set has no x-default`);
  const myLang = alts.find((x) => x.href === self && x.lang !== 'x-default')?.lang;
  if (!myLang) { errors.push(`${p.url}: hreflang set does not include the page itself (${self})`); continue; }
  for (const a of alts) {
    const path = sitePath(a.href);
    if (!path) { errors.push(`${p.url}: hreflang "${a.lang}" href "${a.href}" is not absolute on ${SITE}`); continue; }
    if (a.href === self) continue;
    const other = byUrl.get(path);
    if (!other || other.redirect) { errors.push(`${p.url}: hreflang "${a.lang}" -> ${path} ${other ? 'is a redirect stub' : 'does not exist'}`); continue; }
    if (other.noindex) { errors.push(`${p.url}: hreflang "${a.lang}" -> ${path} is noindex`); continue; }
    if (a.lang === 'x-default') continue;
    const back = alternates(other);
    if (!back.some((b) => b.href === self && b.lang === myLang)) errors.push(`${p.url}: hreflang "${a.lang}" -> ${path} does not link back with hreflang "${myLang}"`);
  }
}

// ---------------------------------------------------------------------------
// 3. Sitemap
// ---------------------------------------------------------------------------
const locs = (file) => (existsSync(join(DIST, file)) ? [...readFileSync(join(DIST, file), 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]) : null);
const index = locs('sitemap-index.xml');
const inSitemap = new Set();
if (!index) errors.push('sitemap-index.xml is missing from dist/');
else {
  for (const loc of index) {
    const path = sitePath(loc);
    const urls = path && locs(path.slice(1));
    if (!urls) { errors.push(`sitemap-index.xml lists ${loc}, which is not in dist/`); continue; }
    urls.forEach((u) => inSitemap.add(u));
  }
  for (const p of indexable) if (!inSitemap.has(`${SITE}${p.url}`)) errors.push(`sitemap is missing indexable page ${p.url}`);
  for (const u of inSitemap) {
    const path = sitePath(u);
    const p = path && byUrl.get(path);
    if (!p) errors.push(`sitemap lists ${u}, which is not an HTML page in dist/`);
    else if (p.redirect) errors.push(`sitemap lists redirect stub ${u}`);
    else if (p.noindex) errors.push(`sitemap lists noindex page ${u}`);
  }
}

// ---------------------------------------------------------------------------
// 4. robots.txt
// ---------------------------------------------------------------------------
const robotsFile = join(DIST, 'robots.txt');
if (!existsSync(robotsFile)) errors.push('robots.txt is missing from dist/');
else {
  const lines = readFileSync(robotsFile, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  const groups = [];
  let cur = null;
  for (const l of lines) {
    const [k, ...rest] = l.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val);
    } else if ((key === 'allow' || key === 'disallow') && cur) cur.rules.push({ key, val });
  }
  const star = groups.filter((g) => g.agents.includes('*'));
  if (!star.length) errors.push('robots.txt has no "User-agent: *" group');
  if (star.length > 1) errors.push('robots.txt has more than one "User-agent: *" group');
  for (const g of groups) {
    if (g.rules.some((r) => r.key === 'disallow' && r.val === '/') && !g.rules.some((r) => r.key === 'allow' && r.val === '/')) {
      (g.agents.includes('*') ? errors : warnings).push(`robots.txt disallows / for ${g.agents.join(', ')}`);
    }
  }
  const maps = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.slice(l.indexOf(':') + 1).trim());
  if (!maps.length) errors.push('robots.txt does not list a sitemap');
  for (const m of maps) if (!sitePath(m) || !resolvePath(sitePath(m))) errors.push(`robots.txt lists sitemap ${m}, which is not in dist/`);
}

// ---------------------------------------------------------------------------
// 5. JSON-LD
// ---------------------------------------------------------------------------
const typesOf = (n) => [].concat(n?.['@type'] ?? []);
const ARTICLE = ['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'MedicalWebPage'];
let blocks = 0;
for (const p of pages.filter((x) => !x.redirect)) {
  const nodes = []; // top-level and @graph items
  const defined = new Set();
  const referenced = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    if (v['@id']) (Object.keys(v).length === 1 ? referenced : defined).add(v['@id']);
    Object.values(v).forEach(walk);
  };
  for (const raw of [...p.html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])) {
    blocks++;
    let data;
    try { data = JSON.parse(raw); } catch (e) { errors.push(`${p.url}: JSON-LD does not parse (${e.message})`); continue; }
    for (const item of [].concat(data)) {
      if (!item?.['@context']) errors.push(`${p.url}: JSON-LD block without @context`);
      nodes.push(...(item?.['@graph'] ? [].concat(item['@graph']) : [item]));
    }
    walk(data);
  }
  for (const n of nodes) {
    const t = typesOf(n);
    if (t.some((x) => ARTICLE.includes(x))) {
      for (const f of ['headline', 'datePublished', 'author', 'publisher']) if (!n[f]) errors.push(`${p.url}: ${t.join('/')} JSON-LD missing "${f}"`);
      if (n.datePublished && Number.isNaN(Date.parse(n.datePublished))) errors.push(`${p.url}: datePublished "${n.datePublished}" is not a date`);
    }
    if (t.includes('BreadcrumbList')) {
      const items = [].concat(n.itemListElement ?? []);
      if (!items.length) errors.push(`${p.url}: BreadcrumbList has no items`);
      items.forEach((it, i) => {
        if (Number(it?.position) !== i + 1) errors.push(`${p.url}: BreadcrumbList item ${i + 1} has position ${it?.position} (expected ${i + 1})`);
        const item = typeof it?.item === 'string' ? it.item : it?.item?.['@id'];
        const path = sitePath(item);
        if (item && path && !resolvePath(new URL(item).pathname)) errors.push(`${p.url}: BreadcrumbList item ${i + 1} -> ${item} does not exist in dist/`);
      });
    }
  }
  for (const ref of referenced) {
    if (ref.endsWith('#organization') && !defined.has(ref)) errors.push(`${p.url}: JSON-LD references ${ref} but no node on the page defines it`);
  }
}

const summary = `${pages.length} HTML pages: ${indexable.length} indexable, ${pages.filter((p) => p.redirect).length} redirect stubs, ${pages.filter((p) => p.noindex && !p.redirect).length} noindex; ${hreflangPages} with hreflang; ${inSitemap.size} sitemap URLs; ${blocks} JSON-LD blocks`;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ errors, warnings, summary }, null, 2));
  process.exit(errors.length ? 1 : 0);
}
process.exit(report('seo', errors, warnings, summary));
