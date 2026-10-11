# Workflow contract: content intelligence and the knowledge graph

This contract binds every agent and job that researches, writes, checks, publishes or measures content.
AGENTS.md comes first. **The code is the source of truth for the schema:** `scripts/kg/schema.mjs`
holds the types, fields, enums, relations, transitions and roles, and `scripts/kg/lib.mjs` holds the
validation. If this file and the code disagree, fix this file in the same PR.

## 1. Storage

- One JSON file per node at `knowledge/nodes/<type>/<id-safe>.json`. Keys are sorted and indented 2 spaces.
  Always write through `writeNode()`, never by hand-formatting JSON.
- Edges are stored on the source node as `"edges": [{ "rel": "...", "to": "<id>", "note"?: "..." }]`.
- `knowledge/graph.json` (built with `npm run kg:build`) is a compiled view with adjacency lists. It is gitignored.
- Git is the audit trail. Graph changes go through a branch and a PR like any other change.

## 2. Nodes and edges

| Type | Owner | Key fields (full list in `schema.mjs`) |
|---|---|---|
| page | **derived** (`kg:sync`) | lang, collection, hub, slug, url, title, status (published, held-ymyl, held-nosource, draft, removed), gated, ymyl, reviewedBy, quellen, translationOf, updated, internalLinks |
| source | **derived** | key, name, url, jurisdiction, authority, registered, status |
| need | lead | question, intent, audience, lang |
| opportunity | lead (created only through `kg:propose` / `kg:ingest`) | title, category, action, state, scores, gates (evidence, ymyl, duplicateOf, overlapCheck: clear, needs-human or resolved:&lt;decision id&gt;, reviewer), demand, rationale, owner, reviewBy, history |
| brief | category researcher (created by sync from the inbox) | path, status |
| claim | researcher, fact-checker | text, kind (fact, hypothesis, recommendation), ymyl, confidence, status (supported, contested, unsupported, expired), revalidate (change id that queued it; the fact-checker clears it) |
| evidence | researcher, fact-checker, change job | url, sourceKey, accessed, retrievalMethod, quote (300 chars max), contentHash, sourceQuality, revalidateBy |
| observation | researcher | url, accessed, observed, kind (competitor, serp, format). **Never evidence that a claim is true.** |
| change | change-detection job | url, detected, oldHash, newHash, summary |
| decision | lead, human | about, outcome, reason, by, date, state (proposed, approved, rejected, superseded), proposal (machine-readable, never auto-applied) |
| review | **human only** for approve | page, reviewer, reviewerKind, by, byKind, date, result |
| run | every agent and job | agent, model, started, finished, status, inputs, outputs, cost |
| outcome | measurement | page, period, impressions, clicks, ctr, position, source (gsc, analytics), baseline |
| lesson | lead | what, evidence, appliesTo, created |

Allowed relations (`RELATIONS` in the schema):

- page ANSWERS need; page CITES claim; opportunity CITES claim; page IMPLEMENTS opportunity
- page LINKS_TO page; page TRANSLATION_OF page (both derived)
- claim SUPPORTED_BY evidence; claim CONTRADICTED_BY evidence; evidence FROM source
- opportunity TARGETS need; opportunity OVERLAPS page or opportunity; brief SPECIFIES opportunity
- review OF page; outcome MEASURES page; change AFFECTS evidence, source, page or observation
- run PRODUCED any node; decision ABOUT any node; observation ABOUT need or opportunity
- lesson LEARNED_FROM run, decision, outcome or opportunity; SUPERSEDES between decisions, lessons or briefs

Any other edge fails `kg:check`.

## 3. IDs

IDs are deterministic. The same input always gives the same ID, so re-runs update nodes instead of duplicating them.
Build them with `idFor.*` in `lib.mjs`:

| Type | ID |
|---|---|
| page | `page:en/clothing/newborn-clothing-size`, `page:de/kleidung/…`, `page:en/names/luca` (the URL path without `/de`) |
| source | `source:cpsc` |
| claim | `claim:` + first 12 hex chars of sha1(normalized text). Normalized means lowercased, whitespace collapsed, trimmed. |
| evidence | `evidence:` + sha1(url + "\n" + normalized claim), 12 chars |
| observation | `obs:` + sha1(url + "\n" + normalized observed text), 12 chars |
| others | `opp:<slug>`, `brief:<file slug>`, `need:<slug>`, `lesson:<slug>`, `run:<date>-<slug>`, `decision:<date>-<slug>`, `outcome:<page path>-<period>`, `change:<date>-<hash12>`, `review:<page path>-<date>-<reviewer slug>` |

Never rename an ID. To replace a node, create the new one and link it with `SUPERSEDES`.

## 4. Opportunity state machine

```
proposed → scored → approved → in_progress → in_review ─┬→ released → measured → improve | consolidate | retire
                                    ↑            │      └→ blocked_review (YMYL waits for a human) → released
                                    └────────────┘ (send back)
rejected: reachable from any state (lead or human)
```

