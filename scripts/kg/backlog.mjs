/**
 * backlog.mjs — render docs/content-intelligence/BACKLOG.md from the graph (npm run kg:backlog).
 *
 * Ranked by the canonical PLAYBOOK net score. The hypothesis score is shown
 * beside it, labelled, and never used for ranking. Hard gates and their
 * blocking reasons are listed per opportunity, followed by everything that
 * waits for a human reviewer. Rendering is deterministic: same graph, same
 * date (evidence currency), same file. No timestamps are written.
 *
 * Usage: npm run kg:backlog [-- --stdout | --check]
 *   --check   exit 1 when the file on disk is out of date (writes nothing)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { byType, loadGraph, neighbors, ROOT, stopped } from './lib.mjs';
import { HYPOTHESIS_LABEL, scoreAll } from './score.mjs';

export const BACKLOG_FILE = join(ROOT, 'docs/content-intelligence/BACKLOG.md');
const CLOSED = ['rejected', 'retire'];

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const short = (id) => id.replace(/^(opp|page):/, '');
const gateMark = (v) => (v === 'pass' ? 'ok' : 'FAIL');

function table(head, rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
}

/** Ranked opportunity rows (open ones), best net first. */
function rankedRows(rows) {
  return rows
    .filter(({ opp }) => !CLOSED.includes(opp.state))
    .sort((a, b) => b.result.scores.net - a.result.scores.net || a.opp.id.localeCompare(b.opp.id));
}

function rankedSection(rows) {
  const body = rows.map(({ opp, result: r }, i) => {
    const s = r.scores;
    const g = s.hardGates;
    const stale = opp.scores?.net !== s.net ? ' (not stored)' : '';
    const action = r.suggestion.action === opp.action ? opp.action : `${opp.action} (dedupe: ${r.suggestion.action})`;
    return [
      i + 1, `\`${opp.id}\` ${opp.title}`, `${s.net}${stale}`,
      s.hypothesis.score === null ? 'n/a' : `${s.hypothesis.score} (${Math.round(s.hypothesis.coverage * 100)}% known)`,
      action, opp.state,
      `E ${gateMark(g.evidence)} · Y ${gateMark(g.ymyl)} · D ${gateMark(g.duplicate)} · O ${gateMark(g.overlap)}`,
      r.blocking.length ? r.blocking.map((b) => b.split(':')[0]).join(', ') : 'none',
      r.evidenceCount, r.overlaps.length ? r.overlaps.map((m) => `${short(m.id)} ${m.score}`).join('; ') : '-',
      opp.owner, opp.reviewBy,
    ];
  });
  return table(['#', 'Opportunity', 'Net', 'Hypothesis*', 'Action', 'State', 'Gates', 'Blocked by', 'Evidence', 'Overlaps (dedupe ≥ 0.3)', 'Owner', 'Review by'], body);
}

function detailSection(g, rows) {
  const out = [];
  for (const { opp, result: r } of rows) {
    const s = r.scores;
    out.push(`### ${opp.id}`, '');
    out.push(`- **Score:** net ${s.net} = utility ${s.utility} + evidence ${s.evidence} + gap ${s.gap} + differentiation ${s.differentiation} + links ${s.links} + fit ${s.fit} − penalty ${s.penalty}`);
    out.push(`- **Hypothesis score:** ${s.hypothesis.score ?? 'n/a'}; unknown: ${s.hypothesis.unknown.join(', ') || 'none'}. Demand: ${r.demand}.`);
    out.push(`- **Dedupe suggestion:** ${r.suggestion.action}${r.suggestion.needsHumanCheck ? ' (needs human check)' : ''}. ${r.suggestion.reasons.join(' ')}`);
    if (r.blocking.length) for (const b of r.blocking) out.push(`- **Blocked:** ${b}`);
    else out.push('- **Blocked:** nothing; the lead may approve (non-YMYL) or a human may approve (YMYL).');
    const decisions = neighbors(g, opp.id, 'ABOUT', 'in').filter((d) => d.type === 'decision').sort((a, b) => a.id.localeCompare(b.id));
    for (const d of decisions) out.push(`- **Decision** \`${d.id}\` (${d.by}, ${d.date}): ${d.outcome}`);
    out.push(`- **Assumptions:** ${s.assumptions}`, '');
  }
  return out.join('\n');
}

