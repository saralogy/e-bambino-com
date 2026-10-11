/**
 * schema.mjs — the knowledge graph schema. Source of truth for node types,
 * fields, enums, relations and the opportunity state machine.
 *
 * docs/system/CONTRACT.md describes the workflow around it; when the two
 * disagree, this file wins and the contract gets fixed in the same PR.
 *
 * Field spec: { t: type, req?: true, enum?: [...], max?: n }
 *   t = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'array' | 'object'
 *   'date' is YYYY-MM-DD, 'datetime' is YYYY-MM-DD or a full ISO timestamp.
 */

const s = (extra = {}) => ({ t: 'string', ...extra });
const r = (t, extra = {}) => ({ t, req: true, ...extra });

/** ID prefix per node type: `<prefix>:<rest>`. */
export const PREFIX = {
  page: 'page',
  source: 'source',
  need: 'need',
  opportunity: 'opp',
  brief: 'brief',
  claim: 'claim',
  evidence: 'evidence',
  observation: 'obs',
  change: 'change',
  decision: 'decision',
  review: 'review',
  run: 'run',
  outcome: 'outcome',
  lesson: 'lesson',
};
export const TYPE_BY_PREFIX = Object.fromEntries(Object.entries(PREFIX).map(([t, p]) => [p, t]));

/** Types owned by `kg:sync`. Never hand-edit them; edit the content instead. */
export const DERIVED_TYPES = ['page', 'source'];

/** Fields every node may carry. */
export const COMMON_FIELDS = {
  id: r('string'),
  type: r('string'),
  edges: { t: 'array' },
  notes: s(),
  created: { t: 'date' },
};

export const LANGS = ['en', 'de'];
export const INTENTS = ['informational', 'comparative', 'transactional', 'navigational', 'unknown'];

/** Opportunity state machine (see TRANSITIONS below). */
export const OPP_STATES = [
  'proposed', 'scored', 'approved', 'in_progress', 'in_review', 'blocked_review',
  'released', 'measured', 'improve', 'consolidate', 'retire', 'rejected',
];
/** States at or past approval: evidence gate must hold. */
export const APPROVED_OR_LATER = ['approved', 'in_progress', 'in_review', 'blocked_review', 'released', 'measured', 'improve', 'consolidate', 'retire'];

