/**
 * issues.mjs — one GitHub issue per approved Opportunity (npm run kg:issues).
 *
 * Idempotent: before creating, it searches for an existing issue (open or
 * closed) carrying the label for that opportunity, and skips it if found.
 * The label is the opportunity ID (e.g. "opp:play-toy-rotation-planner"),
 * shortened with a hash when it exceeds GitHub's 50-character label limit.
 *
 * --dry-run is the default and only prints what would happen. --create calls
 * the gh CLI (needs gh auth) and honors knowledge/STOP.
 *
 * Usage: npm run kg:issues [-- --dry-run | --create] [--state approved] [--repo owner/name]
 *   --state  preview another state in a dry run (creation is approved-only)
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hash12, loadGraph, neighbors, stopped } from './lib.mjs';
import { scoreAll } from './score.mjs';

const MAX_LABEL = 50;

/** GitHub label for an opportunity: the ID itself, or a hashed short form. */
export function labelFor(oppId) {
  if (oppId.length <= MAX_LABEL) return oppId;
  return `${oppId.slice(0, MAX_LABEL - 8)}-${hash12(oppId).slice(0, 7)}`;
}

/** Issue title and body for an opportunity and its score result. */
export function issueFor(g, opp, r) {
  const s = r.scores;
  const needs = neighbors(g, opp.id, 'TARGETS').map((n) => `- ${n.question} (\`${n.id}\`)`);
  const briefs = neighbors(g, opp.id, 'SPECIFIES', 'in').map((b) => `- \`${b.path}\``);
  const overlaps = r.overlaps.map((m) => `- \`${m.id}\` (${m.status}, dedupe ${m.score})`);
  const decisions = neighbors(g, opp.id, 'ABOUT', 'in').filter((d) => d.type === 'decision').map((d) => `- \`${d.id}\`: ${d.outcome}`);
  const body = [
    `Opportunity \`${opp.id}\` (state **${opp.state}**, action **${opp.action}**, category ${opp.category}${opp.gates?.ymyl ? ', **YMYL**' : ''}).`,
    '',
    opp.rationale,
    '',
    '### Parent question', ...(needs.length ? needs : ['- none recorded']),
    '', '### Brief', ...(briefs.length ? briefs : ['- none']),
    '', '### Overlaps (link to these, do not duplicate them)', ...(overlaps.length ? overlaps : ['- none above the check threshold']),
    ...(decisions.length ? ['', '### Decisions', ...decisions] : []),
    '', '### Score',
    `PLAYBOOK net ${s.net} (utility ${s.utility}, evidence ${s.evidence}, gap ${s.gap}, differentiation ${s.differentiation}, links ${s.links}, fit ${s.fit}, penalty ${s.penalty}). Demand: ${r.demand}.`,
    `Hypothesis score ${s.hypothesis.score ?? 'n/a'} (hypothesis only, not used for ranking).`,
    '', '### Before release',
    '- Read AGENTS.md and docs/system/CONTRACT.md; work on a branch; the page keeps `draft: true` until the edit is done.',
    '- Every factual claim cites a registered source key and has SUPPORTED_BY evidence.',
    ...(opp.gates?.ymyl ? ['- YMYL: a named human reviewer reads the page before `reviewedBy` is set. Agents never set it.'] : []),
    '- `npm run build`, `npm run audit` and `npm run kg:check` pass.',
    '',
    `Owner: ${opp.owner}. Review by: ${opp.reviewBy}.`,
  ].join('\n');
  return { title: `[${opp.category}] ${opp.title}`, body, label: labelFor(opp.id) };
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Existing issues (any state) with this label, via gh. */
function findExisting(label, repo) {
  const out = gh(['issue', 'list', '--state', 'all', '--label', label, '--json', 'number,url,state', ...(repo ? ['--repo', repo] : [])]);
  return JSON.parse(out || '[]');
}

function createIssue({ title, body, label }, repo) {
  const r = repo ? ['--repo', repo] : [];
  gh(['label', 'create', label, '--color', '2438F5', '--description', 'e-bambino opportunity (kg:issues)', '--force', ...r]);
  return gh(['issue', 'create', '--title', title, '--body', body, '--label', label, ...r]).trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const create = args.includes('--create') && !args.includes('--dry-run');
  const state = opt('--state') ?? 'approved';
  const repo = opt('--repo');
  if (create && state !== 'approved') { console.log('kg:issues: --create only works on state approved'); process.exit(1); }
  if (create && stopped()) { console.log('knowledge/STOP is present: kg:issues halted.'); process.exit(0); }

  const g = loadGraph();
  const rows = scoreAll(g).filter(({ opp }) => opp.state === state);
  console.log(`kg:issues  ${create ? 'create' : 'dry-run'}  ${rows.length} opportunit${rows.length === 1 ? 'y' : 'ies'} in state ${state}`);
  for (const { opp, result } of rows) {
    const issue = issueFor(g, opp, result);
    if (!create) {
      console.log(`\nwould search: gh issue list --state all --label "${issue.label}"`);
      console.log(`would create (if none found): "${issue.title}" with label ${issue.label}`);
      console.log(issue.body.split('\n').map((l) => `  | ${l}`).join('\n'));
      continue;
    }
    const existing = findExisting(issue.label, repo);
    if (existing.length) { console.log(`exists   ${opp.id}  ${existing.map((i) => `#${i.number} (${i.state})`).join(', ')}`); continue; }
    console.log(`created  ${opp.id}  ${createIssue(issue, repo)}`);
  }
}
