# Category plans

Output of the per-category teams (project manager, researcher, writer, SEO/GEO specialist, UX/UI designer) run on 2026-10-10.
Every page listed here exists in `src/content/fragen/en/` with `draft: true`, so the publication gate holds it.

**How to release a draft:** an editor rewrites it with a stronger model or by hand, verifies every fact against the cited source,
removes hedging lines such as "no source we checked…", checks that internal links point to published pages, then deletes `draft: true`.
YMYL pages additionally need `reviewedBy` from a real reviewer who has read the page.
Each team's full research (facts with source URLs, plus the claims it could not verify) is in `docs/research/<category>.json`.

## clothing

**Positioning:** The Clothing hub helps parents buy the right baby clothes at the right size and time: how to measure and convert sizes, which fabric and sleepwear suit their home, how to wash and store clothes, and what to buy first, so they spend less and buy once.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `how-many-baby-clothes-do-you-need` | How many baby clothes do you need? | informational | no |
| `us-vs-eu-baby-clothing-sizes` | Do US and EU baby clothing sizes match? | comparative | no |
| `cotton-bamboo-or-merino-baby-clothes` | What is the best fabric for baby clothes: cotton, bamboo or merino? | comparative | no |

**Buying-guide ideas**

- How to choose a sleep sack by TOG and room temperature (chart by room temperature, fit, zips and sizing, with the safe-sleep rules linked)
- How to choose baby bodysuits and sleepers (fabric, openings for diaper changes, neckline, sizing and how many of each)
- How to choose a fragrance-free baby laundry detergent (ingredients, dosing, price per wash, certifications and what to avoid)

**Roadmap**

1. Staffing and operating model for the Clothing category: one content writer (EN now, DE later), one researcher (sources for size conversions, fabric facts and safety rules), one SEO/GEO specialist (answer format, schema, internal links, AI-citation tracking), one project manager (brief to publish tracking and the German held-page queue), and one UX/UI designer (table and checklist components, mobile tap targets, the tool layouts). Each hub gets this team or a shared allocation; the PM owns the weekly brief board.
2. Content: publish the three English briefs (how-many-baby-clothes-do-you-need, us-vs-eu-baby-clothing-sizes, cotton-bamboo-or-merino-baby-clothes) with a 40 to 60 word antwort, one table or checklist each, and sources checked by the researcher. Then add internal links from each clothing page to the newborn-size, sleeper-or-bodysuit and sleep-sack pages and to the buying guides. Add Article and BreadcrumbList structured data to clothing detail pages as already planned in AGENTS.md.
3. Tools: a baby clothing size calculator (enter length in cm, get EU size and US age-label equivalents, with a printable checklist saved by email under double opt-in). Build it with the UX/UI designer on the existing size data and keep it free of third-party trackers, consistent with the consent rules in AGENTS.md.
4. Comparison and buying guides: publish the three buying guides (sleep sack by TOG, bodysuits and sleepers, fragrance-free laundry detergent) on the /buying-guides/ template with comparison tables and an honest method note. Price data for comparisons is pulled by the researcher with a dated source line, and the total price includes shipping before any price alert is offered.
5. Commerce and quality gate: when the product layer under /produkte/ is ready, add affiliate links with a clear advertising label (AGENTS.md 5.3) and no formula advertising. In parallel the PM closes the German held pages in this hub: rewrite schlafsack-oder-decke-winter from the corrected English version (its current text contains unsafe advice) and get the reviewer, Mathilda, to read the English car-seat and sleep-sack pages before any ymyl page is released.

**Hub UI ideas (UX/UI)**

