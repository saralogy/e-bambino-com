/**
 * release-report.mjs — markdown release decision for a change set.
 *
 *   TECHNICAL  build, audit, links, seo, kg:check: pass, fail or blocked
 *   EDITORIAL  content pages changed vs the base (default origin/main): shipgate
 *              status before and after, and whether a YMYL page still waits for
 *              a named human reviewer
 *
 * Passing technical checks never authorizes publishing held content; the report
 * says so in every run. Writes to stdout and appends to $GITHUB_STEP_SUMMARY
 * when set. Read-only; always exits 0 (the CI gate step decides pass/fail).
 *
 * Check results come from the environment (GitHub step outcomes):
 *   CHECK_BUILD, CHECK_AUDIT, CHECK_KG, CHECK_LINKS, CHECK_SEO
 *   = success | failure | cancelled | skipped
 * or, locally, from running the checks: --run
 * Base for the diff: --base <ref> or RELEASE_BASE (default origin/main).
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idFor, get, loadGraph, neighbors, ROOT, stopped } from '../kg/lib.mjs';

const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const BASE = argValue('--base') || process.env.RELEASE_BASE || 'origin/main';

// ---------------------------------------------------------------------------
// Technical checks
// ---------------------------------------------------------------------------
const CHECKS = [
  { key: 'build', env: 'CHECK_BUILD', label: 'Build (`npm run build`)', cmd: ['npm', ['run', 'build']] },
  { key: 'audit', env: 'CHECK_AUDIT', label: 'Content audit (`npm run audit`)', cmd: ['npm', ['run', 'audit']] },
  { key: 'kg', env: 'CHECK_KG', label: 'Knowledge graph (`npm run kg:check`)', cmd: ['npm', ['run', 'kg:check']] },
  { key: 'links', env: 'CHECK_LINKS', label: 'Internal links (`scripts/checks/links.mjs`)', cmd: ['node', ['scripts/checks/links.mjs']], needsBuild: true },
  { key: 'seo', env: 'CHECK_SEO', label: 'Technical SEO (`scripts/checks/seo.mjs`)', cmd: ['node', ['scripts/checks/seo.mjs']], needsBuild: true },
];

const fromOutcome = (o) => ({ success: 'pass', failure: 'fail' }[o] ?? 'blocked');

/** A short reason on failure: the first lines that mention errors, else the last lines. */
function tail(s, n = 3) {
  const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  const errs = lines.filter((l) => /error|✗|fail/i.test(l) && !/^>/.test(l));
  return (errs.length ? errs.slice(0, n) : lines.slice(-n)).join(' / ').slice(0, 400);
}

