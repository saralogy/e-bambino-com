/**
 * i18n — languages, URL building and shared UI copy.
 *
 * English is the global version and lives at the root (/questions/…).
 * German lives under /de/ (/de/fragen/…). Content entries sit in
 * src/content/<collection>/<lang>/, so the first path segment of an entry id
 * is its language. An English entry points at its German counterpart with
 * `translationOf: <german slug>`.
 */

export type Lang = 'en' | 'de';
export const LANGS: Lang[] = ['en', 'de'];
export const DEFAULT_LANG: Lang = 'en';
export const SITE = 'https://e-bambino.com';

const SECTIONS = {
  questions: { en: 'questions', de: 'fragen' },
  names: { en: 'names', de: 'namen' },
  checklists: { en: 'checklists', de: 'checklisten' },
  guides: { en: 'guides', de: 'ratgeber' },
  buyingGuides: { en: 'buying-guides', de: 'kaufberatung' },
  finance: { en: null, de: 'finanz' },
  about: { en: 'about', de: 'ueber-uns' },
  sources: { en: 'sources', de: 'quellen' },
  legal: { en: 'legal-notice', de: 'impressum' },
  privacy: { en: 'privacy', de: 'datenschutz' },
} as const;

export type Section = keyof typeof SECTIONS;

/** Build a site path with trailing slash, e.g. path('de', 'fragen') → /de/fragen/. */
export function path(lang: Lang, ...parts: (string | null | undefined)[]): string {
  const segs = parts.filter((p): p is string => Boolean(p));
  const base = lang === 'de' ? '/de' : '';
  return segs.length ? `${base}/${segs.join('/')}/` : `${base}/`;
}

/** Path of a section in a language, or null if the section does not exist there. */
export function sectionPath(lang: Lang, section: Section, ...rest: (string | null | undefined)[]): string | null {
  const seg = SECTIONS[section][lang];
  return seg ? path(lang, seg, ...rest) : null;
}

/** Language of a content entry, from its folder (src/content/<collection>/<lang>/…). */
export function entryLang(entry: { id: string }): Lang {
  return entry.id.startsWith('en/') ? 'en' : 'de';
}

/** URL slug of a content entry without the language folder. */
export function entrySlug(entry: { slug: string }): string {
  return entry.slug.split('/').slice(1).join('/');
}

/** Key shared by an entry and its translation: the German slug. */
export function entryKey(entry: { slug: string; data: { translationOf?: string; slug?: string } }): string {
  return entry.data.translationOf ?? entry.data.slug ?? entrySlug(entry);
}

export function dateFormat(lang: Lang, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', opts);
}

export const OTHER: Record<Lang, Lang> = { en: 'de', de: 'en' };

/** Copy shared by the layout, header and footer. Page copy lives next to each view. */
export const UI = {
  en: {
    siteTitle: 'e-bambino | Baby & mom, all in one place',
    siteDescription:
      'e-bambino is the premium guide for baby and mom: clear answers, honest product comparisons and checklists for pregnancy and the first years, all in one place.',
    ogLocale: 'en_US',
    skip: 'Skip to content',
    homeLabel: 'e-bambino home',
    notice: ['Everything for baby & mom in one place', 'Honest, independent picks', 'Free, no sign-up'],
    nav: { questions: 'Questions', names: 'Baby names', checklists: 'Checklists', guides: 'Guides', about: 'About' },
    mainNav: 'Main navigation',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    langSwitch: 'Choose language',
    footerTagline:
      'The premium guide for baby and mom. Answers, product comparisons and checklists for pregnancy and the first years, all in one place.',
    footerSections: 'Explore',
    footerLegal: 'Legal',
    footerContact: 'Contact',
    footerTeam: 'Editorial team & methods',
    questionsAll: 'Questions & answers',
    sources: 'Sources',
    legal: 'Legal notice',
    privacy: 'Privacy',
    rights: 'All rights reserved.',
    aiNote: 'General information for parents. It does not replace advice from your doctor or midwife.',
    home: 'Home',
  },
  de: {
    siteTitle: 'e-bambino | Baby & Mama, alles an einem Ort',
    siteDescription:
      'e-bambino ist der Premium-Ratgeber für Baby und Mama: klare Antworten, ehrliche Produktvergleiche und Checklisten für Schwangerschaft und die ersten Jahre, an einem Ort.',
    ogLocale: 'de_DE',
    skip: 'Zum Inhalt springen',
    homeLabel: 'e-bambino Startseite',
    notice: ['Alles für Baby & Mama an einem Ort', 'Ehrliche, unabhängige Empfehlungen', 'Kostenlos, ohne Anmeldung'],
    nav: { questions: 'Fragen', names: 'Namen', checklists: 'Checklisten', finance: 'Finanzielle Hilfen', guides: 'Ratgeber', about: 'Über uns' },
    mainNav: 'Hauptnavigation',
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
    langSwitch: 'Sprache wählen',
    footerTagline:
      'Der Premium-Ratgeber für Baby und Mama. Antworten, Produktvergleiche und Checklisten für Schwangerschaft und die ersten Jahre, an einem Ort.',
    footerSections: 'Bereiche',
    footerLegal: 'Rechtliches',
    footerContact: 'Kontakt',
    footerTeam: 'Redaktion & Arbeitsweise',
    questionsAll: 'Fragen & Antworten',
    sources: 'Quellen',
    legal: 'Impressum',
    privacy: 'Datenschutz',
    rights: 'Alle Rechte vorbehalten.',
    aiNote: 'Allgemeine Informationen für Eltern. Sie ersetzen nicht den Rat von Ärztin, Arzt oder Hebamme.',
    home: 'Start',
  },
} as const;
