/**
 * selftest.mjs — offline end-to-end test of the watch jobs.
 *
 * Copies scripts/ and .claude/agents into a temp root with a tiny graph whose
 * URLs point at a local http server on 127.0.0.1, then runs the real scripts:
 * build-watchlist, fetch --dry-run, a baseline fetch, a same-day re-run, a
 * fetch a week later after the page changed, revalidate, kg:check and STOP.
 * The repository's own knowledge/ is never touched.
 *
 * Usage: node scripts/watch/selftest.mjs   (exit 1 on the first failed assertion)
 */
import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ROOT } from '../kg/lib.mjs';
import { sameSite } from './common.mjs';

const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'watch-selftest-'));
let version = 1;
let hits = [];

// --- Local server: robots.txt (behind a same-site redirect), one page in two versions, a blocked page, a 404.
const page = (v) => `<!doctype html><html><head><title>Bath guide v${v}</title><script>var t=${Date.now()}</script></head>
<body><nav>Menu ${Math.random()}</nav><main><h1>Bathing</h1><p>${v === 1 ? 'Keep water warm.' : 'Keep water warm, about 37 &deg;C.'}</p></main>
<footer>Rendered ${new Date().toISOString()}</footer></body></html>`;
const server = createServer((req, res) => {
  hits.push({ path: req.url, ua: req.headers['user-agent'] });
  if (req.url === '/robots.txt') { res.statusCode = 301; res.setHeader('location', '/site/robots.txt'); return res.end(); }
  if (req.url === '/site/robots.txt') return res.end('User-agent: *\nDisallow: /private/\n');
  if (req.url === '/guide') { res.setHeader('content-type', 'text/html'); return res.end(page(version)); }
  if (req.url === '/private/page') return res.end('secret');
  if (req.url === '/flaky') { res.statusCode = 503; return res.end('busy'); }
  res.statusCode = 404;
  res.end('not found');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- Temp root with the real scripts and a minimal graph.
cpSync(join(ROOT, 'scripts'), join(tmp, 'scripts'), { recursive: true });
cpSync(join(ROOT, '.claude/agents'), join(tmp, '.claude/agents'), { recursive: true });
const write = (rel, obj) => {
  const file = join(tmp, 'knowledge/nodes', rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
};
const ev = (id, path) => ({
  id: `evidence:${id}`, type: 'evidence', url: `${base}${path}`, accessed: '2026-10-01', retrievalMethod: 'search-snippet',
  sourceQuality: 'primary-authority', revalidateBy: '2026-10-05', sourceKey: 'localtest', edges: [{ rel: 'FROM', to: 'source:localtest' }],
});
write('source/localtest.json', { id: 'source:localtest', type: 'source', key: 'localtest', name: 'Local test', url: base, jurisdiction: 'unknown', authority: 'official', registered: false, status: 'active', edges: [] });
write('evidence/aaa.json', ev('aaa', '/guide'));
write('evidence/bbb.json', ev('bbb', '/private/page'));
write('evidence/ccc.json', ev('ccc', '/missing'));
write('evidence/ddd.json', ev('ddd', '/flaky'));
write('claim/c1.json', { id: 'claim:c1', type: 'claim', text: 'Bath water should be warm.', kind: 'fact', ymyl: true, confidence: 'medium', status: 'supported', edges: [{ rel: 'SUPPORTED_BY', to: 'evidence:aaa' }] });

const env = { ...process.env, WATCH_TEST_HOST_DELAY_MS: '50' };
// Async: the server lives in this process and must keep answering.
const exec = promisify(execFile);
const run = async (script, ...args) => (await exec('node', [join(tmp, 'scripts', script), ...args], { cwd: tmp, env })).stdout;
const snapshot = () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [`${join(d, e.name)}\n${readFileSync(join(d, e.name), 'utf8')}`]));
  return walk(join(tmp, 'knowledge')).sort().join('\n');
};
const watch = () => JSON.parse(readFileSync(join(tmp, 'knowledge/watchlist.json'), 'utf8')).entries;
const node = (dir, id) => JSON.parse(readFileSync(join(tmp, 'knowledge/nodes', dir, `${id}.json`), 'utf8'));
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const D1 = '2026-10-12';