function humanReviewSection(g, rows) {
  const out = [];
  const held = byType(g, 'page').filter((p) => p.status === 'held-ymyl').sort((a, b) => a.id.localeCompare(b.id));
  const byLang = (lang) => held.filter((p) => p.lang === lang);
  out.push(`${held.length} YMYL pages are held by \`src/lib/shipgate.ts\` until a named human reviewer has read them and \`reviewedBy\` is set (AGENTS.md §5.2). Only a human records a Review with result approve.`, '');
  for (const lang of ['en', 'de']) {
    const pages = byLang(lang);
    if (!pages.length) continue;
    out.push(`#### ${lang === 'en' ? 'English' : 'German'} (${pages.length})`, '');
    const hubs = [...new Set(pages.map((p) => p.hub ?? '-'))].sort();
    const rowsOut = [];
    for (const hub of hubs) {
      for (const p of pages.filter((x) => (x.hub ?? '-') === hub)) {
        const claims = neighbors(g, p.id, 'CITES');
        const weak = claims.filter((c) => c.status !== 'supported').length;
        const snippetOnly = claims.length > 0 && claims.every((c) => neighbors(g, c.id, 'SUPPORTED_BY').every((e) => e.retrievalMethod === 'search-snippet'));
        rowsOut.push([hub, `\`${p.url}\``, p.title, p.quellen.join(', ') || 'none', claims.length ? `${claims.length}${weak ? `, ${weak} not supported` : ''}${snippetOnly ? ', snippet-only' : ''}` : '0']);
      }
    }
    out.push(table(['Hub', 'URL', 'Title', 'Sources', 'Cited claims'], rowsOut), '');
  }
  const unrecorded = byType(g, 'page')
    .filter((p) => p.reviewedBy && p.status !== 'removed' && !neighbors(g, p.id, 'OF', 'in').some((r) => r.result === 'approve'))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (unrecorded.length) {
    out.push('#### Credited reviewer without a Review record', '');
    out.push(table(['Page', 'Credits', 'Needed'], unrecorded.map((p) => [`\`${p.url}\``, p.reviewedBy, 'the reviewer reads the page; a human records the Review node'])), '');
  }
  const ymylOpps = rows.filter(({ result }) => result.scores.hardGates.ymyl === 'fail');
  if (ymylOpps.length) {
    out.push('#### YMYL opportunities waiting for a named reviewer', '');
    out.push(ymylOpps.map(({ opp }) => `- \`${opp.id}\` ${opp.title}`).join('\n'), '');
  }
  return out.join('\n');
}

/** Render the whole Markdown document. */
export function renderBacklog(g = loadGraph()) {
  const all = scoreAll(g);
  const rows = rankedRows(all);
  const closed = all.filter(({ opp }) => CLOSED.includes(opp.state)).sort((a, b) => a.opp.id.localeCompare(b.opp.id));
  const blocked = rows.filter(({ result }) => result.blocking.length).length;
  return [
    '# Content backlog',
    '',
    '<!-- Generated by `npm run kg:backlog` from knowledge/. Do not edit by hand; change the graph and regenerate. -->',
    '',
    `${rows.length} open opportunities, ${blocked} blocked by at least one hard gate. Ranking uses the canonical PLAYBOOK net score`,
    '(six 0–5 ratings minus a 0–5 risk/duplication penalty; docs/system/CONTRACT.md §5). Ratings are derived from graph and brief',
    'signals and explained under each opportunity; they are prioritization aids, not demand forecasts. Demand is `unknown` until',
    'Outcome data exists. Similarity never decides alone: every overlap listed needs a human check.',
    '',
    `\\* Hypothesis score: ${HYPOTHESIS_LABEL}.`,
    '',
    'Gates: **E** source evidence linked, **Y** YMYL has a named human reviewer, **D** no `create` on a duplicate, **O** overlaps checked by a person. Any FAIL blocks approval whatever the score.',
    '',
    '## Ranked opportunities',
    '',
    rankedSection(rows),
    '',
    '## Details and blocking reasons',
    '',
    detailSection(g, rows),
    '## Blocked on human review',
    '',
    humanReviewSection(g, rows),
    ...(closed.length ? ['## Closed', '', closed.map(({ opp }) => `- \`${opp.id}\` ${opp.state}: ${opp.title}`).join('\n'), ''] : []),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = renderBacklog();
  const args = process.argv.slice(2);
  if (args.includes('--stdout')) process.stdout.write(md);
  else if (args.includes('--check')) {
    const cur = existsSync(BACKLOG_FILE) ? readFileSync(BACKLOG_FILE, 'utf8') : '';
    console.log(cur === md ? 'kg:backlog  up to date' : 'kg:backlog  BACKLOG.md is out of date: run npm run kg:backlog');
    process.exit(cur === md ? 0 : 1);
  } else {
    if (stopped()) { console.log('knowledge/STOP is present: kg:backlog halted.'); process.exit(0); }
    mkdirSync(dirname(BACKLOG_FILE), { recursive: true });
    const cur = existsSync(BACKLOG_FILE) ? readFileSync(BACKLOG_FILE, 'utf8') : '';
    if (cur !== md) writeFileSync(BACKLOG_FILE, md);
    console.log(`kg:backlog  ${cur === md ? 'unchanged' : 'written'}  ${BACKLOG_FILE.replace(`${ROOT}/`, '')}`);
  }
}