- 'Start here' path card at the top of the hub: three steps (1. find your baby's size, 2. learn how to wash and store, 3. plan the next size), each linking to the matching question.
- Size-by-age comparison table on the hub (EU size, body length, typical age, US label) that links each row to the newborn size question, built as a responsive table with horizontal scroll contained inside the card at phone width.
- Buying-guide card ('How to choose sleepers, bodysuits and sleep sacks') in mandarin-free ultramarine outline style, linking to the guide template once it exists.
- Product finder with three chips (age, climate, sleep style) that filters a short list of sleepers and bodysuits, with a 'Compare' button and no sign-up.
- Checklist teaser card ('First clothes checklist, 0 to 6 months') with a 'Save list' action, linking to the checklists collection.
- Price-comparison module placeholder with a mandarin buy button only on product rows, a limone 'Deal' chip for price drops, and a clear 'Ad' label per the affiliate rules.

## on-the-go

**Positioning:** On the go helps parents choose and use the gear they carry every day (stroller, car seat, carrier, bag) by matching each item to the baby's age, the family's routes and the car, so the first purchase is the right one.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `how-to-install-a-car-seat` | How do I install a car seat correctly? | informational | yes |
| `travel-system-or-separate-stroller` | Travel system or separate stroller and car seat: which should you buy? | comparative | no |
| `umbrella-stroller-or-full-size` | Umbrella stroller or full-size stroller: which one do you need? | comparative | yes |
| `can-i-take-a-car-seat-on-a-plane` | Can I take a car seat on a plane? | informational | yes |

**Buying-guide ideas**

- How to choose a car seat: rear-facing limits, i-Size or R44 approval, fit to your car, installation and ISOFIX (ymyl, needs reviewer)
- How to choose a baby carrier: newborn support, hip-healthy seating, weight and height range, hip belt, wrap or structured carrier
- How to choose a diaper bag: capacity, changing mat, insulated pockets, backpack or shoulder strap, stroller hook

**Roadmap**

1. Reviewer first: have Mathilda actually read the English car-seat and face-forward pages and the car-seat briefs above, because the publication gate only checks that a name is present. No ymyl brief ships without that read.
2. Build the /buying-guides/ template on the existing kaufberatung/en/how-to-choose-a-stroller (criteria table, fit notes, structured data) and publish the car-seat and carrier guides after review.
3. Publish the four new English briefs, add translationOf to the German hochstuhl page (English high-chair-age sits in the feeding hub), and rewrite the held German kindersitz-vorne-gewicht page (unsafe advice) from the English reference before German release.
4. Link question to guide to hub in every article body, add related-content modules and Article/BreadcrumbList schema, and add ItemList to the on-the-go hub; start every answer block with a 40-60 word direct answer for AI answer engines.
5. Commerce, only after the guides are live: a stroller and car seat comparison under /produkte/ showing total price including shipping, no 'best' claims without a documented method, and clearly labeled affiliate links.

**Hub UI ideas (UX/UI)**

- Start here path: a three-step card (1. Stroller now or later? 2. Carrier vs bassinet? 3. Car seat direction and safety) that links to the matching question pages.
- Comparison table teaser for the three main gear types (stroller, carrier, bassinet) with age, use case and typical price band, and a link to the full comparison.
- Product finder entry: a short quiz (lifestyle, car, storage, budget) that outputs a shortlist. Not built yet, and it must not imply a test result.
- Buying-guide card linking src/content/kaufberatung/en/how-to-choose-a-stroller.md, which exists but is not linked from the hub.
- Checklist card for travel gear (car seat, stroller, carrier, diaper bag) that links to the checklist section.
- Car seat direction and safety module with a clear 'rear-facing as long as the seat allows' takeaway linked to the car seat question and sources.

## diapering

**Positioning:** The Diapering hub tells parents how many diapers to buy, which size and type fits their baby, and how to keep the skin healthy, so they stop over- or under-buying and can compare products with honest, sourced answers.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `diaper-size-by-weight` | What diaper size does my baby need, by weight? | transactional | no |
| `diaper-rash-treatment` | What helps diaper rash? | informational | yes |
| `potty-training-readiness` | When can a toddler start potty training? | informational | yes |
| `pull-ups-vs-tape-diapers` | Are pull-ups better than tape diapers? | comparative | no |

**Buying-guide ideas**

- How to choose baby diapers: size, absorbency, skin sensitivity and price per diaper
- How to choose baby wipes: fragrance-free, water-based and cost per wipe
- How to choose a changing table or changing pad, with fall-safety rules built in

**Roadmap**

1. Staffing and ownership: give the Diapering hub its own owners (content writer, researcher for sources, SEO/GEO specialist, project manager, UX/UI designer for the hub and guide templates) before the four briefs go into production, since the existing German pages show each role's gaps.
2. Content: write the four English briefs and translate the two held German health pages (windeldermatitis-hilfe, windelentraining-ab-wann). Their ymyl gate needs a named reviewer who has actually read them, and the diaper-size page needs a verified source for weight ranges before publication.
3. Tools: build a client-side diaper budget calculator (child age or weight, diapers per day from the how-many page, pack size, price) with no sign-up. Offer an optional saved plan by email with double opt-in later, following the lead-generation roadmap.
4. Comparison and GEO: publish the diapers buying guide with a table of size, pack count and price per diaper, mark affiliate links as advertising, and add answer-first 40 to 60 word summaries, FAQ-style H2s and Article and BreadcrumbList data on every page. Then test the main questions in AI answer engines each month and record which pages get cited.
5. Internal linking and commerce: connect the hub with related-content modules (how-many, how-often, diaper rash, size, pull-ups vs tape) and link the hub to the reserved /produkte/ diaper listings. Launch price comparison with total price including shipping only after the buying guide and compliance checks pass.

**Hub UI ideas (UX/UI)**

- Start here path: three numbered cards (how many diapers per day, how often to change, cloth vs disposable) with the reading time for each, shown above the topic list.
- Comparison table for cloth vs disposable: upfront cost, cost per month, laundry effort, waste and skin considerations, with a short answer row at the top.
- Diaper-needs estimator: pick the baby's age range to show diapers per day and per month, with a link to the diapers-per-day question. Keep it free, with no sign-up.
- Buying-guide card 'How to choose diapers' (sizing by weight, absorbency, sensitive skin), styled as an ultramarine card with a mandarin buy button only when the price layer exists.
- Size-by-weight quick reference table (collapsible on mobile) so parents can check the right diaper size without reading a whole article.
- Stock-up checklist link: a short diapering checklist for the first month, linked from the hub.

## feeding

**Positioning:** For expecting and new parents, the Feeding category gives short, age-based answers on how much and how often to feed, when to change bottles, formula and solids, and which feeding gear is worth buying, so they can plan feeding without guessing or buying too much.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `how-much-should-baby-drink-first-year` | How much should a baby drink in the first year? | informational | yes |
| `when-to-stop-bottle-feeding` | When should a baby stop using a bottle? | informational | yes |
| `formula-stage-by-age` | Which formula stage does my baby need at each age? | comparative | yes |
| `which-baby-bottle-to-buy` | Which baby bottle should I buy? | comparative | yes |
| `when-to-start-solid-food` | When can a baby start solid food? | informational | yes |

**Buying-guide ideas**

- How to choose a baby bottle: materials, nipples, vents and how many to buy
- How to choose a bottle warmer and sterilizer: when you need one and what to compare
- How to choose a high chair: fit, footrest, base stability, cleaning and when to switch to a booster

**Roadmap**

1. Staff the Feeding category with one named owner per role: content writer (EN and DE), researcher (source checks and reviewer booking), SEO/GEO specialist (answer-first formatting, schema, internal links), project manager (weekly plan and publication-gate status) and UX/UI designer (comparison tables and tool layout). Assign owners in AGENTS.md before the next batch.
2. Content: rewrite and release the held German pages (flasche-trinken-beenden, saeuglingsnahrung-kuhmilchbasis, saeuglingsnahrung-nach-alter, salz-zucker-kleinkind, trinkmenge-baby-erstes-jahr), then publish the five English briefs above. Pages stay held until a real reviewer is named; do not add reviewedBy without that person's review.
3. Tools: build a first-year feeding planner (how much, how often, when to introduce solids, when to drop the bottle) that saves a checklist and can be emailed with double opt-in, and add a printable checklist for the bottle-to-cup switch.
4. Comparison: publish the bottle, bottle warmer and high chair comparisons with a written method (criteria, test sources, date) and link each buying guide from the question pages. Keep infant formula out of price comparison, deals and affiliate links.
5. Commerce: open the product layer under /produkte/ for feeding gear only, with total price including shipping, clear labeling of affiliate and sponsored links, and price alerts after the comparison pages have traffic. Add a consent layer before any analytics or third-party embeds.

**Hub UI ideas (UX/UI)**

- A 'Start here' path for new parents: 3-4 numbered steps (what you need for the first bottle, the first high chair, the first weaning month), each linking to one question, to help parents decide in order.
- A feeding-gear comparison table (bottle types, high chair types, bib and utensil types) with 3-5 criteria per row and a short 'best for' column. Keep it honest: criteria only, no paid placement.
- A buying-guide card ('How to choose a high chair' or 'How to choose a bottle') that sits in 'Keep going' on each question page and links to the guide, with a clear 'Ratgeber' label.
- A product finder: 3 quick questions (baby's age, space at home, budget band) that return a short list of matching feeding gear categories with a link to the relevant comparison. Store no personal data.
- A checklist module: 'Feeding starter kit' with checkboxes, saved in the browser, with a print option, linking to the matching checklist page.
- A 'Latest in feeding' module plus a 'Related questions' row at the end of each question page, so parents can move between the feeding questions without going back to the index.

## bath-and-care

**Positioning:** Bath & care gives new parents short, safe answers on bathing, skin and hair care, and the few products that are really worth buying, so they can skip the marketing noise and get on with the day.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `how-often-to-bathe-a-baby` | How often should you bathe a baby? | informational | yes |
| `how-to-bathe-a-newborn-before-cord-falls-off` | How do you bathe a newborn before the umbilical cord falls off? | informational | yes |
| `baby-bathtub-or-bath-seat` | Which baby bathtub is worth buying: tub, bath seat or sink insert? | comparative | yes |
| `do-babies-need-baby-shampoo` | Do babies need baby shampoo and body wash? | comparative | yes |
| `what-is-cradle-cap-and-how-to-treat-it` | What is cradle cap, and how do you treat it? | informational | yes |

**Buying-guide ideas**

- How to choose a baby bathtub: age, size, safety and storage
- How to choose a baby bath towel and hooded wrap
- How to choose a baby grooming kit: nail clippers, soft brush and comb

**Roadmap**

1. Staff the category with its own people, not shared time: a content writer for EN and DE, a researcher who checks every source and safety claim, an SEO/GEO specialist for query research and answer-first structure, a project manager who tracks the publication gate and reviewer sign-offs, and a UX/UI designer for the hub layout and the comparison table at 320 px. All five briefs are ymyl, so a named reviewer must read each page before it can be published.
2. Content: write and publish the five English briefs. Create the German file src/content/fragen/de/wie-oft-baden-baby.md first, because the translationOf link to it is dead until that file exists (today the entry is only in src/data/taxonomie.ts with no reviewer). Rewrite the German bath content from the English reference so that no unsafe advice is carried over.
3. Hub and GEO: link the bath hub to the existing diaper rash page (windeldermatitis-hilfe, hub 'windeln') instead of duplicating it, and to the diapering and safety hubs. Add an answer-first summary, Article and BreadcrumbList schema, and a related-content module on every detail page, so AI answer engines can quote the short answer directly.
4. Tools and buying guides: publish the first buying guide, 'How to choose a baby bathtub', on the /buying-guides/ template, with the comparison table as its core. Then build a saveable 'first bath kit' checklist that parents can email to themselves, using double opt-in and no tracking before consent.
5. Commerce: once the bathtub guide has an honest method, add the product layer under the reserved /produkte/ URLs for bathtubs, towels and grooming kits, with total price including shipping. Label every affiliate or sponsored link as advertising, and keep the category free of paid placements.

**Hub UI ideas (UX/UI)**

- 'Start here' path card at the top: 3 numbered steps (for example, what you need in the first week, then bath routine, then cord and skin care), each linking to one question page. Use ultramarine number chips on fog.
- Comparison table for bath products (baby bathtub vs sink insert vs bath seat, baby wash vs soap) with a 'best for' column and an 'honest pick' note, no paid placements. Use table styling with night header text on fog.
- Product finder with 3 filters (age, bath type, budget) that outputs 3 picks and a 'why' line. Keep the first step visible without JavaScript, and use a mandarin 'Compare prices' button only at the buy step.
- Buying-guide card under each question: 'How to choose a baby bathtub', with a checklist of 5 criteria and a link to the full guide. Use the chip-highlight style for 'Guide' labels.
- Mom-care block (postpartum care: perineal care, nipple cream, bath basics after birth) as a separate color-block tile on night, with a note that it is general information and a link to the doctor-advice question.
- Checklist module 'Bath & care starter kit' with checkboxes saved as a per-viewer convenience (localStorage fallback), plus a 'Email me this list' option once the lead-generation layer exists.

## breastfeeding

**Positioning:** Breastfeeding & pumping gives first-time parents short, safe answers on how often, how long and how to store milk, plus honest help choosing a pump, pads or storage that fits how they feed.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `how-often-to-breastfeed-newborn` | How often should a newborn breastfeed? | informational | yes |
| `how-long-is-breast-milk-good-for` | How long is breast milk good for in the fridge and freezer? | informational | yes |
| `manual-or-electric-breast-pump` | Manual or electric breast pump: which one do you need? | comparative | yes |
| `reusable-or-disposable-nursing-pads` | Reusable or disposable nursing pads: which is better? | comparative | no |
| `is-breastfeeding-pain-normal` | Is it normal for breastfeeding to hurt? | informational | yes |

**Buying-guide ideas**

- How to choose a breast pump (manual, single and double electric, hospital-grade rental, flange fit, and what to check before buying)
- How to choose a nursing pillow (shape, filling, washability, and when a pillow helps versus gets in the way)
- How to choose milk storage bags and containers (materials, sizes, freezer use, labeling, and what the storage guidance requires)

**Roadmap**

1. Staff the hub: assign an English content writer, a researcher who logs each claim against WHO, AWMF, RKI and a pump regulator, an SEO/GEO specialist for answer-first structure and schema, a project manager tracking the briefs, and a UX/UI designer for the hub page and comparison tables. Recruit an IBCLC lactation consultant as reviewer before any ymyl page carries a name.
2. Publish the five English briefs, holding the ymyl pages until a reviewer is named. Fill the empty German stillen hub by moving stillen-haeufigkeit from src/data/taxonomie.ts into a fragen/de file, add it to the publication gate check, and write the German versions of the other briefs. Add the regulator source key to the Sources page.
3. Build the tools: a milk-storage clock that turns the sourced storage table into discard times, and a first-feeding checklist saved by email with double opt-in (no formula offers).
4. Build the comparison layer: a sourced breast-pump spec table, then the /buying-guides/ template for how to choose a breast pump. Add price comparison and total price including shipping only after the specs are verified.
5. Commerce and GEO: label affiliate and advertising links on pump, pad and storage pages (section 5.3), add FAQ and Article structured data to the five pages, and link each question page to the hub and to the newborn feeding and sleep pages so AI answer engines can cite a clear chain.

**Hub UI ideas (UX/UI)**

- Start-here path for first-time breastfeeding parents: 3 to 4 numbered steps (latch basics, feeding frequency, when to call a lactation consultant, what to buy) on the hub, as a limone-accented card block.
- Buying-guide card on the hub: 'Which breast pump?' with a short answer, a 3-row comparison table (manual, electric single, electric double) and a mandarin 'Compare pumps' button.
- Comparison table module: bottle vs breast-pump storage, nipple shield vs no shield, with price range and a 'best for' column (informational first, no paid placements).
- Product finder quiz (3 questions: exclusively pumping or mixed, budget, travel or home) that returns a short shortlist; saves answers via a checklist link (lead-gen, no sign-up).
- Milk storage checklist, saveable and printable: freezer and fridge times, bottle labelling, what to bring when out, linked from the storage question page.
- Related-content module at the end of each question: 'next question', 'buying guide' and 'checklist' tiles in the topic color block style, with the ultramarine link text on white.

## nursery

**Positioning:** The Nursery & furniture category helps new parents build a safe, calm sleep space in any size of home, with honest answers on what to buy first, what to skip, and how long each piece lasts.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `newborn-essentials-first-weeks` | What does a newborn need for the first weeks at home? | informational | yes |
| `room-temperature-for-baby-sleep` | What room temperature is right for a baby's sleep room? | informational | yes |
| `bedding-for-baby-first-year` | What bedding does a baby need in the first year? | informational | yes |
| `bassinet-bedside-crib-or-crib` | Bassinet, bedside crib or crib: which should you buy first? | comparative | yes |

**Buying-guide ideas**

- How to choose a crib (kebab-case slug: how-to-choose-a-crib): fit and gap checks, the applicable safety standard (ASTM F1169 in the US, EN 716 in the EU), drop-side bans, convertible options and recall checks. Needs sources in quellen, or the gate holds it, as it does for the existing stroller guide.
- How to choose a crib mattress (slug: how-to-choose-a-crib-mattress): firmness, fit (no gap wider than two fingers), waterproof cover materials, weight of foam versus coil, and sizing for toddler beds. Links to the bedding and room-temperature pages.
- How to choose a baby monitor (slug: how-to-choose-a-baby-monitor): audio versus video, range, battery, and data privacy (local versus cloud streaming, GDPR-friendly setups for a German operator). Comparison is by criteria only, with no paid placements.

**Roadmap**

1. Content: publish the three German-to-English translations and the new bassinet-vs-crib comparison only after a named reviewer (not Mathilda unless she has read them) signs off, and correct the unverified 16 to 18 degrees figure first. Do not credit a reviewer on any page before that.
2. Buying guides: launch how-to-choose-a-crib and how-to-choose-a-crib-mattress on the /buying-guides/ template with sources filled in, and fix the stroller guide, which is held because its quellen is empty.
3. Tools: a free nursery and newborn checklist that parents can save or print, first as a static checklist on the /checklists/ template, then as a saved list with email delivery after double opt-in, when the lead layer arrives.
4. Comparison layer: add a crib and bassinet comparison table with criteria only (standard, size range, lifespan, footprint, recall status checked against CPSC and the EU Safety Gate), and internal links from each question page to the matching guide and back.
5. Commerce (later): the price comparison under /produkte/ for cribs and mattresses, showing total price including shipping, with affiliate or sponsored links labelled as advertising, and no paid rankings. Add Article and BreadcrumbList schema to the new pages, and ItemList on the category listing, before going live.

**Hub UI ideas (UX/UI)**

- 'Start here' path: a numbered 3-step card on the hub (1. Crib or bassinet, 2. Sleep sack and bedding, 3. Changing table) that links to the question pages in order.
- Comparison table on the crib question: crib vs bassinet vs co-sleeper by age range, footprint, and how long each lasts, with an honest 'best for' column and no paid placement.
- Nursery essentials checklist CTA (ultramarine card on night) that links to the checklists section and offers a print or save option, with no sign-up required.
- Buying-guide card: 'How to choose a crib' with a jump to a safety section (mattress fit, slat spacing) and a 'Next: buying guide' button in mandarin, dark text on it.
- Room-size planner module for the small-apartment question: pick room size (chips: under 8 m2, 8 to 12 m2, over 12 m2) and show which furniture fits, with a link to the related answer.
- Product finder teaser: 'What do you need first?' chip row (newborn, baby 3 to 6 months, toddler) that filters the hub's questions and, later, product picks.

## play

**Positioning:** Play helps parents choose toys, books and play gear that build movement, language and curiosity at each age, with clear safety checks and honest, age-matched recommendations.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `screen-time-by-age` | At what age can a child have screen time? | informational | yes |
| `baby-walker-or-push-toy` | Are baby walkers safe, or is a push toy better? | comparative | yes |
| `wooden-vs-plastic-toys-for-babies` | Are wooden or plastic toys better for babies? | comparative | yes |

**Buying-guide ideas**

- How to choose a baby play mat: size, thickness, washability, non-slip base and chemical-smell checks
- How to choose a play gym or activity center by age: what to look for at 0 to 3, 3 to 6 and 6 to 12 months, and when to retire it
- How to choose a first push toy or ride-on: stability, height, brake and a safe weight range for the first walking stage

**Roadmap**

1. Content: publish the screen-time page only after a named reviewer signs off and the AWMF and AAP differences are reconciled. Then rewrite the older German play pages that still say "du" into formal Sie.
2. Content and SEO: build the buying-guide template for /buying-guides/, link every play question to its guide and the Play hub (question to guide to hub), and add Article, BreadcrumbList and ItemList structured data to the hub listing.
3. Tools: a 0 to 12 month first-toys checklist grouped by skill (grasping, rolling, crawling, fine motor), saved and sent by email with double opt-in, plus a short age finder quiz that suggests the matching guide.
4. Comparison: product comparison modules for play mats, play gyms and push toys, built on a published safety-criteria list (CE mark, small parts, chemicals, weight limits). Do not rank products without a documented method.
5. Commerce: once the price-comparison layer and advertising labels exist, add retailer hand-off with total price including shipping. Do not add affiliate links to infant-formula content. Also find a child-development or pediatric reviewer for the ymyl play pages, because the current reviewer is a nurse and must actually read any page credited to her.

**Hub UI ideas (UX/UI)**

- "Start here" path: a three-step numbered row (0-3 months, 4-12 months, toddler) with limone number chips, each step linking to the one question page that matters most for that stage.
- Age-stage chip filter (chip-topic / chip-neutral) above the question list, so a parent can sort play and book questions by newborn, 6 months or 12 months without reading all of them.
- Comparison table module for products (play mat vs activity gym vs padded mat), with columns for best for, age range, safety check and price band. On mobile, stack each row as a card, which removes the clipped-table problem found above.
- Product finder card: a three-question quiz (floor space, age, how much floor time) that returns a recommended category and a 'save to my checklist' action. This is the lead-generation hook and can later link to the reserved /produkte/ URLs.
- Buying-guide card: 'How to choose beginning-reader books', with a checklist of text features and a link to the guide. Show a mandarin buy button only once the commerce layer exists, and label any affiliate link as advertising.
- Safety callout band on night with limone check marks: age-appropriate toys, choking-hazard and small-parts test, and no loose items in the crib. Keep it factual and link to sources, consistent with the safety guardrails.

## safety

**Positioning:** The Safety category shows parents how to make their home, nursery and car safe for a baby or toddler, with short, source-backed answers and honest comparisons of the gates, covers, blinds and car seats they are deciding between, so they know what to buy, what to skip and when to call a professional.

**Draft pages**

| Slug | Question | Intent | YMYL |
|---|---|---|---|
| `childproof-electrical-outlets` | How do I childproof electrical outlets? | informational | yes |
| `dangerous-household-items-for-toddlers` | What household items are most dangerous for toddlers? | informational | yes |
| `pressure-mount-vs-hardware-stair-gates` | Which stair gate is safer: pressure-mounted or hardware-mounted? | comparative | yes |
| `cordless-vs-corded-blinds-baby-safety` | Are corded window blinds dangerous for babies? | comparative | yes |
| `car-seat-installation-check` | How do I know if my car seat is installed correctly? | informational | yes |

**Buying-guide ideas**

- How to choose a car seat: i-Size (UN R129) vs. R44, and what to buy first
- How to choose a baby monitor: audio, video and app-based models, and what each can and cannot detect
- How to choose a childproofing starter set: gates, corner guards, outlet covers and window stops, and what to buy only if your home needs it

**Roadmap**

1. Unblock the hub first. All five German Safety pages (steckdosen-sichern-baby, gefaehrliche-hausgegenstaende-kleinkind, kindersitz-wann-kaufen-auto, sturzpraevention-kleinkind, wickeltisch-sturz-gefaehr) are ymyl: true with no reviewedBy, so the shipgate holds them. The hub has zero live pages in either language. Before release: a named reviewer must actually read each page, the sturzpraevention page description contradicts its body (it says Laufschuhe indoor schaden, the body says they help), and its slug contains an umlaut (sturzprävention-kleinkind) that should become sturzpraevention-kleinkind with a redirect. Owner: German content writer plus reviewer; a researcher checks each source.
2. Staff the Safety category as its own pod: one English content writer and one German content writer (formal Sie, US spelling in EN), one researcher who checks every safety claim against cpsc, unece, rki, awmf or who and logs the source per claim, one SEO/GEO specialist who writes a 40-60 word answer-first antwort and checks that each H2 is a question that AI answer engines can quote, one UX/UI designer who makes the tables and checklists readable at 320 px without horizontal scroll, and one project manager who tracks the gate and the reviewer queue against this plan.
3. Write and publish the five English briefs (childproof-electrical-outlets, dangerous-household-items-for-toddlers, pressure-mount-vs-hardware-stair-gates, cordless-vs-corded-blinds-baby-safety, car-seat-installation-check). Set translationOf on the two translations to their German slugs. The car-seat page needs a real reviewer before reviewedBy is filled; do not reuse Mathilda's name unless she reads that page. Mark every number in the stair-gate and blind pages as to-be-verified until the researcher confirms it in the source.
4. Build the first Safety tools, with the lead-capture step kept optional: an interactive room-by-room childproofing checklist that can be saved or printed (double opt-in email later, per the legal check), and a car-seat installation check guide with an interactive decision path by height and weight, not by age. Both must work without JavaScript and without storing personal data in the browser.
5. Connect Safety to comparison and commerce once the pages are live: buying guides for car seats, baby monitors and childproofing starter sets; comparison blocks for stair gates and blinds that link to the reserved /produkte/ layer later. Every affiliate or sponsored link must be labeled as advertising (AGENTS.md 5.3). Measure GEO: track which Safety answers are quoted by AI answer engines, and add Article and BreadcrumbList structured data to all Safety detail pages.

**Hub UI ideas (UX/UI)**

- Start here path: a 3-step path for the first year (newborn car seat, safe sleep setup, childproofing basics) with a progress tick list that links to each guide.
- Car seat finder by weight, height and age: a filter with a short answer and a rear-facing guidance note, linking to the car seat comparison. Must follow CPSC and the manufacturer's limits, with a reviewer credit.
- Safe sleep checklist (crib, mattress, sleep sack) as a printable or saveable checklist, with a clear 'nothing loose in the crib in year one' note, linking to the sleep guide.
- Comparison table for baby monitors, gates and corner guards: price columns, safety-standard column (for example the CPSC or EN standard), and a 'buy' button in mandarin with a clear advertising label.
- Recall lookup card: a link out to the CPSC recall search and a 'check your product' checklist, framed as a free helper with no paid placement.
- Age-based safety timeline (0-6 months, 6-12 months, toddler) as a horizontal scroll-snap on mobile and a vertical timeline on desktop, each stage linking to its question pages.