| Transition | Who may do it | Condition |
|---|---|---|
| proposed → scored | lead | PLAYBOOK scores filled in and penalty set; `demand: "unknown"` unless Search Console data exists |
| scored → approved | lead (non-YMYL); **human** (YMYL) | Hard gates pass: there is source evidence; a duplicate means the action is improve or consolidate, not create; YMYL has a named human reviewer lined up |
| approved → in_progress → in_review | writer/editor | Writer works on a branch; the page sets `draft: true` until the edit is done |
| in_review → blocked_review | fact-checker or publisher | YMYL page that passed the fact-check and is waiting for the human reviewer |
| in_review or blocked_review → released | publisher | Build and audit pass; for YMYL, a **human** Review with result approve exists for the implementing page |
| released → measured | measurement | At least one Outcome node; the first one has `baseline: true` |
| measured → improve, consolidate or retire | lead (retire: lead or human) | Based on Outcome data and lessons, never on a guess |

Every transition appends `{from, to, by, role, byKind?, date, reason}` to `history`. `role` is one of the roles in the table
(`TRANSITIONS` in `schema.mjs`); `by` names who did it; a person also sets `byKind: "human"` (the Review convention).
`validateGraph` rejects illegal transitions, a role not allowed for the transition, a broken chain (the first entry starts at
`proposed`, each `from` equals the previous `to`, the last `to` equals `state`), an entry marked human whose `by` looks like an
agent, a YMYL `scored → approved` that is not role `human` with `byKind: "human"`, a YMYL move into `released` not recorded by a
human, scores missing after `proposed`, a released YMYL opportunity without a human approval, and `create` on a duplicate
after approval.

## 5. Scoring

Implemented in `scripts/kg/score.mjs`; duplicates are found by `scripts/kg/dedupe.mjs` (lexical similarity plus hub,
language and intent; anything above the threshold needs a human check). `npm run kg:update` re-runs sync, propose,
score, backlog and check; `docs/content-intelligence/BACKLOG.md` is the ranked queue.

- **Canonical:** the PLAYBOOK rubric. Rate utility, evidence, gap, differentiation, links and fit from 0 to 5 each, then
  subtract a 0–5 penalty for duplication, YMYL burden, legal risk or no unique value. Store the result in
  `scores: { utility, evidence, gap, differentiation, links, fit, penalty, net, assumptions }`.
- **Hypothesis only:** the external weights (need 25%, differentiation 20%, demand 20%, strategic 15%, evidence 10%,
  commercial 10%) are kept in `CALIBRATION_HYPOTHESIS`. Revisit them once 3 months of Outcome data exist.
- **Hard gates override any score.** No evidence means no approval. YMYL means a named human reviewer is required.
  A duplicate means improve or consolidate.
- **YMYL by declaration** (`YMYL_CATEGORIES`, `YMYL_TEXT` in `schema.mjs`): `kg:ingest` and `kg:propose` set `ymyl: true`
  on opportunities and claims in safety, bath-and-care, breastfeeding and feeding, and on any whose text mentions sleep,
  SIDS, car seats, medicine, fever, formula or allergies. A bundle can raise ymyl, never lower it. `npm run audit` warns
  (`ymyl-hub-not-ymyl`) on English pages in those hubs with `ymyl: false`; a human decides.
- Never invent search volumes, rankings, CTR or AI citation counts. If a number is unknown, write "unknown".

## 6. Role contracts

Every role reads AGENTS.md and this contract first. Every run checks `knowledge/STOP`, writes one Run node, and
links it with PRODUCED to the nodes it created or changed.

| Role | Reads | Writes | Must not |
|---|---|---|---|
| **Category researcher** (`intel-*`) | `npm run kg -- search <topic>`, pages and opportunities in its hub | A **findings bundle** (JSON in its response, format in BRIEF-TEMPLATE.md) that the session saves to `docs/content-intelligence/bundles/` and loads with `npm run kg:ingest`; plus the brief file. Researchers have read-only tools and never write nodes directly | Edit pages, score its own briefs, use a competitor as evidence, research outside its hub |
| **Lead** | All opportunities, check warnings, Outcomes, Lessons | Scores, transitions up to approved (non-YMYL), Needs, Decisions, Lessons, priorities | Approve YMYL, approve without evidence, approve `create` on a duplicate |
| **SEO/GEO technical** | Templates, rendered `dist/`, Page nodes | Observations of kind format, Decisions about templates, technical PRs | Add external scripts, fonts or trackers; promise rankings |
| **Writer/editor** | Approved opportunity, its brief, cited Claims | Page content on a branch, IMPLEMENTS and ANSWERS edges on the Page node (`writeNode({id, type, edges})`; sync keeps them), new Claims it relies on | Credit a reviewer, set `reviewedBy`, cite a claim without SUPPORTED_BY evidence |
| **Fact-checker** (adversarial) | Every claim on the page | Claim status (supported, contested, unsupported), new Evidence, CONTRADICTED_BY edges, send back to in_progress | Approve a page for release; upgrade snippet-only evidence to high confidence for YMYL |
| **Publisher** | Build, audit, `kg:check`, Reviews | Release transitions, PR for merge | Release YMYL without a human approving Review; weaken `shipgate.ts` |
| **Measurement** | Search Console CSV export or API (once the owner provides credentials) | Outcome nodes (baseline first), measured transitions | Estimate, interpolate or invent numbers |
| **Human reviewer or owner** | The page itself | Review nodes (`reviewerKind: human`, `byKind: human`), `reviewedBy` in frontmatter, YMYL approvals | (none) |

