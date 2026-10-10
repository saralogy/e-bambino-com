/**
 * llms.ts — shared data for the GEO endpoints /llms.txt and /llms-full.txt.
 *
 * Both files follow the llmstxt.org format and list ONLY English content that
 * passes the publication gate (shipgate.ts). Nothing here is invented: every
 * line is built from frontmatter and body text in src/content/.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE, path, sectionPath, entryLang, entrySlug } from '../i18n';
import { hubsFor, type HubInfo } from '../i18n/hubs';
import { shipGate } from './shipgate';

export const SUMMARY =
  'Premium baby & mom guide: answers to the questions new parents actually have, honest product guidance, checklists and tools, all in one place. English (global) and German (/de/).';

export const INTRO = [
  'e-bambino is a free guide for expecting and new parents, from pregnancy through the toddler years. It answers the questions parents actually ask, compares products honestly without paid placements, and offers checklists and tools that save planning time.',
  'Every question page opens with a short answer, followed by the details. Sources are listed at https://e-bambino.com/sources/. The content is general information for parents and does not replace advice from a doctor or midwife.',
  'Contact: info@e-bambino.com. The site needs no sign-up.',
];

/** Absolute URL for a site path such as '/questions/'. */
export function abs(p: string): string {
  return `${SITE}${p}`;
}

/** Make a string safe for use inside a markdown link label. */
export function label(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/[\[\]]/g, '');
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export interface PublishedQuestion {
  entry: CollectionEntry<'fragen'>;
  hub: HubInfo | undefined;
  url: string;
}

export interface PlainEntry {
  entry: CollectionEntry<'checklisten'> | CollectionEntry<'ratgeber'> | CollectionEntry<'namen'>;
  url: string;
}

const hubOrder = hubsFor('en');

/** Every English question that passes the publication gate, grouped by hub order, then title. */
export async function publishedQuestions(): Promise<PublishedQuestion[]> {
  const all = await getCollection('fragen');
  return all
    .filter((e) => entryLang(e) === 'en' && shipGate(e.data).ship)
    .map((entry) => {
      const hub = hubOrder.find((h) => h.slug === entry.data.hub);
      return { entry, hub, url: abs(path('en', entry.data.hub, entry.data.slug)) };
    })
    .sort((a, b) => {
      const ha = hubOrder.findIndex((h) => h.slug === a.entry.data.hub);
      const hb = hubOrder.findIndex((h) => h.slug === b.entry.data.hub);
      return (ha < 0 ? 99 : ha) - (hb < 0 ? 99 : hb) || a.entry.data.frage.localeCompare(b.entry.data.frage);
    });
}

/** English hubs that have at least one published question, with their counts. */
export function topics(questions: PublishedQuestion[]): { hub: HubInfo; count: number }[] {
  return hubsFor('en')
    .map((hub) => ({ hub, count: questions.filter((q) => q.entry.data.hub === hub.slug).length }))
    .filter((t) => t.count > 0);
}

async function plainCollection(name: 'checklisten' | 'ratgeber' | 'namen', section: 'checklists' | 'guides' | 'names'): Promise<PlainEntry[]> {
  const all = await getCollection(name);
  return all
    .filter((e) => entryLang(e) === 'en')
    .map((entry) => ({ entry, url: abs(sectionPath('en', section, entrySlug(entry)) ?? '/') }))
    .sort((a, b) => String(a.entry.data.title).localeCompare(String(b.entry.data.title)));
}

export const checklists = () => plainCollection('checklisten', 'checklists');
export const guides = () => plainCollection('ratgeber', 'guides');
export const names = () => plainCollection('namen', 'names');

/** Headline and summary block shared by llms.txt and llms-full.txt. */
export function header(): string {
  return [`# e-bambino`, '', `> ${SUMMARY}`, '', INTRO.join('\n\n'), ''].join('\n');
}

export const TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
} as const;
