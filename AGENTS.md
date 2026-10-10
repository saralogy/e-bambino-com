# e-bambino.com — project guide for AI agents and new contributors

Read this file first. It explains what the site is, how it is built, the rules content must follow,
and what is still to do. Keep it up to date: when you finish a to-do or make a decision that changes
how the project works, edit this file in the same pull request.

---

## 1. What e-bambino is

**e-bambino.com is a premium baby & mom website: everything new parents need, in one place.**
It answers the questions parents actually have, compares products honestly, and gives them
checklists and tools that take the planning off their hands, from pregnancy to the toddler years.

- **Audience:** expecting and new parents, mostly first-timers who don't yet know what to look for.
- **Business model (planned):** product aggregator. Answers lead to buying guides and comparisons,
  which lead to price comparison and retailer hand-off. Leads come from tools that save parents
  work (saved checklists, due-date emails, price alerts).
- **Languages:** English is the global version (root URLs). German is a second version under `/de/`.
  Work on English first.

### Core values (use these in copy; they are consumer-centric, not medical)

1. Everything for baby & mom in one place
2. Honest, independent picks (no paid placements)
3. Answers to the questions parents actually have, short answer first
4. Checklists and tools that save time
5. Free, no sign-up

### Things the brand is NOT

- **Not Italian.** An earlier version called itself an "Italian family guide". That positioning was
  dropped completely. Never reintroduce Italian framing, Italian-only names, Italian sources or an
  "IT" language option.
- **Not a medical site.** Do not lead with "checked by people", "sources disclosed", "medically
  reviewed" or similar as selling points in banners, heroes or taglines.
- **No per-post compliance footers.** Do not add lines like "Written and checked by … (EU AI Act
  Art. 50)" under posts. The AI Act note lives only on the About and Privacy pages.

---

## 2. Tech stack and commands

- **Astro 4** static site, **Tailwind CSS 3**, MDX, content collections (Markdown).
- Fonts self-hosted in `public/fonts/` (Bricolage Grotesque + Hanken Grotesk). **Never load fonts or
  scripts from Google or other CDNs** — this is a GDPR decision for a German operator.
- No backend. Search on the questions page is client-side.

```bash
npm ci            # install
npm run dev       # local dev server
npm run build     # production build into dist/  (must pass before every merge)
npm run preview   # serve dist/ locally
npm run audit     # content audit, English + German (exit 1 only on hard errors)
node scripts/make-og.mjs       # regenerate public/og-default.png and logo.png (Playwright)
```

Deployment: merging to `main` is the release. Work on a branch, open a PR, merge when checks pass.

---

## 3. Repository map

```
src/
  i18n/index.ts        Languages, URL helpers (path, sectionPath), entry helpers, shared UI copy (header/footer/banner)
  i18n/hubs.ts         Topic hubs in both languages (English slugs + copy; German comes from data/taxonomie.ts)
  views/               One view per page type, used by both languages (Home, QuestionsIndex, Hub, Question,
                       NamesIndex, NameDetail, CollectionIndex, CollectionDetail, Sources)
  views/collections.ts Copy + routing for checklists, guides and (German-only) finance
  pages/               Thin route files. English at the root, German under pages/de/
  pages/*.md, de/*.md  About / Legal notice / Privacy (EN) and Über uns / Impressum / Datenschutz (DE)
  layouts/             Base (html, SEO, header, footer), Layout, ContentPage (Markdown pages)
  components/          Header (banner + nav + EN/DE switch), Footer, SEO (hreflang, OG, JSON-LD),
                       ArticleHero, Breadcrumbs, SectionHeader
  content/<collection>/<lang>/*.md   All content. Folder name = language (en | de)
  data/taxonomie.ts    German taxonomy: hubs, facets, reserved /produkte/ URLs
  lib/shipgate.ts      Publication gate (see 5.2)
  lib/sources.ts       Display names for source keys (quellen)
  lib/llms.ts          Builds /llms.txt and /llms-full.txt for AI answer engines (GEO)
  lib/audit.ts         German copy quality checks
  styles/global.css    Component classes (.btn-*, .card, .chip-*, .prose, .page-hero …)
tailwind.config.js     Design tokens
astro.config.mjs       Redirects from old German root URLs to /de/, markdown table wrapper, sitemap
```

