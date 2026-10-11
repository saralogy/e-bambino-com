# Content opportunity brief: [working title]

- **Brief ID:** [YYYY-MM-DD-category-slug]
- **Category owner:** [agent]
- **Status:** Research / Ready for page agent / Needs evidence / Blocked by review
- **Market/language:** [EN root / DE / both]
- **Proposed URL:** [slug; check collision before use]
- **Research date:** [YYYY-MM-DD]
- **Confidence:** High / Medium / Low (explain why)

## 1. Recommendation
- **Priority:** P0 / P1 / P2
- **Decision:** Build / Update existing page / Merge into existing page / Do not pursue
- **Parent problem:** [specific job-to-be-done]
- **Why now:** [evidence; distinguish observation from hypothesis]
- **Unique value e-bambino can add:** [tool, comparison, checklist, table, decision framework, original synthesis]
- **What makes this better than a generic competitor rewrite:** [specific]

## 2. Existing-site overlap
- **Inventory queries run** (required; copy them into the bundle's `inventoryQueries`): e.g. `npm run kg -- search "<topic>"`, or the Grep over `knowledge/nodes/` a read-only agent ran
- Overlapping Page and Opportunity IDs from the graph (with status / state):
- Relevant current pages and URLs:
- Closest existing answer:
- Cannibalization/duplication risk:
- Internal links to add/update:
- Translation pairing required:

## 3. Search and competitor evidence
| Competitor/source | Exact URL | Access date | Observed coverage/format | Gap or useful pattern | Confidence |
|---|---|---|---|---|---|
| | | | | | |

Separate actual observations from assumptions. Do not state search volume, ranking or AI citation data unless directly measured by a reliable source.

## 4. Intent and query cluster
- **Primary question:**
- **Likely intent:** Informational / Comparative / Transactional / Navigational
- **Supporting questions (5–12):**
- **Audience/stage:**
- **SERP formats observed:** Featured answer / video / comparison / forum / retailer / other (only if observed)
- **What would satisfy the parent in one visit:**

## 5. Evidence and source plan
| Claim/topic | Authoritative source URL | What it supports | Date/edition | Source registry key exists? | Reviewer needed? |
|---|---|---|---|---|---|
| | | | | | |

- **YMYL:** true / false / uncertain
- **Required source keys:** [existing keys only unless a registry update is proposed]
- **Named reviewer gate:** [actual qualified person confirmed / unavailable / not required]
- **Unresolved claims to omit:**

## 6. Page brief for Claude
- **Proposed title:**
- **Meta description (truthful, one sentence):**
- **H1:**
- **40–60 word direct answer draft/outline:**
- **H2 questions and answer points:**
  1.
  2.
  3.
- **Useful visual/utility:** table / checklist / calculator / matrix / diagram / none
- **Decision criteria and caveats:**
- **Call to action, if any:** useful related content, never forced commercial promotion
- **Claims/angles explicitly out of scope:**

## 7. SEO/GEO technical handoff
- Canonical/slug considerations:
- Existing pages to link from:
- Pages to link to:
- Breadcrumb/hub placement:
- Structured data: [type and eligibility rationale; inspect current implementation]
- Answer-engine extractability improvements:
- Image/alt-text needs:
- Indexability/hreflang/redirect considerations:
- Accessibility/mobile checks:
- No new third-party script/font/embed unless approved.

## 8. Prioritization
The lead scores; researchers do not score their own briefs. The canonical rubric is `docs/system/CONTRACT.md` §5.
Give the lead the inputs instead:
- **Evidence available for scoring:** claim refs in the bundle and their source quality
- **Overlap / duplication facts:** from section 2
- **YMYL review burden:** reviewer needed? confirmed?
- **Why this could outrank alternatives (argument, not a score):**

## 9. Acceptance criteria
- [ ] No duplicate/cannibalizing page
- [ ] All material factual claims sourced
- [ ] Correct source registry keys; YMYL reviewer confirmed before publication
- [ ] Adds specific original utility
- [ ] Internal links verified
- [ ] Metadata, headings, canonical/hreflang and schema checked
- [ ] Build and relevant audits pass
- [ ] EN/DE pairing and translations handled correctly
- [ ] Mobile/accessibility checks complete
- [ ] No legal/editorial guardrail violations

## 10. Handoff prompt
> Read `AGENTS.md`, `docs/system/CONTRACT.md`, the approved Opportunity node and this brief. Verify the current repository state and existing pages before editing. Implement only the approved scope in your isolated branch/worktree. Treat this brief as a research hypothesis, verify cited claims directly, use registered source keys, do not invent credentials or metrics, and do not bypass the YMYL publication gate. Add appropriate internal links and metadata, run the build and relevant checks, then report changed files, evidence and any unresolved review blocker.

---

# Findings bundle (one per run, returned with the briefs)

Research agents have read-only tools, so they do not write graph nodes. They return their structured findings as **one
fenced `json` block** at the end of the response. The lead (or whoever runs the session) saves it unchanged to
`docs/content-intelligence/bundles/<date>-<category>.json` and runs:

```bash
npm run kg:ingest -- docs/content-intelligence/bundles/<date>-<category>.json --dry-run   # validate only
npm run kg:ingest -- docs/content-intelligence/bundles/<date>-<category>.json             # write nodes
```

`scripts/kg/ingest.mjs` validates the bundle (any error: nothing is written), maps it to nodes with deterministic IDs,
routes every proposal through the dedupe/propose path and writes one Run node. Re-ingesting the same file changes nothing.
Worked example: `docs/content-intelligence/bundles/2026-10-11-on-the-go.json`.

## Format `e-bambino-findings/1`

```json
{
  "format": "e-bambino-findings/1",
  "label": "sprint-002",
  "date": "2026-10-20",
  "category": "on-the-go",
  "lang": "en",
  "agent": "intel-on-the-go",
  "model": "claude-opus-5-5",
  "cost": "12 searches, 0 fetches",
  "inventoryQueries": ["npm run kg -- search stroller", "Grep 'stroller' knowledge/nodes/opportunity"],
  "observations": [
    { "ref": "o1", "url": "https://competitor.example/best-strollers", "accessed": "2026-10-20",
      "kind": "competitor", "observed": "Ranks 10 tested strollers by use case; affiliate disclosure at top.", "about": ["p1"] }
  ],
  "claims": [
    { "ref": "c1", "text": "One complete, self-contained statement.", "kind": "fact", "ymyl": true },
    { "ref": "c2", "text": "Parents need X more than Y.", "kind": "hypothesis", "ymyl": false }
  ],
  "evidence": [
    { "ref": "e1", "url": "https://www.cpsc.gov/...", "accessed": "2026-10-20", "retrievalMethod": "search-snippet",
      "quote": "Exact words from the source, 300 characters at most.", "sourceQuality": "primary-authority",
      "sourceKey": "cpsc", "supports": ["c1"] }
  ],
  "needs": [
    { "ref": "n1", "question": "Which stroller fits your everyday life?", "intent": "comparative" }
  ],
  "proposals": [
    { "ref": "p1", "title": "Constraint-first stroller buying guide", "question": "Which stroller fits your everyday life?",
      "action": "improve", "priority": "P1", "intent": "comparative", "ymyl": false,
      "rationale": "Why, which overlapping pages/opportunities were found, what original utility we add.",
      "needs": ["n1"], "claims": ["c1", "c2"], "brief": "brief:2026-10-20-on-the-go-stroller-buying-guide" }
  ]
}
```

## Field rules

| Section | Required | Rules |
|---|---|---|
| top level | `format`, `label`, `date`, `category`, `agent`, `inventoryQueries` | `category` is the English hub slug. `inventoryQueries` lists the graph queries you ran first; an empty list is rejected. `model` and `cost` are recorded on the Run node (`unrecorded` / `not recorded` if omitted, never guessed). |
| `observations` | `ref`, `url`, `accessed`, `kind`, `observed` | What a competitor, SERP or format **shows**. `kind`: competitor, serp, format. `observed` is your summary (max 500 chars), never copied page text. `about` may point at needs or proposals. **Never evidence that a claim is true.** |
| `claims` | `ref`, `text`, `kind`, `ymyl` | `kind`: fact, hypothesis, recommendation. One statement per claim; the text is hashed into the ID, so write it once and reuse it. A fact without supporting evidence is stored as `unsupported`. |
| `evidence` | `ref`, `url`, `accessed`, `retrievalMethod`, `quote`, `sourceQuality`, and `supports` and/or `contradicts` | `retrievalMethod` is honest: `search-snippet` if you only saw a search result, `fetched` only if you read the page. `quote` is the exact supporting words, 300 chars max. `sourceQuality`: primary-authority, secondary, community. `competitor` is rejected (that is an observation), and so is any URL that is also an observation. `sourceKey` must be a registered key; omitted, it is inferred from the URL host. |
| `needs` | `ref`, `question`, `intent` | `intent`: informational, comparative, transactional, navigational, unknown. Optional `slug` to reuse an existing `need:<slug>`. |
| `proposals` | `ref`, `title`, `ymyl`, `rationale` | Optional `slug` (reuse an existing `opp:<slug>` to add findings to it), `question`, `action` (create, improve, consolidate, redirect, monitor, reject), `priority` (P0–P3), `intent`, `needs`, `claims`, `brief`. **No scores**: the lead scores. |

References (`supports`, `contradicts`, `about`, `needs`, `claims`) are bundle refs (`c1`) or IDs of existing graph nodes
(`claim:05fb96bc01f9`, `opp:…`). Link to an existing claim instead of rewording it: a reworded claim is a new node.

## What ingest writes

| Bundle item | Node (ID) | Edges |
|---|---|---|
| need | `need:<slug of question or slug>` (created once, then preserved) | |
| claim | `claim:<sha1(normalized text)>`; status from its evidence: contested if contradicted, supported if supported, else unsupported; confidence never `high` from snippets | `SUPPORTED_BY` / `CONTRADICTED_BY` evidence |
| evidence | one node per (url, claim): `evidence:<sha1(url + claim)>`; `revalidateBy` = accessed + 6 months, + 3 months for YMYL claims. An existing node keeps its fields; ingest only fills a missing quote. | `FROM` source |
| observation | `obs:<sha1(url + observed)>` | `ABOUT` need or opportunity |
| proposal | via `propose()` (dedupe, OVERLAPS, state `proposed`); `opp:<slug>` | `CITES` claim, `TARGETS` need; brief `SPECIFIES` it. `gates.evidence` becomes true only when a cited claim is supported by primary-authority evidence (for YMYL: more than a snippet). It is never set back to false by ingest. |
| the run | `run:<date>-<label>-<category>` | `PRODUCED` every node above |

Limits per bundle (CONTRACT §10): one category, at most 50 claims. Split larger runs.