function runCheck(c) {
  const r = spawnSync(c.cmd[0], c.cmd[1], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { status: 'blocked', note: r.error.message };
  return { status: r.status === 0 ? 'pass' : 'fail', note: r.status === 0 ? '' : tail(`${r.stdout}\n${r.stderr}`) };
}

function technical() {
  const run = args.includes('--run');
  const res = {};
  for (const c of CHECKS) {
    const outcome = process.env[c.env];
    if (outcome !== undefined) {
      res[c.key] = { status: fromOutcome(outcome), note: outcome === 'success' || outcome === 'failure' ? '' : `step ${outcome || 'did not run'}` };
    } else if (run) {
      res[c.key] = c.needsBuild && res.build?.status !== 'pass'
        ? { status: 'blocked', note: 'needs a passing build' }
        : runCheck(c);
    } else {
      res[c.key] = { status: 'blocked', note: 'not run (pass CHECK_* outcomes or --run)' };
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Editorial: changed content pages and their gate status
// ---------------------------------------------------------------------------
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });

// Content routes (mirrors scripts/kg/sync.mjs and src/i18n/index.ts).
const SECTION = {
  namen: { en: 'names', de: 'namen' },
  checklisten: { en: 'checklists', de: 'checklisten' },
  ratgeber: { en: 'guides', de: 'ratgeber' },
  kaufberatung: { en: 'buying-guides', de: 'kaufberatung' },
  finanz: { de: 'finanz' },
};
const GATED = ['fragen', 'kaufberatung']; // collections whose routes apply src/lib/shipgate.ts

function frontmatter(txt) {
  const m = txt?.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]\w*):(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    if (v === 'true' || v === 'false') fm[kv[1]] = v === 'true';
    else if (v.startsWith('[')) fm[kv[1]] = [...v.matchAll(/"([^"]*)"|'([^']*)'|([^,[\]\s][^,[\]]*)/g)].map((x) => (x[1] ?? x[2] ?? x[3]).trim()).filter(Boolean);
    else fm[kv[1]] = v.replace(/^(['"])(.*)\1$/, '$2');
  }
  return fm;
}

/** Same order as shipGate() in src/lib/shipgate.ts: draft, YMYL without reviewer, no source. */
function gateStatus(fm, collection) {
  if (!fm) return 'unreadable';
  if (!GATED.includes(collection)) return fm.draft === true ? 'draft' : 'published';
  if (fm.draft === true) return 'draft';
  if (fm.ymyl === true && !String(fm.reviewedBy ?? '').trim()) return 'held-ymyl';
  if (!(fm.quellen ?? []).length) return 'held-nosource';
  return 'published';
}

function urlFor(collection, lang, file, fm) {
  const slug = collection === 'fragen' ? fm?.slug || file : file;
  const base = lang === 'de' ? '/de' : '';
  return collection === 'fragen' ? `${base}/${fm?.hub}/${slug}/` : `${base}/${SECTION[collection]?.[lang] ?? collection}/${slug}/`;
}

function changedFiles() {
  if (git('rev-parse', '--verify', '--quiet', `${BASE}^{commit}`).status !== 0) return { error: `base "${BASE}" is not available (fetch it, or pass --base)` };
  const mb = git('merge-base', BASE, 'HEAD').stdout.trim();
  if (!mb) return { error: `no merge base between ${BASE} and HEAD` };
  // Against the merge base; includes uncommitted work when run locally.
  const out = git('diff', '--name-status', '--no-renames', mb).stdout;
  return { mb, files: out.split('\n').filter(Boolean).map((l) => { const [s, path] = l.split('\t'); return { s, path }; }) };
}

function editorial() {
  const diff = changedFiles();
  if (diff.error) return diff;
  const g = loadGraph();
  const pages = [];
  for (const { s, path } of diff.files) {
    const m = path.match(/^src\/content\/([^/]+)\/(en|de)\/([^/]+)\.mdx?$/);
    if (!m) continue;
    const [, collection, lang, file] = m;
    const before = s === 'A' ? null : frontmatter(git('show', `${diff.mb}:${path}`).stdout);
    const abs = join(ROOT, path);
    const after = s === 'D' || !existsSync(abs) ? null : frontmatter(readFileSync(abs, 'utf8'));
    const fm = after ?? before;
    const url = urlFor(collection, lang, file, fm);
    const node = get(g, idFor.page(lang, url));
    const reviews = node ? neighbors(g, node.id, 'OF', 'in') : [];
    pages.push({
      path, url, collection, gated: GATED.includes(collection),
      before: s === 'A' ? 'new' : gateStatus(before, collection),
      after: s === 'D' ? 'removed' : gateStatus(after, collection),      ymyl: fm?.ymyl === true,
      reviewer: String(after?.reviewedBy ?? '').trim(),
      humanApproval: reviews.some((r) => r.result === 'approve' && r.reviewerKind === 'human' && r.byKind === 'human'),
      graphStatus: node?.status,
    });
  }
  const gateChanged = diff.files.some((f) => f.path === 'src/lib/shipgate.ts');
  const reviewNodes = diff.files.filter((f) => f.path.startsWith('knowledge/nodes/review/')).map((f) => f.path);
  return { base: BASE, mb: diff.mb, pages, gateChanged, reviewNodes };
}

/** One-line editorial verdict for a page. */
function verdict(p) {
  if (p.after === 'removed') return 'Removed from the site (check redirects).';
  if (p.after === 'unreadable') return 'Frontmatter unreadable: fix before merge.';
  if (!p.gated) return p.after === 'draft' ? 'Draft: not built.' : 'Not gated by shipgate (no YMYL/source gate on this collection).';
  if (p.after === 'draft') return 'Held as draft until the editorial pass is done.';
  if (p.after === 'held-ymyl') return 'YMYL: **waiting for a named human reviewer**. Stays unpublished.';
  if (p.after === 'held-nosource') return 'Held: no source in `quellen`.';
  if (p.ymyl && !p.humanApproval) return `YMYL credited to "${p.reviewer}", **no human Review node recorded**. Confirm the reviewer read this page before merge.`;
  if (p.ymyl) return `YMYL reviewed by "${p.reviewer}" (human Review recorded).`;
  return 'Publishes on merge (editorial approval: editor + fact-check).';
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const ICON = { pass: 'PASS', fail: 'FAIL', blocked: 'BLOCKED' };

function render(tech, ed) {
  const L = [];
  const allPass = Object.values(tech).every((r) => r.status === 'pass');
  L.push('# Release report', '');
  if (stopped()) L.push('> **knowledge/STOP is present.** Automated jobs are halted; nothing is released automatically.', '');

  L.push('## 1. Technical', '');
  L.push('| Check | Result | Note |', '|---|---|---|');
  for (const c of CHECKS) L.push(`| ${c.label} | **${ICON[tech[c.key].status]}** | ${(tech[c.key].note || '').replace(/\|/g, '\\|')} |`);
  L.push('', allPass
    ? '**Technical approval: PASS.** The build is sound. This says nothing about whether held content may be published.'
    : '**Technical approval: NOT GIVEN.** Fix the failing or blocked checks before merge.', '');

  L.push('## 2. Editorial', '');
  if (ed.error) {
    L.push(`Changed pages could not be listed: ${ed.error}. Editorial status is **unknown**.`, '');
  } else {
    L.push(`Content pages changed vs \`${ed.base}\` (merge base \`${ed.mb.slice(0, 7)}\`): **${ed.pages.length}**`, '');
    if (ed.pages.length) {
      L.push('| Page | Before | After | YMYL | Reviewer | Decision |', '|---|---|---|---|---|---|');
      for (const p of ed.pages.sort((a, b) => a.url.localeCompare(b.url))) {
        L.push(`| \`${p.url}\` | ${p.before} | ${p.after} | ${p.ymyl ? 'yes' : 'no'} | ${p.reviewer || '—'} | ${verdict(p)} |`);
      }
      L.push('');
      const goingLive = ed.pages.filter((p) => p.after === 'published' && p.before !== 'published');
      const waiting = ed.pages.filter((p) => p.after === 'held-ymyl');
      const unrecorded = ed.pages.filter((p) => p.gated && p.after === 'published' && p.ymyl && !p.humanApproval);
      const stale = ed.pages.filter((p) => p.graphStatus && p.after !== 'removed' && p.graphStatus !== p.after);
      L.push(`- Newly published by this merge: **${goingLive.length}**${goingLive.length ? ` (${goingLive.map((p) => `\`${p.url}\``).join(', ')})` : ''}`);
      L.push(`- YMYL pages waiting for a named human reviewer: **${waiting.length}**`);
      L.push(`- YMYL pages with a reviewer in frontmatter but no human Review node: **${unrecorded.length}**`);
      if (stale.length) L.push(`- Graph out of date for ${stale.length} page(s): run \`npm run kg:sync\` and commit the result.`);
      L.push('');
    }
    if (ed.gateChanged) L.push('> **`src/lib/shipgate.ts` changed.** The publication gate must never be weakened; a human must approve this change explicitly.', '');
    if (ed.reviewNodes.length) L.push(`> Review nodes changed: ${ed.reviewNodes.map((f) => `\`${f}\``).join(', ')}. Only a human may record an approving Review.`, '');
  }

  L.push('## 3. What this report authorizes', '');
  L.push('- **Passing technical checks never authorizes publishing held content.** A held page (draft, YMYL without a named reviewer, no source) stays held whatever this report says.');
  L.push('- A YMYL page is released only when a named human reviewer has read that page, `reviewedBy` is set, and a human Review with `result: approve` is recorded (see `docs/system/RELEASE.md`).');
  L.push('- Merging to `main` is the release and stays a human decision.', '');
  return L.join('\n');
}

const md = render(technical(), editorial());
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
