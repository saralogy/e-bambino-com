// make-og.mjs — renders the static brand images with Playwright:
//   public/og-default.png  1200x630 social share image
//   public/logo.png        512x512 logo used in Organization JSON-LD
//
// Run:  NODE_PATH=$(npm root -g) node scripts/make-og.mjs
// (Playwright is installed globally; require() honours NODE_PATH, import does not.)

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontFile = join(root, 'public/fonts/bricolage-grotesque-latin.woff2');
// Embed the self-hosted display font as a data URI: no network, no CDN, no file:// access issues.
const fontData = readFileSync(fontFile).toString('base64');

const fontFace = `
@font-face {
  font-family: 'Bricolage Grotesque';
  src: url(data:font/woff2;base64,${fontData}) format('woff2');
  font-weight: 200 800;
  font-style: normal;
}`;

const ULTRAMARINE = '#2438F5';
const LIMONE = '#D9F24A';
const MANDARIN = '#FF6A1A';

const ogHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontFace}
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body {
  background: ${ULTRAMARINE};
  font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif;
  color: #fff;
  position: relative;
}
.accent {
  position: absolute; width: 150px; height: 150px; border-radius: 50%;
  background: ${MANDARIN}; right: 110px; top: 90px;
}
.wrap {
  position: absolute; left: 96px; top: 0; bottom: 0; right: 96px;
  display: flex; flex-direction: column; justify-content: center;
}
h1 { margin: 0; font-size: 176px; font-weight: 800; letter-spacing: -0.035em; line-height: 1; }
p { margin: 28px 0 0; font-size: 50px; font-weight: 600; color: ${LIMONE}; line-height: 1.2; }
</style></head>
<body>
  <div class="accent"></div>
  <div class="wrap">
    <h1>e-bambino</h1>
    <p>Everything for baby &amp; mom in one place</p>
  </div>
</body></html>`;

const logoHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontFace}
html, body { margin: 0; width: 512px; height: 512px; overflow: hidden; }
body {
  background: ${ULTRAMARINE};
  font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif;
  color: #fff;
  position: relative;
}
.letter {
  position: absolute; left: 0; right: 0; top: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 380px; font-weight: 800; line-height: 1; padding-bottom: 30px; box-sizing: border-box;
}
.dot {
  position: absolute; width: 74px; height: 74px; border-radius: 50%;
  background: ${MANDARIN}; right: 70px; top: 80px;
}
</style></head>
<body>
  <div class="letter">e</div>
  <div class="dot"></div>
</body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  await page.setContent(ogHtml, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public/og-default.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });

  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(logoHtml, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public/logo.png'), clip: { x: 0, y: 0, width: 512, height: 512 } });

  console.log('wrote public/og-default.png (1200x630) and public/logo.png (512x512)');
} finally {
  await browser.close();
}
