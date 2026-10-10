import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

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
            properties: { className: ['table-scroll'], role: 'region', ariaLabel: 'Tabelle', tabIndex: 0 },
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

// https://astro.build/config
export default defineConfig({
  site: 'https://e-bambino.com',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeScrollTables],
    shikiConfig: { theme: 'github-dark' },
  },
});