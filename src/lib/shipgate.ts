/**
 * shipgate.ts — build-time publication gate.
 *
 * YMYL pages (child health, safety, nutrition, sleep, breastfeeding) require a
 * NAMED human reviewer before they may be published. A missing reviewer is a
 * hard stop, not a warning: this module is imported by the page routes so an
 * unreviewed page cannot be built into dist/ even by accident.
 *
 * Rationale (eb-doctrine §2): a reviewer line without a real, named, qualified
 * human who read the page is worse than no reviewer at all. We will not fabricate
 * credentials, so the correct response is to hold the page, not to publish it.
 */

export interface Shippable {
  ship: boolean;
  reason: string;
}

/** YMYL clusters: any page touching these is blocked without a named reviewer. */
export function shipGate(entry: {
  slug: string;
  ymyl?: boolean;
  reviewedBy?: string;
  quellen?: string[];
  draft?: boolean;
}): Shippable {
  if (entry.draft) {
    return { ship: false, reason: `DRAFT — ${entry.slug} wartet auf die redaktionelle Überarbeitung.` };
  }
  if (entry.ymyl && !entry.reviewedBy?.trim()) {
    return {
      ship: false,
      reason: `YMYL-S OHNE benannten Reviewer — ${entry.slug} bleibt bis zur menschlichen Prüfung unveröffentlicht.`,
    };
  }
  if (!entry.quellen?.length) {
    return { ship: false, reason: `Keine Quellenangabe — ${entry.slug} ist nicht verifizierbar.` };
  }
  return { ship: true, reason: 'OK' };
}

/** Filter a collection down to what may be published right now. */
export function shippableOnly<T extends { data: { slug: string; ymyl?: boolean; reviewedBy?: string; quellen?: string[]; draft?: boolean } }>(
  entries: T[],
): T[] {
  return entries.filter((e) => shipGate(e.data).ship);
}

/** Pages held back, for build reporting. */
export function heldBack<T extends { data: { slug: string; ymyl?: boolean; reviewedBy?: string; quellen?: string[]; draft?: boolean } }>(
  entries: T[],
): { slug: string; reason: string }[] {
  return entries
    .map((e) => ({ slug: e.data.slug, ...shipGate(e.data) }))
    .filter((r) => !r.ship)
    .map(({ slug, reason }) => ({ slug, reason }));
}