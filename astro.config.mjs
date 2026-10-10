import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Wrap every markdown table in a horizontally scrollable region so wide tables
// never push the page wider than the phone screen.
function rehypeScrollTables() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'table') {
          return {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-scroll'], role: 'region', ariaLabel: 'Table', tabIndex: 0 },
            children: [child],
          };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}

// The German site used to live at the root. English is now the root and German
// moved to /de/, so every old German URL redirects to its /de/ address.
function frontmatter(file) {
  const m = readFileSync(file, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
  const data = {};
  if (!m) return data;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^['"](.*)['"]$/, '$1');
  }
  return data;
}

function mdFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
}

function legacyGermanRedirects() {
  const r = {};
  const add = (from) => (r[from] = `/de${from}`);
  for (const p of ['/fragen/', '/namen/', '/checklisten/', '/finanz/', '/ratgeber/', '/ueber-uns/', '/quellen/', '/impressum/', '/datenschutz/']) add(p);
  for (const c of ['namen', 'checklisten', 'finanz', 'ratgeber']) {
    for (const f of mdFiles(`./src/content/${c}/de`)) add(`/${c}/${f.replace(/\.md$/, '')}/`);
  }
  const hubs = new Set();
  for (const f of mdFiles('./src/content/fragen/de')) {
    const d = frontmatter(`./src/content/fragen/de/${f}`);
    if (!d.hub || !d.slug) continue;
    // Only pages that were public: YMYL pages without a reviewer never shipped.
    if (d.ymyl === 'true' && !d.reviewedBy) continue;
    hubs.add(d.hub);
    add(`/${d.hub}/${d.slug}/`);
  }
  for (const h of hubs) add(`/${h}/`);
  return r;
}

// https://astro.build/config
export default defineConfig({
  site: 'https://e-bambino.com',
  trailingSlash: 'always',
  redirects: {
    ...legacyGermanRedirects(),
    // Typo URL of the vacation checklist (urlaugs -> urlaubs), kept alive for old links.
    '/de/checklisten/urlaugs-checkliste/': '/de/checklisten/urlaubs-checkliste/',
    '/checklisten/urlaugs-checkliste/': '/de/checklisten/urlaubs-checkliste/',
  },
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      i18n: { defaultLocale: 'en', locales: { en: 'en', de: 'de' } },
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeScrollTables],
    shikiConfig: { theme: 'github-dark' },
  },
});
