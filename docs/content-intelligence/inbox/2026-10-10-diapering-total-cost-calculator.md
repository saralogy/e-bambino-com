# Content opportunity: Cloth vs disposable diaper total-cost calculator

- **Category:** Diapering
- **Priority:** P2
- **Decision:** Extend the existing comparison with an interactive or transparent calculation
- **Research date:** 2026-10-10
- **Confidence:** Medium — competitor format observed; local price and usage assumptions not independently benchmarked

## Recommendation
Do not create a near-duplicate “cloth vs disposable” article. Extend `cloth-vs-disposable-diapers` with a transparent cost model that lets parents use their own prices and routine.

## Competitor evidence
- UsefulHQ cost comparison: https://usefulhq.com/cloth-vs-disposable-diapers/ — publishes annual and multi-year estimates for cloth, disposable and service options, with assumptions. Observed 2026-10-10. Its headline savings are not independently verified and must not be copied.

## Differentiated utility
Model separate inputs for disposable unit price and daily use; cloth-kit upfront cost; laundry energy/water/detergent; replacement items; paid service fees; resale/reuse; and duration of use. Show formulas and a sensitivity table instead of one universal “cheaper” conclusion. Label market/currency and price date. If an interactive calculator is not feasible in the current static Astro setup, start with a transparent worked-example table and editable assumptions.

## Existing-site overlap and links
Existing pages: `cloth-vs-disposable-diapers`, `how-many-diapers-per-day`, `how-often-to-change-a-diaper`. Prefer updating the comparison page or merging content rather than creating a competing URL. Link to both quantity and changing-frequency pages.

## Suggested outline
**Title:** Cloth vs Disposable Diapers: Calculate Your Total Cost
**Meta:** Compare cloth, disposable and diaper-service costs using your own prices, laundry routine and reuse assumptions.
**H1:** Which diapering option costs less for your household?
- What costs belong in a fair comparison?
- How do you estimate disposable costs?
- How do you estimate cloth and laundry costs?
- How does reuse across children change the result?
- What non-financial trade-offs should you compare?

## SEO/GEO and risk
State all assumptions and date prices. Avoid fabricated savings percentages and claims that one option is universally cheaper or environmentally superior. This can be non-YMYL if limited to costs and logistics. Keep skin-health claims out unless properly sourced and reviewed.

## Handoff
Check whether an existing calculator/component exists before coding. Preserve current URL and metadata if updating the page. Report formula tests and mobile usability.
