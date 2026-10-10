/**
 * check.mjs — validate the knowledge graph (npm run kg:check).
 *
 * Errors (exit 1): schema violations, dangling edges, disallowed relations,
 * invalid enums, illegal opportunity states. See validateGraph in lib.mjs.
 * Warnings (exit 0): freshness, evidence gaps and review-rule risks that need
 * a person or an agent to act, not a code fix.
 *
 * Usage: npm run kg:check [-- --json]
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { byType, get, indexGraph, loadNodes, neighbors, ROOT, stopped, today, validateGraph } from './lib.mjs';
import { APPROVED_OR_LATER } from './schema.mjs';

const nodes = loadNodes();
const g = indexGraph(nodes);
const { errors } = validateGraph(nodes);
const warnings = []; // { code, id, msg }
const warn = (code, id, msg) => warnings.push({ code, id, msg });
const now = today();

// Expired evidence: revalidateBy has passed.
for (const ev of byType(g, 'evidence')) {
  if (ev.revalidateBy < now) warn('evidence-expired', ev.id, `revalidateBy ${ev.revalidateBy} has passed (${ev.url})`);
}

// Published or YMYL-held pages citing claims with no supporting evidence.
const supported = (claim) => claim.status === 'supported' && neighbors(g, claim.id, 'SUPPORTED_BY').some((e) => e.revalidateBy >= now);
for (const page of byType(g, 'page')) {
  if (!(page.status === 'published' || (page.status === 'held-ymyl'))) continue;
  const weak = neighbors(g, page.id, 'CITES').filter((c) => !supported(c));
  if (weak.length) warn('page-unsupported-claims', page.id, `${weak.length} cited claim(s) without current supporting evidence`);
}

// Opportunities at or past approval without evidence.
for (const opp of byType(g, 'opportunity')) {
  if (!APPROVED_OR_LATER.includes(opp.state)) continue;
  const need = neighbors(g, opp.id, 'TARGETS');
  const hasEvidence = opp.gates?.evidence === true || neighbors(g, opp.id, 'OVERLAPS').some((p) => neighbors(g, p.id, 'CITES').some(supported));
  if (!hasEvidence) warn('opp-no-evidence', opp.id, `state "${opp.state}" but no source evidence (targets ${need.map((n) => n.id).join(', ') || 'no need'})`);
}

// Hard gates on opportunities not yet approved: flag early, fail only after approval.
for (const opp of byType(g, 'opportunity')) {
  if (APPROVED_OR_LATER.includes(opp.state)) continue;
  if (opp.gates?.duplicateOf?.length && opp.action === 'create') {
    warn('opp-duplicate-create', opp.id, `action "create" but duplicates ${opp.gates.duplicateOf.join(', ')}; change to improve or consolidate before approval`);
  }
  if (opp.reviewBy < now && !['rejected', 'retire'].includes(opp.state)) warn('opp-review-due', opp.id, `reviewBy ${opp.reviewBy} has passed`);
}

// Approving reviews must come from humans. validateGraph rejects agent-kind
// approvals; this also catches agent names entered as if they were people.
const agentNames = readdirSync(join(ROOT, '.claude/agents')).map((f) => f.replace(/\.md$/, ''));
const looksAgent = (name = '') => /\b(claude|agent|bot|gpt|llm|model|opus|sonnet|haiku)\b/i.test(name) || agentNames.includes(name);
for (const rv of byType(g, 'review')) {
  if (rv.result !== 'approve') continue;
  if (rv.byKind !== 'human' || looksAgent(rv.by) || looksAgent(rv.reviewer)) {
    warn('review-not-human', rv.id, `approving review recorded by "${rv.by}" for reviewer "${rv.reviewer}" is not clearly human`);
  }
  const page = get(g, rv.page);
  if (page && page.reviewedBy && page.reviewedBy !== rv.reviewer) warn('review-name-mismatch', rv.id, `page credits "${page.reviewedBy}", review names "${rv.reviewer}"`);
}

// Pages that credit a reviewer with no Review node behind it.
for (const page of byType(g, 'page')) {
  if (page.reviewedBy && page.status !== 'removed' && !neighbors(g, page.id, 'OF', 'in').some((r) => r.result === 'approve')) {
    warn('reviewer-unrecorded', page.id, `credits "${page.reviewedBy}" but no approving Review node exists`);
  }
}

// Internal links that resolve to no known page (broken or held targets).
const urls = new Set(byType(g, 'page').filter((p) => p.status === 'published').map((p) => p.url));
const SECTION_ROOTS = /^\/(de\/)?(questions|fragen|names|namen|checklists|checklisten|guides|ratgeber|buying-guides|kaufberatung|finanz|sources|quellen|about|ueber-uns)?\/?$/;
for (const page of byType(g, 'page')) {
  if (page.status !== 'published') continue;
  for (const href of page.internalLinks) {
    const u = href.endsWith('/') ? href : `${href}/`;
    if (!urls.has(u) && !SECTION_ROOTS.test(u) && !/^\/(de\/)?[a-z-]+\/$/.test(u)) warn('link-unpublished-target', page.id, `links to ${href}, which is not a published page`);
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ errors, warnings }, null, 2));
} else {
  if (stopped()) console.log('note: knowledge/STOP is present (automated jobs are halted).');
  for (const e of errors) console.log(`ERROR ${e}`);
  const byCode = {};
  for (const w of warnings) (byCode[w.code] ??= []).push(w);
  for (const [code, list] of Object.entries(byCode).sort()) {
    console.log(`\nWARN ${code} (${list.length})`);
    for (const w of list.slice(0, 8)) console.log(`  ${w.id}: ${w.msg}`);
    if (list.length > 8) console.log(`  ... ${list.length - 8} more (use --json)`);
  }
  console.log(`\nkg:check  ${nodes.size} nodes  ${errors.length} error(s)  ${warnings.length} warning(s)`);
}
process.exit(errors.length ? 1 : 0);
