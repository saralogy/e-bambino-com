import { defineConfig, defineCollection } from 'keystatic';

// Content type definitions
const namenCollection = defineCollection({
  name: 'Namen',
  description: 'Italienische Baby-Namen mit Bedeutung und Statistiken',
  folder: 'src/content/namen',
  schema: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
    },
    typ: {
      type: 'radio',
      label: 'Geschlecht',
      options: [
        { label: 'Mädchen', value: 'mädchen' },
        { label: 'Jungen', value: 'jungen' },
      ],
      required: true,
    },
    bedeutung: {
      type: 'text',
      label: 'Bedeutung',
      required: true,
    },
    herkunft: {
      type: 'select',
      label: 'Herkunft',
      options: [
        { label: 'Italienisch', value: 'italienisch' },
        { label: 'Lateinisch', value: 'lateinisch' },
        { label: 'Griechisch', value: 'griechisch' },
        { label: 'Andere', value: 'anderes' },
      ],
      required: true,
    },
    popularitaet: {
      type: 'radio',
      label: 'Beliebtheit',
      options: [
        { label: 'Beliebt', value: 'beliebt' },
        { label: 'Mittel', value: 'mittel' },
        { label: 'Seltener', value: 'seltener' },
      ],
    },
    varianten: {
      type: 'list',
      label: 'Varianten',
      fields: [
        {
          type: 'text',
          label: 'Variante',
          name: 'variante',
        },
      ],
    },
    statistik: {
      type: 'object',
      label: 'Statistik',
      fields: {
        rank_de: {
          type: 'number',
          label: 'Ranking DE',
        },
        rank_at: {
          type: 'number',
          label: 'Ranking AT',
        },
        rank_ch: {
          type: 'number',
          label: 'Ranking CH',
        },
        frequency: {
          type: 'number',
          label: 'Häufigkeit',
        },
      },
    },
    seo: {
      type: 'seo',
      label: 'SEO',
    },
    metaDescription: {
      type: 'text',
      label: 'Meta-Beschreibung',
    },
    tags: {
      type: 'tags',
      label: 'Tags',
    },
  },
});

const checklistenCollection = defineCollection({
  name: 'Checklisten',
  description: 'Praktische Listen für Klinik, Urlaub, Alltag und wichtige Lebensereignisse',
  folder: 'src/content/checklisten',
  schema: {
    titel: {
      type: 'text',
      label: 'Titel',
      required: true,
    },
    typ: {
      type: 'radio',
      label: 'Typ',
      options: [
        { label: 'Klinik', value: 'klinik' },
        { label: 'Urlaub', value: 'urlaub' },
        { label: 'Schule', value: 'schule' },
        { label: 'Alltag', value: 'alltag' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
      required: true,
    },
    beschreibung: {
      type: 'text',
      label: 'Beschreibung',
      required: true,
    },
    punkte: {
      type: 'list',
      label: 'Checkliste',
      fields: [
        {
          type: 'text',
          label: 'Punkt',
          name: 'punkt',
        },
        {
          type: 'boolean',
          label: 'Optional',
          name: 'optional',
          defaultValue: false,
        },
      ],
    },
    seo: {
      type: 'seo',
      label: 'SEO',
    },
    metaDescription: {
      type: 'text',
      label: 'Meta-Beschreibung',
    },
    tags: {
      type: 'tags',
      label: 'Tags',
    },
  },
});

const finanzCollection = defineCollection({
  name: 'Finanzhilfen',
  description: 'Elterngeld, Kindergeld, Kinderzuschlag und weitere finanzielle Unterstützung',
  folder: 'src/content/finanz',
  schema: {
    titel: {
      type: 'text',
      label: 'Titel',
      required: true,
    },
    typ: {
      type: 'radio',
      label: 'Typ',
      options: [
        { label: 'Elterngeld', value: 'elterngeld' },
        { label: 'Kindergeld', value: 'kindergeld' },
        { label: 'Kinderzuschlag', value: 'kinderzuschlag' },
        { label: 'Wohngeld', value: 'wohngeld' },
        { label: 'Steuer', value: 'steuer' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
      required: true,
    },
    betrag: {
      type: 'text',
      label: 'Betrag',
    },
    faelligkeit: {
      type: 'radio',
      label: 'Fälligkeit',
      options: [
        { label: '18 Monate', value: '18' },
        { label: '36 Monate', value: '36' },
        { label: '60 Monate', value: '60' },
      ],
    },
    voraussetzungen: {
      type: 'list',
      label: 'Voraussetzungen',
      fields: [
        {
          type: 'text',
          label: 'Voraussetzung',
          name: 'voraussetzung',
        },
      ],
    },
    antrag: {
      type: 'object',
      label: 'Antrag stellen',
      fields: {
        wo: {
          type: 'text',
          label: 'Wo',
        },
        frist: {
          type: 'text',
          label: 'Frist',
        },
        dokumente: {
          type: 'list',
          label: 'Benötigte Dokumente',
          fields: [
            {
              type: 'text',
              label: 'Dokument',
              name: 'dokument',
            },
          ],
        },
      },
    },
    quellen: {
      type: 'list',
      label: 'Quellen',
      fields: [
        {
          type: 'text',
          label: 'Quelle',
          name: 'quelle',
        },
      ],
    },
    seo: {
      type: 'seo',
      label: 'SEO',
    },
    metaDescription: {
      type: 'text',
      label: 'Meta-Beschreibung',
    },
    tags: {
      type: 'tags',
      label: 'Tags',
    },
  },
});

const ratgeberCollection = defineCollection({
  name: 'Ratgeber',
  description: 'Fachlich geprüfte Artikel zu Entwicklung, Gesundheit, Ernährung und Schlaf',
  folder: 'src/content/ratgeber',
  schema: {
    titel: {
      type: 'text',
      label: 'Titel',
      required: true,
    },
    typ: {
      type: 'radio',
      label: 'Typ',
      options: [
        { label: 'Beratung', value: 'beratung' },
        { label: 'Entwicklung', value: 'entwicklung' },
        { label: 'Gesundheit', value: 'gesundheit' },
        { label: 'Ernährung', value: 'ernährung' },
        { label: 'Schlaf', value: 'schlaf' },
        { label: 'Alltag', value: 'alltag' },
      ],
      required: true,
    },
    lesezeit: {
      type: 'number',
      label: 'Lesezeit (Minuten)',
    },
    experts: {
      type: 'list',
      label: 'Experten',
      fields: [
        {
          type: 'text',
          label: 'Name',
          name: 'name',
        },
        {
          type: 'text',
          label: 'Qualifikation',
          name: 'qualifikation',
        },
        {
          type: 'text',
          label: 'Zertifizierung',
          name: 'zertifizierung',
        },
      ],
    },
    seo: {
      type: 'seo',
      label: 'SEO',
    },
    metaDescription: {
      type: 'text',
      label: 'Meta-Beschreibung',
    },
    tags: {
      type: 'tags',
      label: 'Tags',
    },
  },
});

// Main Keystatic config
export default defineConfig({
  collection: {
    name: 'e-bambino',
    description: 'Italienischer Familienratgeber für DACH & EU',
    schema: {
      namen: namenCollection,
      checklisten: checklistenCollection,
      finanz: finanzCollection,
      ratgeber: ratgeberCollection,
    },
  },
  ui: {
    title: 'e-bambino CMS',
    logo: {
      default: '👶',
      light: '👶',
      dark: '👶',
    },
  },
});
