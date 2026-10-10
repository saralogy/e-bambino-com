/**
 * Copy and routing for the simple article collections: checklists, guides and
 * (German only) finance. One index view and one detail view serve all three.
 */
import type { Lang, Section } from '../i18n';

export type ArticleCollection = 'checklisten' | 'ratgeber' | 'finanz';

interface CollectionCopy {
  section: Section;
  title: string;
  description: string;
  eyebrow: string;
  lede: string;
  chip: string;
  chipClass: string;
  open: string;
  empty: string;
  layout: 'cards' | 'rows';
  aside: { title: string; text: string; tone: 'limone' | 'night' | 'fog' };
}

export const COLLECTIONS: Record<ArticleCollection, Partial<Record<Lang, CollectionCopy>>> = {
  checklisten: {
    en: {
      section: 'checklists',
      title: 'Checklists',
      description: 'Practical checklists for the hospital bag, travel and everyday life with a baby: tick them off instead of looking things up.',
      eyebrow: 'Tick it off',
      lede: 'Practical lists for the hospital, travel and everyday life. Print them, tick them off, and bring only what you really need.',
      chip: 'Checklist',
      chipClass: 'chip-highlight',
      open: 'Open the list',
      empty: 'Checklists are on their way.',
      layout: 'cards',
      aside: {
        title: 'Tip for ticking off',
        text: 'Print this list and tick items off as you pack, or save it as a bookmark on your phone. Hospitals and countries differ, so check with your hospital what they provide.',
        tone: 'limone',
      },
    },
    de: {
      section: 'checklists',
      title: 'Checklisten',
      description: 'Praktische Checklisten für Klinik, Urlaub und Alltag, zum Abhaken statt zum Nachschlagen.',
      eyebrow: 'Zum Abhaken',
      lede: 'Praktische Listen für Klinik, Urlaub und Alltag. Ausdrucken, abhaken, und nur mitnehmen, was Sie wirklich brauchen.',
      chip: 'Checkliste',
      chipClass: 'chip-highlight',
      open: 'Liste öffnen',
      empty: 'Hier werden in den nächsten Tagen Checklisten ergänzt.',
      layout: 'cards',
      aside: {
        title: 'Tipp zum Abhaken',
        text: 'Drucken Sie diese Liste aus und haken Sie die Punkte direkt ab, oder speichern Sie sie als Lesezeichen auf dem Handy. Fragen Sie in Ihrer Klinik, was dort bereitgestellt wird.',
        tone: 'limone',
      },
    },
  },
  ratgeber: {
    en: {
      section: 'guides',
      title: 'Guides',
      description: 'Checked guides on sleep, development and everyday life with a baby, with sources disclosed.',
      eyebrow: 'Sources disclosed',
      lede: 'Checked articles on development, health and everyday life. Where a statement is medical, the source sits next to it, and when in doubt we tell you to ask your pediatrician.',
      chip: 'Guide',
      chipClass: 'chip-neutral',
      open: 'Read the guide',
      empty: 'Guides are on their way.',
      layout: 'cards',
      aside: {
        title: 'When to see a doctor',
        text: 'If your baby has a fever, trouble breathing, seems unusually drowsy or you are worried: do not wait, call your pediatrician or emergency services. This guide does not replace medical advice.',
        tone: 'fog',
      },
    },
    de: {
      section: 'guides',
      title: 'Ratgeber',
      description: 'Fachlich geprüfte Ratgeber zu Schlaf, Ernährung und Entwicklung, mit offengelegten Quellen.',
      eyebrow: 'Mit offengelegten Quellen',
      lede: 'Fachlich geprüfte Artikel zu Entwicklung, Gesundheit und Alltag. Wenn eine Aussage medizinisch ist, steht die Quelle daneben, und im Zweifel der Hinweis, die Kinderarztpraxis zu fragen.',
      chip: 'Ratgeber',
      chipClass: 'chip-neutral',
      open: 'Beitrag lesen',
      empty: 'Hier werden in den nächsten Tagen Ratgeber ergänzt.',
      layout: 'cards',
      aside: {
        title: 'Wann zum Arzt?',
        text: 'Bei Fieber, Atemnot, ungewöhnlicher Müdigkeit oder wenn Sie unsicher sind: bitte nicht warten. Dieser Beitrag ersetzt keine ärztliche Beratung.',
        tone: 'fog',
      },
    },
  },
  finanz: {
    de: {
      section: 'finance',
      title: 'Finanzielle Hilfen',
      description: 'Elterngeld, Kindergeld und weitere finanzielle Unterstützung für Familien, mit Beträgen, Fristen und Antragsunterlagen.',
      eyebrow: 'Mit Stand-Datum',
      lede: 'Elterngeld, Kindergeld und weitere Unterstützung für Familien, mit Beträgen, Fristen und den Unterlagen für den Antrag. Beträge können sich ändern; maßgeblich ist die Auskunft der zuständigen Stelle.',
      chip: 'Finanzielle Hilfe',
      chipClass: 'chip-topic',
      open: 'Lesen',
      empty: 'Hier werden in den nächsten Tagen weitere Hilfen ergänzt.',
      layout: 'rows',
      aside: {
        title: 'Verbindlich ist die Behörde',
        text: 'Diese Seite ist eine Orientierung, keine Rechts- oder Steuerberatung. Beträge und Fristen können sich ändern. Lassen Sie sich den aktuellen Stand bei der zuständigen Stelle bestätigen.',
        tone: 'night',
      },
    },
  },
};
