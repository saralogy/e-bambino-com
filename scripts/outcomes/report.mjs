/**
 * report.mjs — per-page search outcome report (markdown).
 *
 *   node scripts/outcomes/report.mjs [--out file.md] [--min-impressions 100] [--nodes dir]
 *
 * For each page with Outcome nodes: the baseline and latest period, the page's
 * update date, the deltas and a conservative classification:
 *   improve | expand | consolidate | hold | stop-investing
 * Rules (see docs/system/MEASUREMENT.md): only like periods are compared (same
 * length, 28-day windows preferred, year-over-year when available), both
 * windows need the minimum impressions, recently updated pages are held, and
 * every comparison that is not year-over-year is flagged for seasonality.
 * The report describes associations. It never claims a change caused a result.
 * Read-only: it writes nothing to the graph.
 */
import { writeFileSync } from 'node:fs';
import { addDays, byType, loadGraph, neighbors, NODES_DIR, stopped, today } from '../kg/lib.mjs';
import { daysBetween, outcomesByPage, parseArgs, parsePeriod, round, WINDOW_DAYS } from './common.mjs';

const args = parseArgs();
const MIN_IMPRESSIONS = Number(args['min-impressions'] ?? 100); // per window, both windows
const CHANGE = 0.2; // ±20% relative change before a difference counts
const MIN_CLICKS_FOR_CTR = 20; // CTR comparisons need at least this many clicks in both windows
const SETTLE_DAYS = 28; // a window must start this long after the page's last update
const STOP_AFTER_DAYS = 180; // stop-investing only for pages this old with 3+ low windows

const withDates = (o) => ({ ...o, ...parsePeriod(o.period) });
const pct = (a, b) => (b ? (a - b) / b : null);
const fmtPct = (x) => (x === null ? 'n/a' : `${x >= 0 ? '+' : ''}${round(x * 100, 1)}%`);
const fmtNum = (x) => (x >= 0 ? `+${round(x, 2)}` : `${round(x, 2)}`);
const fmtWindow = (o) => `${o.period}: ${o.impressions} impr, ${o.clicks} clicks, CTR ${round(o.ctr * 100, 2)}%, pos ${o.position}`;

/** Pages that share an opportunity (OVERLAPS, IMPLEMENTS or duplicateOf) with each page. */
function overlapPeers(g) {
  const peers = new Map();
  for (const opp of byType(g, 'opportunity')) {
    const set = new Set([
      ...neighbors(g, opp.id, 'OVERLAPS').filter((n) => n.type === 'page').map((n) => n.id),
      ...neighbors(g, opp.id, 'IMPLEMENTS', 'in').map((n) => n.id),
      ...(opp.gates?.duplicateOf ?? []),
    ]);
    for (const a of set) for (const b of set) if (a !== b) (peers.get(a) ?? peers.set(a, new Set()).get(a)).add(b);
  }
  return peers;
}

/** Pick the comparison window: year-over-year when present, else the baseline. */
function comparisonFor(list, latest) {
  const yoy = list.find((o) => o !== latest && o.days === latest.days && Math.abs(daysBetween(o.start, latest.start) - 364) <= 7);
  if (yoy) return { base: yoy, basis: 'year-over-year' };
  return { base: list.find((o) => o.baseline) ?? list[0], basis: 'baseline' };
}

function classify(page, list, ctx) {
  const latest = list.at(-1);
  const { base, basis } = comparisonFor(list, latest);
  const flags = [];
  const reasons = [];
  const like = list.filter((o) => o.days === latest.days);

  if (page.status !== 'published') flags.push(`page-${page.status}`);
  if (latest.days !== WINDOW_DAYS) flags.push(`${latest.days}-day-window`);
  if (base === latest) flags.push('single-period');
  else if (base.days !== latest.days) flags.push('unlike-periods');
  else if (basis === 'baseline') flags.push(`seasonality (${daysBetween(base.start, latest.start)} days apart, not year-over-year)`);
  if (Math.min(base.impressions, latest.impressions) < MIN_IMPRESSIONS) flags.push(`low-volume (<${MIN_IMPRESSIONS} impressions)`);
  if (page.updated && page.updated > latest.end) flags.push('updated-after-latest-window');
  else if (page.updated && page.updated > addDays(latest.start, -SETTLE_DAYS)) flags.push('recently-updated');
  else if (page.updated && base !== latest && page.updated > base.start) flags.push('updated-between-windows');

  // stop-investing: three or more like windows, all below the minimum, on an old page.
  const old = page.updated && daysBetween(page.updated, latest.end) >= STOP_AFTER_DAYS;
  if (page.status === 'published' && like.length >= 3 && old && like.every((o) => o.impressions < MIN_IMPRESSIONS)) {
    reasons.push(`${like.length} windows all below ${MIN_IMPRESSIONS} impressions, last update ${page.updated}`);
    return { cls: 'stop-investing', base, basis, flags, reasons };
  }
  const holdFlags = flags.filter((f) => /^(page-|single-period|unlike-periods|low-volume|recently-updated|updated-after)/.test(f));
  if (holdFlags.length) {
    reasons.push(`not comparable yet: ${holdFlags.join(', ')}`);
    return { cls: 'hold', base, basis, flags, reasons };
  }

  const dImpr = pct(latest.impressions, base.impressions);
  const dCtr = pct(latest.ctr, base.ctr);
  const dPos = latest.position - base.position;

  // consolidate: an overlapping page also gets impressions and both sit beyond page 1.
  const peers = [...(ctx.peers.get(page.id) ?? [])]
    .map((id) => ctx.byPage.get(id)?.find((o) => o.period === latest.period))
    .filter((o) => o && o.impressions >= MIN_IMPRESSIONS);
  if (latest.position > 10 && peers.some((o) => o.position > 10)) {
    reasons.push(`overlapping page(s) ${peers.map((o) => o.page).join(', ')} also rank beyond position 10 in the same window; possible overlap`);
    return { cls: 'consolidate', base, basis, flags, reasons };
  }
  if (dImpr !== null && dImpr <= -CHANGE) {
    reasons.push(`impressions ${fmtPct(dImpr)} vs ${basis}`);
    return { cls: 'improve', base, basis, flags, reasons };
  }
  if (Math.min(base.clicks, latest.clicks) >= MIN_CLICKS_FOR_CTR && Math.abs(dPos) <= 1 && dCtr !== null && dCtr <= -CHANGE) {
    reasons.push(`CTR ${fmtPct(dCtr)} at a similar position (${fmtNum(dPos)}); title and description may be worth a look`);
    return { cls: 'improve', base, basis, flags, reasons };
  }
  if (dImpr !== null && dImpr >= CHANGE && latest.position <= 10) {
    reasons.push(`impressions ${fmtPct(dImpr)} at average position ${latest.position}; related questions may be worth covering`);
    return { cls: 'expand', base, basis, flags, reasons };
  }
  if (latest.position > 10 && latest.position <= 20) {
    reasons.push(`average position ${latest.position} (page 2) with ${latest.impressions} impressions`);
    return { cls: 'improve', base, basis, flags, reasons };
  }
  reasons.push(`changes within ±${CHANGE * 100}% or no clear pattern`);
  return { cls: 'hold', base, basis, flags, reasons };
}