export const TYPES = {
  // --- Derived (kg:sync) ---------------------------------------------------
  page: {
    lang: r('string', { enum: LANGS }),
    collection: r('string', { enum: ['fragen', 'kaufberatung', 'checklisten', 'ratgeber', 'namen', 'finanz'] }),
    hub: s(),
    slug: r('string'),
    url: r('string'),
    title: r('string'),
    status: r('string', { enum: ['published', 'held-ymyl', 'held-nosource', 'draft', 'removed'] }),
    gated: r('boolean'), // true when src/lib/shipgate.ts applies to this collection
    ymyl: r('boolean'),
    reviewedBy: s(),
    quellen: r('array'),
    translationOf: s(),
    updated: { t: 'date' },
    internalLinks: r('array'),
  },
  source: {
    key: r('string'),
    name: r('string'),
    fullName: s(),
    url: s(),
    jurisdiction: r('string', { enum: ['intl', 'US', 'EU', 'DE', 'AT', 'CH', 'UK', 'unknown'] }),
    authority: r('string', { enum: ['official', 'professional', 'consumer', 'other'] }),
    registered: r('boolean'), // key exists in src/lib/sources.ts (usable in quellen)
    status: r('string', { enum: ['active', 'removed'] }),
  },

  // --- Authored --------------------------------------------------------------
  need: {
    question: r('string'),
    intent: r('string', { enum: INTENTS }),
    audience: r('string'),
    lang: r('string', { enum: LANGS }),
  },
  opportunity: {
    title: r('string'),
    category: r('string'),
    action: r('string', { enum: ['create', 'improve', 'consolidate', 'redirect', 'monitor', 'reject'] }),
    state: r('string', { enum: OPP_STATES }),
    priority: s({ enum: ['P0', 'P1', 'P2', 'P3'] }),
    scores: { t: 'object' }, // see SCORE_DIMENSIONS
    gates: r('object'), // { evidence: bool, ymyl: bool, duplicateOf: [pageId] }
    demand: s(), // 'unknown' until Search Console is connected; never invented
    rationale: r('string'),
    owner: r('string'),
    reviewBy: r('date'),
    history: { t: 'array' }, // [{ from, to, by, date, reason? }]
  },
  brief: {
    path: r('string'),
    status: r('string', { enum: ['inbox', 'accepted', 'implemented', 'rejected', 'superseded'] }),
    title: s(),
    category: s(),
    priority: s(),
    decisionLine: s(),
    researchDate: { t: 'date' },
  },
  claim: {
    text: r('string'),
    kind: r('string', { enum: ['fact', 'hypothesis', 'recommendation'] }),
    ymyl: r('boolean'),
    confidence: r('string', { enum: ['high', 'medium', 'low'] }),
    status: r('string', { enum: ['supported', 'contested', 'unsupported', 'expired'] }),
    topics: { t: 'array' }, // research slugs the claim was gathered for
    revalidate: s(), // change:<id> that put this claim in the re-check queue; the fact-checker removes it
  },
  evidence: {
    url: r('string'),
    sourceKey: s(),
    accessed: r('date'),
    retrievalMethod: r('string', { enum: ['search-snippet', 'fetched', 'manual', 'api'] }),
    quote: s({ max: 300 }), // short excerpt only, never full copyrighted text
    contentHash: s(),
    sourceQuality: r('string', { enum: ['primary-authority', 'secondary', 'competitor', 'community'] }),
    revalidateBy: r('date'),
    topics: { t: 'array' },
  },
  observation: {
    url: r('string'),
    accessed: r('date'),
    observed: r('string'),
    kind: r('string', { enum: ['competitor', 'serp', 'format'] }),
  },
  change: {
    url: r('string'),
    detected: r('datetime'),
    oldHash: s(),
    newHash: r('string'),
    summary: r('string'),
  },
  decision: {
    about: r('string'),
    outcome: r('string'),
    reason: r('string'),
    by: r('string'),
    date: r('date'),
  },
  review: {
    page: r('string'),
    reviewer: r('string'), // the person who read the page
    reviewerKind: r('string', { enum: ['human', 'agent'] }),
    by: r('string'), // who recorded the node
    byKind: r('string', { enum: ['human', 'agent'] }),
    date: r('date'),
    result: r('string', { enum: ['approve', 'changes-requested', 'reject'] }),
  },
  run: {
    agent: r('string'),
    model: r('string'),
    started: r('datetime'),
    finished: { t: 'datetime' },
    status: r('string', { enum: ['running', 'succeeded', 'failed', 'stopped'] }),
    inputs: { t: 'array' },
    outputs: { t: 'array' },
    cost: s(), // rough notes: tokens, minutes, number of fetches
  },
  outcome: {
    page: r('string'),
    period: r('string'), // e.g. 2026-11 or 2026-11-01..2026-11-28
    impressions: r('number'),
    clicks: r('number'),
    ctr: r('number'),
    position: r('number'),
    source: r('string', { enum: ['gsc', 'analytics'] }),
    baseline: r('boolean'),
  },
  lesson: {
    what: r('string'),
    evidence: r('string'),
    appliesTo: r('array'), // roles or node types, see ROLES
    created: r('date'),
  },
};

/**
 * Allowed relations: rel -> { fromType: [toTypes] | '*' }.
 * Edges live on the FROM node: { rel, to, note? }.
 */