### URL structure

| Content | English | German |
|---|---|---|
| Home | `/` | `/de/` |
| Questions index | `/questions/` | `/de/fragen/` |
| Topic hub | `/{hub}/` e.g. `/clothing/` | `/de/{hub}/` e.g. `/de/kleidung/` |
| Question | `/{hub}/{slug}/` | `/de/{hub}/{slug}/` |
| Names | `/names/…` | `/de/namen/…` |
| Checklists | `/checklists/…` | `/de/checklisten/…` |
| Guides | `/guides/…` | `/de/ratgeber/…` |
| Buying guides | `/buying-guides/…` | `/de/kaufberatung/…` |
| For AI engines | `/llms.txt`, `/llms-full.txt` | — |
| Finance (Germany only) | — | `/de/finanz/…` |
| About / Legal / Privacy / Sources | `/about/`, `/legal-notice/`, `/privacy/`, `/sources/` | `/de/ueber-uns/`, `/de/impressum/`, `/de/datenschutz/`, `/de/quellen/` |

English hub slugs: `clothing`, `on-the-go`, `diapering`, `feeding`, `bath-and-care`, `breastfeeding`,
`nursery`, `play`, `safety` (mapping to German slugs in `src/i18n/hubs.ts`). Old German root URLs
(e.g. `/kleidung/…`) redirect to `/de/…`; the list is generated in `astro.config.mjs`.

---

## 4. How to add content

### 4.1 Question page (the main content type)

Create `src/content/fragen/en/<slug>.md` (or `de/`). Field names are German for historical reasons.

```yaml
---
title: "From what age can a baby use a high chair?"      # page title
description: "One sentence for search results."
author: 'e-bambino editorial team'
date: 2026-10-10
updatedDate: 2026-10-10
hub: 'feeding'                 # English hub slug (German slug in de/)
category: 'feeding'
frage: "From what age can a baby use a high chair?"      # the H1, a real search question
frageTyp: 'ist-sind'           # was | wie | ist-sind | kann | sonstiges
intention: 'informational'     # informational | comparative | transactional | navigational
slug: 'high-chair-age'         # URL slug
translationOf: 'hochstuhl-welches-alter'   # EN only: slug of the German original (links the two)
antwort: "40–60 word direct answer shown first in a highlighted card."
quellen: ["kindergesundheit-info"]   # REQUIRED, keys from the Sources page; empty = not published
ymyl: false                    # true for health, safety, nutrition, sleep topics
reviewedBy: ''                 # required when ymyl is true, e.g. 'Mathilda, Nurse'
draft: true                    # optional; holds the page until the editorial pass is done
---
Intro paragraph (1–2 sentences).

## Sub-question as H2?
2–4 sentence answer. Include one table or checklist per page.
```

Rules: short answer first; H2s are real questions; one visible extra (table/checklist); no closing
footer line. The page shows "Updated · Sources · Reviewed by" automatically at the end.

### 4.2 Other content

- Names: `src/content/namen/<lang>/` (`typ`: `girl`/`boy` in EN, `mädchen`/`jungen` in DE).
- Checklists: `src/content/checklisten/<lang>/`, guides: `src/content/ratgeber/<lang>/`,
  finance: `src/content/finanz/de/` (German only).
- English entries set `translationOf: <german slug>` so hreflang and the language switch connect them.
- Buying guides: `src/content/kaufberatung/<lang>/` (fields `antwort`, `criteria`, `types`, `checklist`,
  `quellen`; same gate). The "Compare prices" slot is reserved for the commerce layer.