function render(rows, unmeasured, total) {
  const out = [
    `# Search outcomes report (${today()})`,
    '',
    'Source: Search Console Outcome nodes in `knowledge/`. Numbers are as imported; nothing is estimated.',
    '**This report shows associations, not causes.** A change after an edit can come from the edit, from demand,',
    'from seasonality or from ranking changes elsewhere; the data cannot tell them apart.',
    '',
    `Rules: like periods only (same length, ${WINDOW_DAYS}-day windows; year-over-year when available), at least`,
    `${MIN_IMPRESSIONS} impressions in both windows, a ±${CHANGE * 100}% change threshold, CTR compared only with ${MIN_CLICKS_FOR_CTR}+ clicks in`,
    `both windows, pages held for ${SETTLE_DAYS} days after an update. See docs/system/MEASUREMENT.md.`,
    '',
  ];
  if (!total) {
    out.push('No Outcome nodes yet. Import a Search Console export (scripts/outcomes/import-gsc.mjs) to start a baseline.', '');
    return out.join('\n');
  }
  const counts = {};
  for (const r of rows) counts[r.cls] = (counts[r.cls] ?? 0) + 1;
  out.push(`Pages measured: ${rows.length}. ${Object.entries(counts).sort().map(([k, v]) => `${k}: ${v}`).join(', ')}.`,
    `Published pages without any Outcome: ${unmeasured.length}.`, '');
  out.push('| Page | Updated | Compared with | Δ impressions | Δ clicks | Δ CTR (pp) | Δ position | Class | Flags |',
    '|---|---|---|---:|---:|---:|---:|---|---|');
  for (const r of rows) {
    const { base: b, latest: l } = r;
    const same = b === l;
    out.push(`| ${r.page.url} | ${r.page.updated ?? 'unknown'} | ${same ? '(none)' : `${r.basis} ${b.period}`} | ${same ? '' : fmtPct(pct(l.impressions, b.impressions))} | ${same ? '' : fmtPct(pct(l.clicks, b.clicks))} | ${same ? '' : fmtNum((l.ctr - b.ctr) * 100)} | ${same ? '' : fmtNum(l.position - b.position)} | **${r.cls}** | ${r.flags.join('; ')} |`);
  }
  out.push('', '## Details', '');
  for (const r of rows) {
    out.push(`- **${r.page.id}** (${r.page.status}, updated ${r.page.updated ?? 'unknown'}): ${r.cls}. ${r.reasons.join('; ')}.`);
    out.push(`  - ${r.basis === 'year-over-year' ? 'year-over-year' : 'baseline'}: ${fmtWindow(r.base)}`);
    if (r.base !== r.latest) out.push(`  - latest: ${fmtWindow(r.latest)}`);
  }
  if (unmeasured.length) {
    out.push('', '## Published pages without Outcome data', '', unmeasured.map((p) => `\`${p.url}\``).join(', '));
  }
  out.push('');
  return out.join('\n');
}

function main() {
  if (stopped()) console.error('note: knowledge/STOP is present (automated jobs are halted); this report is read-only.');
  const g = loadGraph(args.nodes ?? NODES_DIR);
  const outcomes = byType(g, 'outcome').map(withDates);
  const byPage = outcomesByPage(outcomes);
  const ctx = { peers: overlapPeers(g), byPage };
  const rows = [];
  for (const [pageId, list] of [...byPage.entries()].sort()) {
    const page = g.nodes.get(pageId) ?? { id: pageId, url: pageId, status: 'unknown' };
    const row = { page, latest: list.at(-1), ...classify(page, list, ctx) };
    if (row.flags.some((f) => f.startsWith('seasonality')) && row.cls !== 'hold') row.reasons.push('seasonal demand is not ruled out (no year-over-year window yet)');
    rows.push(row);
  }
  const unmeasured = byType(g, 'page').filter((p) => p.status === 'published' && !byPage.has(p.id));
  const md = render(rows, unmeasured, outcomes.length);
  if (args.out) {
    writeFileSync(args.out, md);
    console.log(`report written to ${args.out} (${rows.length} pages)`);
  } else console.log(md);
}

main();
