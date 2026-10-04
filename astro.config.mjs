import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

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
    shikiConfig: { theme: 'github-dark' },
  },
});