- Source keys: `who`, `aap`, `cdc`, `nichd`, `nhtsa`, `fda`, `cpsc`, `unece`, `rki`, `awmf`,
  `kindergesundheit-info`, `verbraucherzentrale`. A new key needs an entry in `src/views/Sources.astro`
  and in `src/lib/sources.ts`.

### 4.3 Writing style

- **English:** US spelling and terms (diaper, stroller, pediatrician), plain and warm, second person.
- **German:** formal "Sie" (some older pages still say "du"; convert them when you touch them).
- No emojis, no invented statistics, no invented experts or credentials, no unverifiable rankings.
  If a fact cannot be checked against a listed source, leave it out.
- Product copy must be honest: never "Testsieger"/"best" without a documented method.

---

## 5. Guardrails (do not break these)

### 5.1 Content integrity
- Never invent people, credentials, reviews, test results, rankings or statistics.
- Never put a reviewer's name on a page that person has not actually reviewed.
- Health/safety advice must follow current mainstream guidance (e.g. safe sleep: back to sleep,
  nothing loose in the crib in year one; car seats: rear-facing as long as the seat allows).

### 5.2 Publication gate (`src/lib/shipgate.ts`)
A question page is built only if it is not `draft: true`, has at least one source AND, when
`ymyl: true`, a named `reviewedBy`. Held pages are simply not generated. Do not weaken this gate.

### 5.3 Legal (Germany-based operator)
- Impressum must stay complete and accurate (§ 5 DDG).
- No third-party trackers, fonts or embeds without a consent solution (DSGVO/TDDDG).
- Affiliate/sponsored links must be labeled as advertising when the commerce layer arrives.
- EU rules restrict advertising of infant formula (Säuglingsanfangsnahrung): inform only, never
  put it in price comparison, deals or affiliate links.

### 5.4 Quality checks before merging
1. `npm run build` passes.
2. No broken internal links in `dist/`.
3. No horizontal overflow at 320, 390, 768 and 1280 px; tap targets ≥ 44 px.
4. Both languages still build and hreflang pairs are correct.

---

## 6. Design system

Tokens live in `tailwind.config.js`; component classes in `src/styles/global.css`.

- **Colors:** `ultramarine` #2438F5 (brand, navigation, links), `mandarin` #FF6A1A (buy/conversion
  only; always dark text on it), `limone` #D9F24A (highlights, deals; a surface, never text on white),
  `night` #0C1020 (text, dark bands), `fog` #F2F3F8 (sections). No pastels.
- **Type:** Bricolage Grotesque for display (`font-display`), Hanken Grotesk for body (`font-sans`).
- **Patterns:** `.page-hero` night band with ultramarine disc on index/detail pages; ultramarine hero
  on the home page; color-block topic tiles; `.btn-primary`, `.btn-buy`, `.btn-secondary`;
  chips `.chip-topic`, `.chip-highlight`, `.chip-neutral`.
- Never put `.text-night` inside a `.page-hero` descendant rule: Tailwind copies it onto every
  component that uses `@apply text-night` (this caused white-on-lime text once).
- The original design boards: https://claude.ai/artifact/RsXs1cH3T9trnreAc6A6BU

---

## 7. Current status (October 2026)

- English live: home, 24 question pages across 7 hubs, 2 names, 2 checklists, 1 sleep guide,
  About, Legal notice, Privacy, Sources.
- German live under `/de/`: 16 question pages, names, checklists, finance (Elterngeld, Kindergeld),
  sleep guide, legal pages.
- German pages held by the gate (`ymyl: true`, no reviewer): 19, including
  `kindersitz-vorne-gewicht` and `schlafsack-oder-decke-winter`, whose German text contains
  **unsafe advice** and must be rewritten (use the English versions as the reference) before release.