try {
  ok(sameSite('https://www.cdc.gov/x', 'https://cdc.gov/robots.txt') && !sameSite('https://cdc.gov/', 'https://example.org/'), 'www and apex count as one site');
  await run('watch/build-watchlist.mjs');
  const urls = watch().map((e) => e.url);
  ok(urls.length === 5 && urls.every((u) => u.startsWith(base)), `watchlist has 5 local URLs (${urls.length})`);
  ok(watch().every((e) => e.kind === 'source' && e.frequency === 'monthly'), 'entries are kind source, frequency monthly');

  let before = snapshot();
  hits = [];
  console.log((await run('watch/fetch.mjs', '--dry-run', '--today', D1)).split('\n')[0]);
  ok(hits.length === 0 && snapshot() === before, 'dry run makes no requests and writes nothing');

  await run('watch/fetch.mjs', '--today', D1);
  const s1 = Object.fromEntries(watch().map((e) => [e.url.slice(base.length), e.last]));
  ok(s1['/guide']?.status === 'ok' && /^sha256:[0-9a-f]{64}$/.test(s1['/guide'].contentHash), 'baseline: /guide ok with sha256 hash');
  ok(s1['/guide']?.title === 'Bath guide v1', 'title stored');
  ok(s1['/private/page']?.status === 'robots-disallowed', 'robots.txt Disallow honored (robots.txt reached through a 301)');
  ok(hits.filter((h) => h.path === '/site/robots.txt').length === 1, 'redirected robots.txt followed once, not treated as disallow-all');
  ok(s1['/missing']?.status === 'http-404' && !s1['/missing'].contentHash, '404 recorded, no hash, not current');
  ok(s1['/flaky']?.status === 'http-503' && s1['/flaky'].attempts === 3, '503 retried with backoff, 3 attempts, recorded as not current');
  ok(!hits.some((h) => h.path === '/private/page'), 'blocked URL was never requested');
  ok(hits.every((h) => h.ua.startsWith('e-bambino-watch/1.0')), 'every request sends our user agent');
  ok(hits.filter((h) => h.path === '/robots.txt').length === 1, 'robots.txt fetched once per host');
  ok(!JSON.stringify(watch()).includes('Keep water warm'), 'no page text stored');
  ok(!existsSync(join(tmp, 'knowledge/nodes/change')), 'baseline writes no ChangeEvent');
  ok(node('run', '2026-10-12-watch').outputs.includes('checked: 5'), 'Run node records the day');

  // Same day again, even with new noise in script/nav/footer: nothing due, no diff.
  before = snapshot();
  hits = [];
  await run('watch/fetch.mjs', '--today', D1);
  ok(hits.length === 0 && snapshot() === before, 'same-day re-run: no requests, no diff');

  // A week later the page is unchanged except for noise: no ChangeEvent.
  hits = [];
  await run('watch/fetch.mjs', '--today', '2026-11-10');
  ok(!existsSync(join(tmp, 'knowledge/nodes/change')), 'script/nav/footer noise does not count as a change');

  // The main text changes.
  version = 2;
  await run('watch/fetch.mjs', '--today', '2026-12-10', '--summary', join(tmp, 'summary.md'));
  const changes = existsSync(join(tmp, 'knowledge/nodes/change')) ? readdirSync(join(tmp, 'knowledge/nodes/change')) : [];
  ok(changes.length === 1, `one ChangeEvent written (${changes.join(', ')})`);
  const ch = changes.length ? node('change', changes[0].replace(/\.json$/, '')) : {};
  ok(ch.edges?.some((e) => e.rel === 'AFFECTS' && e.to === 'evidence:aaa'), 'ChangeEvent AFFECTS the evidence');
  ok(ch.oldHash && ch.newHash && ch.oldHash !== ch.newHash, 'old and new hash recorded');
  ok(node('claim', 'c1').revalidate === ch.id, 'claim marked for revalidation');
  ok(node('run', '2026-12-10-watch').edges.some((e) => e.rel === 'PRODUCED' && e.to === ch.id), 'Run PRODUCED the ChangeEvent');
  ok(readFileSync(join(tmp, 'summary.md'), 'utf8').includes('### Changed pages'), 'summary file lists the change');

  const rv = await run('watch/revalidate.mjs', '--today', '2026-12-10');
  ok(rv.includes('claim:c1') && rv.includes('http-404') && rv.includes('robots-disallowed') && rv.includes('evidence:aaa'), 'revalidate lists flagged claim, expired evidence and failed URLs');

  const check = await run('kg/check.mjs');
  ok(/ 0 error\(s\)/.test(check), 'kg:check: 0 errors on the result');

  writeFileSync(join(tmp, 'knowledge/STOP'), 'selftest');
  before = snapshot();
  hits = [];
  const out = await run('watch/fetch.mjs', '--today', '2027-02-10');
  ok(out.includes('STOP') && hits.length === 0 && snapshot() === before, 'knowledge/STOP: fetch halts without requests or writes');
} finally {
  server.close();
  if (!process.argv.includes('--keep')) rmSync(tmp, { recursive: true, force: true });
  else console.log(`kept ${tmp}`);
}
console.log(failed ? `\n${failed} assertion(s) failed` : '\nall assertions passed');
process.exit(failed ? 1 : 0);
