/**
 * revalidate.mjs — the researchers' re-check work list, as markdown (stdout).
 *
 *   1. Claims marked for revalidation by a ChangeEvent (`revalidate` field)
 *   2. Evidence past revalidateBy (or due within --within <days>)
 *   3. Watched URLs whose last fetch was not current (4xx/5xx, robots, errors)
 *
 * Grouped by owner category. Read-only: writes nothing.
 * Usage: node scripts/watch/revalidate.mjs [--within 0] [--today YYYY-MM-DD]
 */
import { get, loadGraph, byType, neighbors, stopped } from '../kg/lib.mjs';
import { addDays, claimCategory, evidenceCategory, flag, loadWatchlist, md, runDate, topicCategories } from './common.mjs';

const DATE = runDate();
const WITHIN = Number(flag('within', 0));
const horizon = addDays(DATE, WITHIN);
const g = loadGraph();
const topics = topicCategories();

const groups = new Map(); // category -> { claims: [], evidence: [], urls: [] }
const group = (c) => {
  if (!groups.has(c)) groups.set(c, { claims: [], evidence: [], urls: [] });
  return groups.get(c);
};
const citedBy = (claimId) => neighbors(g, claimId, 'CITES', 'in').map((p) => `${p.id} (${p.status})`);

// 1. Claims flagged by a ChangeEvent.
for (const c of byType(g, 'claim').filter((x) => x.revalidate).sort((a, b) => a.id.localeCompare(b.id))) {
  const change = get(g, c.revalidate);
  group(claimCategory(g, c, topics)).claims.push([
    `- [ ] \`${c.id}\`${c.ymyl ? ' **YMYL**' : ''} (${c.status}): ${md(c.text, 200)}`,
    `  - changed source: ${change ? `${change.url} (\`${change.id}\`, detected ${change.detected.slice(0, 10)})` : `\`${c.revalidate}\` (change node missing)`}`,
    ...(citedBy(c.id).length ? [`  - cited by: ${citedBy(c.id).join(', ')}`] : []),
  ].join('\n'));
}

// 2. Evidence past (or near) revalidateBy.
for (const ev of byType(g, 'evidence').filter((e) => e.revalidateBy <= horizon).sort((a, b) => a.revalidateBy.localeCompare(b.revalidateBy) || a.id.localeCompare(b.id))) {
  const claims = neighbors(g, ev.id, 'SUPPORTED_BY', 'in');
  const state = ev.revalidateBy < DATE ? 'expired' : 'due';
  group(evidenceCategory(g, ev, topics)).evidence.push(
    `- [ ] \`${ev.id}\` ${state} ${ev.revalidateBy} (${ev.retrievalMethod}${claims.some((c) => c.ymyl) ? ', backs YMYL claims' : ''}, ${claims.length} claim(s)): ${ev.url}`,
  );
}

// 3. Watched URLs that are not current.
for (const e of loadWatchlist().entries.filter((x) => x.last && x.last.status !== 'ok')) {
  group(e.category).urls.push(`- [ ] ${e.kind} ${e.url}: \`${e.last.status}\` on ${e.last.checked}, last OK ${e.last.okAt ?? 'never'}`);
}

// Output.
const total = (k) => [...groups.values()].reduce((n, x) => n + x[k].length, 0);
const out = [
  `## Revalidation work list ${DATE}`,
  '',
  stopped() ? '> knowledge/STOP is present: automated jobs are halted.\n' : '',
  `Claims flagged by a source change: ${total('claims')}. Evidence ${WITHIN ? `due within ${WITHIN} days` : 'past revalidateBy'}: ${total('evidence')}. Watched URLs not current: ${total('urls')}.`,
  '',
  'Fact-checkers: re-read each source, then set the claim to supported, contested or expired and remove its `revalidate` field. Never mark snippet-only evidence as enough for YMYL.',
  '',
];
if (!groups.size) out.push('Nothing to re-check.');
for (const [cat, x] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
  out.push(`### ${cat}`, '');
  if (x.claims.length) out.push(`**Claims to re-check after a source change (${x.claims.length})**`, '', ...x.claims, '');
  if (x.evidence.length) out.push(`**Evidence to revalidate (${x.evidence.length})**`, '', ...x.evidence, '');
  if (x.urls.length) out.push(`**Watched URLs not current (${x.urls.length})**`, '', ...x.urls, '');
}
console.log(out.filter((l, i) => l !== '' || out[i - 1] !== '').join('\n'));