- 38 English pages from the per-category teams (`docs/category-plans.md`, research in `docs/research/`)
  went through an Opus editorial pass and an adversarial fact-check (2026-10-10). 6 are live; the other
  **32 are YMYL and wait for a named reviewer** (no longer drafts: adding `reviewedBy` releases them).
  This includes every page in Bath & care and Safety, so those hubs stay 404 until one is reviewed.
- Buying-guide template is live at `/buying-guides/` (empty state); the stroller guide is a held draft.
- SEO/GEO foundation: robots.txt allows AI search crawlers; Organization + WebSite (SearchAction)
  JSON-LD on every page; Article/Breadcrumb/ItemList/QAPage data on views; `/llms.txt`.
- Reviewer on file: **Mathilda, Nurse** — currently named on the English car-seat and sleep-sack pages.
- Growth strategy (SEO, templates, lead generation, roadmap):
  https://claude.ai/artifact/JfvtzXZXiBM3oZ311zq97N

---

## 8. To-do list (highest priority first)

### Must do
- [ ] **Impressum:** add full street address, a responsible person / legal representative and the
      legal form (and register entry if any). "Hamburg, Germany" alone does not satisfy § 5 DDG.
- [ ] **Reviewer confirmation:** Mathilda must actually read the two English pages credited to her
      (car seats, sleep sack).
- [ ] **German unsafe pages:** rewrite `kindersitz-vorne-gewicht` and `schlafsack-oder-decke-winter`
      from the corrected English versions, then send for review.
- [ ] **Reviewer queue: 32 English YMYL pages** (list: `npm run audit`, entries tagged HELD). A real
      reviewer reads each page, then sets `reviewedBy`. Start with Safety and Bath & care (empty hubs).
- [ ] **Source check:** an editor should confirm the sources on newborn sizes, sleeper vs bodysuit,
      diapers per day, books for beginning readers and crib duration.

### Next (content and SEO)
- [ ] Review and release the other held German health/safety pages, and write English versions.
- [ ] Write and source the first buying guides (ideas per category in `docs/category-plans.md`);
      link them from hubs and from the header nav once one is live.
- [ ] Hub modules from the UX/UI review: "start here" path, comparison table, buying-guide card.
- [ ] Internal links inside article bodies (question → guide → hub) and related-content modules.
- [ ] Checklists and guides have no `hub` field, so the "Keep going" module on question pages
      falls back to the first checklist; add a hub field to those schemas.

### Later (lead generation and commerce)
- [ ] Interactive first-equipment planner (save/share by email, double opt-in).
- [ ] Due-date email series ("your baby this week"); due dates may be health data — legal check first.
- [ ] Finder quizzes (stroller, car seat, carrier).
- [ ] Product layer under the reserved `/produkte/` URLs: price comparison with total price incl.
      shipping, price alerts, then a baby registry.
- [ ] Privacy-friendly analytics with consent; Search Console.

---

## 9. Decision log

| Date | Decision |
|---|---|
| 2026-10-09 | New design system: ultramarine / mandarin / limone on night, no pastels. |
| 2026-10-10 | English is the global version at the root; German moved to `/de/`. |
| 2026-10-10 | Italian positioning removed entirely. Brand = premium baby & mom guide, all in one place. |
| 2026-10-10 | Core values are parent-centric (see section 1), not "checked by people / sources disclosed". |
| 2026-10-10 | No per-post AI Act/editorial footer; reviewer info only as a quiet line at the end of a page. |
| 2026-10-10 | Legal entity on the site: e-bambino, Hamburg, Germany, info@e-bambino.com. |
| 2026-10-10 | Content is produced by per-category teams (PM, researcher, writer, SEO/GEO, UX/UI, publisher). Facts come only from official sources found by the researcher. Team output lands as `draft: true` and needs an editorial pass before release. |
| 2026-10-10 | AI answer engines are a target channel (GEO): allow their crawlers, publish `/llms.txt`, keep a quotable 40–60 word short answer on every page. |