## 7. Approval levels

1. **Technical:** `npm run build`, `npm run audit` and `npm run kg:check` pass, with no structural errors. An agent may confirm this.
2. **Editorial:** editor plus adversarial fact-checker, with every claim SUPPORTED_BY current evidence. Agents may do this. It is enough for **non-YMYL** release.
3. **Human review:** required for every YMYL page and every YMYL opportunity approval. Only a human creates a Review with
   `result: approve`. `validateNode` rejects an agent approval, and an approving Review whose `reviewer` or `by` looks like an
   agent (model or agent words, an `agent:` id, a `.claude/agents` file name) is a structural `kg:check` error (`review-not-human`).
   The reviewer's name goes on a page only after they read that page (AGENTS.md §5.1).

Merging to `main` is the release and stays a human action.

## 8. Idempotency and retries

- `kg:sync` derives pages, sources, briefs and research claims. Running it twice gives no diff. It never deletes nodes.
  Derived nodes whose content is gone get `status: "removed"`. Authored nodes (opportunity, need, brief) are created once
  and keep their fields afterwards; sync only adds edges.
- `writeNode` merges edges as a union without duplicates. Only sync-owned relations (`LINKS_TO`, `TRANSLATION_OF` on
  pages) are recomputed on each run.
- A retry repeats the same deterministic IDs, so it updates instead of duplicating. A failed run records
  `status: failed` on its Run node and is retried at most 2 times. After that it waits for the lead.
- Network jobs (change detection) back off exponentially and never retry a URL more than 3 times per day.

## 9. Freshness and revalidation

- Evidence carries `revalidateBy`. The default is accessed + 6 months, or + 3 months for YMYL. Migrated snippet evidence
  expires on 2027-04-10.
- `kg:check` warns about expired evidence and about published or YMYL-held pages that cite claims without current
  evidence. Expired evidence on a YMYL page sends its opportunity to `improve`.
- A ChangeEvent on a source URL AFFECTS the Evidence from that URL. The fact-checker re-checks those claims and sets
  them to `contested` or `expired` where needed.
- Opportunities carry `reviewBy`. If one is overdue and not rejected or retired, `kg:check` warns.

## 10. Environment and cost limits

- **Claude cloud sessions** can't fetch most external sites (proxy) but WebSearch works. Evidence gathered there is
  `search-snippet`. Treat it as a discovery clue; it is too weak on its own for YMYL.
- **GitHub Actions** runners can fetch. Change detection runs there: allowlisted URLs only (Source and Evidence nodes),
  robots.txt respected, at most 1 request per host every 5 seconds, 60 URLs per run by default, and only the content
  hash, title, Last-Modified and fetch status stored (no excerpt). Never store full copyrighted text.
- **Search Console** needs credentials the owner provides. Until then, outcome data comes in from a CSV export.
- Per run: one category, at most 10 briefs or 50 new claims, at most 30 searches. A larger job is split into several runs.
  Every Run records rough cost notes. Use the strongest available model for editorial and fact-check passes (`lesson:use-strong-model-for-editorial`).

## 11. Stop switch

If the file **`knowledge/STOP`** exists, every automated job exits at once without writing: sync, build, seed, scheduled
Actions and agent loops. Write the reason inside the file. Read-only commands (`kg:check`, `kg`) still run and print a
notice. Only a human removes the file.

## 12. Success metrics

We measure quality and outcomes, never output volume. Pages or briefs per week is not a target.

- **Integrity:** 0 structural `kg:check` errors on `main`; 0 YMYL pages released without a human Review; 0 credited reviewers without a Review node.
- **Evidence:** share of claims on published pages with current primary-authority evidence (target 100% for YMYL); no evidence older than `revalidateBy`.
- **Duplication:** 0 opportunities approved as `create` on an existing topic; inventory query recorded on every brief.
- **Outcomes** (once Search Console is connected): impressions, clicks, CTR and position against each page's baseline, measured at 28 and 90 days.
- **Learning:** every measured opportunity ends in a Decision or Lesson; weights are recalibrated against Outcome data, not opinion.

## 13. Related documents

- `docs/system/RELEASE.md`: CI gates and how technical and editorial approval differ.
- `docs/system/OPERATIONS.md`: scheduled jobs, retries, logs, recovery.
- `docs/system/MEASUREMENT.md`: Search Console import, report and calibration.
- `docs/content-intelligence/README.md`: the end-to-end loop with commands.