export const RELATIONS = {
  ANSWERS: { page: ['need'] },
  CITES: { page: ['claim'] },
  SUPPORTED_BY: { claim: ['evidence'] },
  CONTRADICTED_BY: { claim: ['evidence'] },
  FROM: { evidence: ['source'] },
  TARGETS: { opportunity: ['need'] },
  OVERLAPS: { opportunity: ['page', 'opportunity'] },
  SPECIFIES: { brief: ['opportunity'] },
  IMPLEMENTS: { page: ['opportunity'] },
  OF: { review: ['page'] },
  MEASURES: { outcome: ['page'] },
  PRODUCED: { run: '*' },
  ABOUT: { decision: '*', observation: ['need', 'opportunity'] },
  LEARNED_FROM: { lesson: ['run', 'decision'] },
  LINKS_TO: { page: ['page'] }, // derived from markdown links in the body
  TRANSLATION_OF: { page: ['page'] }, // derived: EN page -> German original
  AFFECTS: { change: ['evidence', 'source', 'page', 'observation'] },
  SUPERSEDES: { decision: ['decision'], lesson: ['lesson'], brief: ['brief'] },
};

/** Relations sync recomputes from content on every run (others are only ever added). */
export const SYNC_OWNED_RELS = { page: ['LINKS_TO', 'TRANSLATION_OF'] };

/**
 * Opportunity transitions: from -> { to: [roles allowed] }.
 * 'human' means the site owner or a named human editor/reviewer. 'rejected'
 * is reachable from every state by the lead or a human.
 */
export const TRANSITIONS = {
  proposed: { scored: ['lead'] },
  scored: { approved: ['lead', 'human'], proposed: ['lead'] },
  approved: { in_progress: ['writer-editor'] },
  in_progress: { in_review: ['writer-editor'] },
  in_review: { blocked_review: ['fact-checker', 'publisher'], released: ['publisher'], in_progress: ['fact-checker', 'lead'] },
  blocked_review: { released: ['publisher'], in_progress: ['lead'] },
  released: { measured: ['measurement'] },
  measured: { improve: ['lead'], consolidate: ['lead'], retire: ['lead', 'human'], measured: ['measurement'] },
  improve: { in_progress: ['writer-editor'] },
  consolidate: { in_progress: ['writer-editor'] },
  retire: {},
  rejected: {},
};
export const REJECT_ROLES = ['lead', 'human'];

/** Agent roles named in the contract. */
export const ROLES = ['category-researcher', 'lead', 'seo-geo-technical', 'writer-editor', 'fact-checker', 'publisher', 'measurement', 'human'];

/**
 * Scoring. PLAYBOOK 0–5 rubric is canonical: net = sum(dimensions) - penalty.
 * CALIBRATION_HYPOTHESIS is the external review's weighting, recorded for later
 * comparison against Outcome data. It is NOT used to rank anything yet.
 */
export const SCORE_DIMENSIONS = ['utility', 'evidence', 'gap', 'differentiation', 'links', 'fit'];
export const SCORE_PENALTY = 'penalty'; // 0–5: duplication, YMYL burden, legal risk, no unique value
export const CALIBRATION_HYPOTHESIS = {
  need: 0.25, differentiation: 0.2, demand: 0.2, strategic: 0.15, evidence: 0.1, commercial: 0.1,
};

/** Source keys that are public bodies or professional medical societies (primary authority). */
export const AUTHORITY = {
  who: ['intl', 'official'], aap: ['US', 'professional'], cdc: ['US', 'official'], nichd: ['US', 'official'],
  nhtsa: ['US', 'official'], fda: ['US', 'official'], cpsc: ['US', 'official'], unece: ['intl', 'official'],
  rki: ['DE', 'official'], awmf: ['DE', 'professional'], 'kindergesundheit-info': ['DE', 'official'],
  verbraucherzentrale: ['DE', 'consumer'], bmfsfj: ['DE', 'official'], destatis: ['DE', 'official'],
  'statistik-austria': ['AT', 'official'], bfs: ['CH', 'official'], 'deutsche-rentenversicherung': ['DE', 'official'],
};
