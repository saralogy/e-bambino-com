/**
 * Topic hubs in both languages. The German hubs come from the taxonomy;
 * English hubs have their own slugs and copy. The key is the German slug.
 */
import { TAXONOMY } from '../data/taxonomie';
import type { Lang } from './index';

export interface HubInfo {
  key: string;
  slug: string;
  label: string;
  answer: string;
}

const HUB_EN: Record<string, Omit<HubInfo, 'key'>> = {
  kleidung: {
    slug: 'clothing',
    label: 'Baby clothing',
    answer:
      'Babies change size every few weeks, so clothes have to grow with them. Here you find which size fits when, how to measure, how to wash baby clothes gently and how to buy the next size without overspending. Sizes are given in EU centimeters with the usual age labels.',
  },
  mobilitaet: {
    slug: 'on-the-go',
    label: 'Strollers, carriers & car seats',
    answer:
      'Getting around with a baby means choosing between strollers, bassinets, carriers and car seats, often before the birth. These answers explain what each one is for, from what age, and what matters when you buy, so the gear fits your routes, your car and your home.',
  },
  windeln: {
    slug: 'diapering',
    label: 'Diapers & changing',
    answer:
      'Diapers are the purchase you repeat most often. Learn how many a baby uses per day and per month, how often to change, how to keep skin healthy, and how disposable and cloth diapers compare on cost, effort and waste.',
  },
  ernaehrung: {
    slug: 'feeding',
    label: 'Feeding & mealtimes',
    answer:
      'From the first bottle to the high chair: practical answers on feeding gear and mealtime routines, with the age at which each step usually makes sense. Questions about nutrition and health are published only after review by a named expert.',
  },
  'baden-pflege': {
    slug: 'bath-and-care',
    label: 'Bath & care',
    answer:
      'Bathing, skin care and everyday hygiene for babies: how often, with what, and which products are worth buying. Health-related questions are published only after review by a named expert.',
  },
  stillen: {
    slug: 'breastfeeding',
    label: 'Breastfeeding & pumping',
    answer:
      'Breastfeeding, pumping and storing milk: practical answers and the gear that helps. Health-related questions are published only after review by a named expert.',
  },
  babyzimmer: {
    slug: 'nursery',
    label: 'Nursery & furniture',
    answer:
      'A nursery does not need to be big or complete on day one. These answers cover the furniture you really need, where the crib should stand, how long a crib lasts and how to make a small home work for a baby.',
  },
  spielzeug: {
    slug: 'play',
    label: 'Toys, books & play',
    answer:
      'Play is how babies learn to move, grasp and talk. Here you find which toys support each stage, how to read to a baby, how to choose first books and when a play mat is worth it, with safety checks for every age.',
  },
  sicherheit: {
    slug: 'safety',
    label: 'Safety at home',
    answer:
      'Babyproofing step by step: sockets, stairs, changing tables and everyday hazards, sorted by the age at which they matter. Safety pages are published only after review by a named expert.',
  },
};

export function hubsFor(lang: Lang): HubInfo[] {
  return TAXONOMY.map((h) =>
    lang === 'de'
      ? { key: h.slug, slug: h.slug, label: h.label, answer: h.answer }
      : { key: h.slug, ...HUB_EN[h.slug] },
  ).filter((h) => h.slug);
}

export function hubBySlug(lang: Lang, slug: string): HubInfo | undefined {
  return hubsFor(lang).find((h) => h.slug === slug);
}

export function hubByKey(lang: Lang, key: string): HubInfo | undefined {
  return hubsFor(lang).find((h) => h.key === key);
}
