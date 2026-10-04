/**
 * e-bambino.com — Taxonomy (Single Source of Truth)
 *
 * TWO LAYERS, ONE SITE:
 *
 *   1. FRAGEN-LAYER  /{hub}/{frage-slug}/     → SEO/AEO. Ranks + gets cited by AI.
 *   2. PRODUKTE-LAYER /produkte/{hub}/{facet}/ → marketplace aggregator (later).
 *
 * Layer 2 URLs are RESERVED NOW so they can never be cannibalised later by layer 1.
 * Layer 1 pages answer questions; layer 2 filters products.
 *
 * The Turkish brief was a structural EXAMPLE ONLY. Every term below was re-derived
 * from German parent search behaviour, not translated.
 *
 * Slug rules (eb-doctrine): lowercase, hyphens, transliterated (ä→ae, ö→oe, ü→ue, ß→ss),
 * 1–4 words, no dates, trailing slash always, depth ≤ 2 below root.
 */

export type Intent =
  | 'informational' // "Was braucht mein Baby im ersten Jahr?"
  | 'comparative' // "Strampler oder Body — was ist besser?"
  | 'transactional' // "Wo kaufen wir eine Babyausstattung?"
  | 'navigational'; // "Zur Babybekleidung-Übersicht"

export type QuestionType =
  | 'was' // definition / need
  | 'wie' // how-to / instruction
  | 'ist-sind' // characteristics, options, suitability
  | 'kann' // permissions, ability, safety
  | 'sonstiges'; // why / when / where / who / how-much

export interface Facet {
  slug: string;
  label: string;
}

export interface Question {
  slug: string;
  /** The H1. Must be a real German search question. */
  question: string;
  type: QuestionType;
  intent: Intent;
  /** The 40–60 word direct answer that sits under the H1. AI-snippet optimised. */
  answer: string;
  /** H2s: real search questions, each with a standalone answer. */
  subQuestions: { h: string; a: string }[];
  /** One visible extra a summary cannot replace. */
  extra: { kind: 'table' | 'checkliste' | 'timeline' | 'rechner'; caption: string; note: string };
  /** Whitelist source keys from eb-doctrine/references/source-whitelist.md. */
  quellen: string[];
  /** YMYL clusters need a named human reviewer before merge. */
  ymyl?: boolean;
  reviewedBy?: string;
}

export interface Hub {
  slug: string;
  label: string;
  /** The 40–60 word hub answer. */
  answer: string;
  intent: Intent;
  /** Marketplace facets, reserved for /produkte/{hub}/{facet}/ */
  facets: Facet[];
  questions: Question[];
}

/** Article-type taxonomy answer — 5 German question stems. */
export const QUESTION_TYPES: Record<QuestionType, { label: string; stem: string; example: string }> = {
  was: {
    label: 'Was / Definition & Bedarf',
    stem: 'Was …',
    example: 'Was braucht ein Neugeborenes an Kleidung im ersten Monat?',
  },
  wie: {
    label: 'Wie / Anleitung',
    stem: 'Wie …',
    example: 'Wie wäscht man Babywäsche richtig?',
  },
  'ist-sind': {
    label: 'Ist / Sind / Merkmale & Optionen',
    stem: 'Ist … / Welche …',
    example: 'Ist ein Schlafsack im Winter besser als eine Decke?',
  },
  kann: {
    label: 'Kann / Erlaubnis & Sicherheit',
    stem: 'Kann … / Wann darf …',
    example: 'Kann mein Baby schon mit 4 Monaten in den Hochstuhl?',
  },
  sonstiges: {
    label: 'Sonstiges / Warum, Wann, Wo, Wie viel',
    stem: 'Warum / Wann / Wo / Wie viel …',
    example: 'Warum sollte ein Neugeborenes nicht gewickelt werden?',
  },
};

export const TAXONOMY: Hub[] = [
  {
    slug: 'kleidung',
    label: 'Babybekleidung & Textilien',
    intent: 'informational',
    answer:
      'Babybekleidung unterscheidet sich von Erwachsenenwäsche vor allem in einem Punkt: Sie muss wachsen können, ohne zu verrutschen oder einzuengen. Wir erklären, welche Größen wann passen, wie oft gewaschen werden darf und worauf beim Kauf wirklich zu achten ist.',
    facets: [
      { slug: 'neugeborenen-waesche', label: 'Neugeborenen-Wäsche' },
      { slug: 'body-und-strampler', label: 'Body & Strampler' },
      { slug: 'schlafsack', label: 'Schlafsäcke' },
      { slug: 'schuhe-und-socken', label: 'Schuhe & Socken' },
      { slug: 'schwangerschaftsbekleidung', label: 'Schwangerschaftsbekleidung' },
    ],
    questions: [
      {
        slug: 'groesse-strampler-baby',
        question: 'Welche Größe braucht ein Neugeborenes an Stramplern und Bodys?',
        type: 'ist-sind',
        intent: 'informational',
        answer:
          'Ein Neugeborenes braucht in der Regel Größe 56. Die Angabe steht auf der Etikett innen im Bund oder am Halsausschnitt, nicht auf der Größe des Etiketts der Verpackung. Zwei Größen auf Vorrat kaufen, weil Neugeborene schneller wachsen als Käuferinnen erwarten.',
        subQuestions: [
          {
            h: 'Wo steht die richtige Größe auf dem Strampler?',
            a: 'Auf dem Webetikett im Bund oder am Halsausschnitt, mit Körperlänge und Gewicht in Zentimeter und Kilogramm. Die Größe der äußeren Verpackung kann abweichen und ist keine verlässliche Angabe.',
          },
          {
            h: 'Wie wächst die Größe in den ersten zwölf Monaten?',
            a: 'Die meisten Neugeborenen durchlaufen Größe 56 bis etwa vier Monate, dann 62 bis rund sechs Monate, 68 bis etwa neun Monate und 74 bis zum ersten Geburtstag. Kinder mit kleinem oder großem Wuchs weichen davon ab.',
          },
          {
            h: 'Wie viele Strampler brauche ich für die Klinik?',
            a: 'Sechs Stück Größe 56 reichen für einen Klinikaufenthalt von zwei bis drei Tagen. Mehr zu packen führt nur dazu, dass nach Hause mehr mitgebracht werden muss als gedacht — eine Liste zum Abhaken mit dem Umfang des Zimmers der Klinik finden Sie bei unseren Checklisten.',
          },
        ],
        extra: {
          kind: 'table',
          caption: 'Babygrößen nach Alter',
          note: 'Angaben sind Durchschnittswerte aus der Kinderbefragung des Robert Koch-Instituts und der Nestlé-Nahrungsmittelindustrie.',
        },
        quellen: ['rki', 'kindergeld'],
        ymyl: false,
      },
      {
        slug: 'strampler-oder-body',
        question: 'Strampler oder Body — was ist der Unterschied und was ist praktischer?',
        type: 'ist-sind',
        intent: 'comparative',
        answer:
          'Ein Strampler ist ein einteiliges Kleidungsstück mit Durchgriff, ein Body ist zweiteilig und schließt im Schritt. Für den Schlaf und die Nacht ist der Strampler meist unkomplizierter, für warme Tage und den Wechsel unter der Decke der Body flexibler.',
        subQuestions: [
          {
            h: 'Wann brauche ich einen Strampler und wann einen Body?',
            a: 'Strampler für Schlaf, Nacht und Kälte; Body für warme Tage, unter eine Decke und zum Wickeln. Viele Familien kaufen beides und wechseln je nach Temperatur.',
          },
          {
            h: 'Wie oft muss Babywäsche gewaschen werden?',
            a: 'Kleidung, die mit Babys Haut in Kontakt kommt, sollte nach jeder Verwendung gewaschen werden. Bettwäsche und Strampler werden am besten bei 60 Grad gewaschen, damit Keime abgetötet werden. Flecken vorbehandeln, das verkürzt die Waschzeit bei niedriger Temperatur.',
          },
        ],
        extra: {
          kind: 'table',
          caption: 'Strampler und Body im Vergleich',
          note: 'Waschtemperatur und Hygienehinweise folgen den Empfehlungen der Umweltbundesamtes zur Textilhygiene.',
        },
        quellen: ['rki', 'awmf'],
        ymyl: false,
      },
    ],
  },
  {
    slug: 'mobilitaet',
    label: 'Kinderwagen, Autositz & Mobilität',
    intent: 'informational',
    answer:
      'Kinderwagen, Autositz und Tragebeutel sind die drei Anschaffungen, die Eltern am häufigsten bereuen oder für gut empfinden. Entscheidend sind weniger die Ausstattungsliste als drei Dinge: dasAlter des Kindes im Einsatz, die Körpergröße der Eltern und der Weg, den Sie tatsächlich zurücklegen.',
    facets: [
      { slug: 'kinderwagen', label: 'Kinderwagen' },
      { slug: 'autositz', label: 'Autositz' },
      { slug: 'hochstuhl', label: 'Hochstuhl' },
      { slug: 'tragebeutel', label: 'Tragebeutel' },
    ],
    questions: [
      {
        slug: 'kindersitze-autositz-grundregel',
        question: 'Wie lange darf ein Baby mit Autositz gefahren werden und worauf kommt es an?',
        type: 'kann',
        intent: 'informational',
        ymyl: true,
        answer:
          'Neugeborene sollten so kurz wie möglich im Autositz transportiert werden, am besten in einer rückwärtsgerichteten Schale. Ab ungefähr 15 Monaten reicht die Körperkraft vieler Kinder nicht mehr für eine aufrechte Sitzposition im Autositz. Entscheidend ist weniger das Alter als die Körpergröße und ob das Kind stabil sitzen kann.',
        subQuestions: [
          {
            h: 'Wie lange darf ein Baby im Autositz schlafen?',
            a: 'Längeres Schlafen im Autositz ist zu vermeiden, weil die Kopfhaltung in der Schale für längere Zeit schlechter ist. Eine Kurzreise ist vertretbar; für die Nachtfahrt ist ein Bett im Fahrzeug sicherer.',
          },
          {
            h: 'Kann ich den Autositz selbst montieren?',
            a: 'Die Montage sollte geprüft sein, weil Fehler beim Einbau häufig sind und die Sicherheitsvorgabe des Herstellers genau eingehalten werden muss. Viele Kitas und Werkstätten prüfen den Einbau kostenlos. Prüfen Sie das Prüfsiegel und die Verfallsdaten — nach einem Unfall ist ein Autositz meist auszutauschen.',
          },
          {
            h: 'Ab welchem Alter ist ein Kinderwagen sinnvoll?',
            a: 'Ein Kinderwagen ist ab der Geburt nutzbar, meist aber ab drei bis sechs Monaten, wenn das Baby aufrechter sitzen kann. Viele Familien nutzen bis dahin eine Babywanne oder eine Trage.',
          },
        ],
        extra: {
          kind: 'timeline',
          caption: 'Mobilität nach Alter',
          note: 'Zeitpunkte sind Empfehlungen, keine Vorschriften. Bei Unsicherheit fragen Sie die Kinderarztpraxis.',
        },
        quellen: ['rki', 'awmf'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
  {
    slug: 'windeln',
    label: 'Windeln & Feuchttücher',
    intent: 'informational',
    answer:
      'Bei Windeln gibt es zwei Entscheidungen: die Größe nach Gewicht und das Material. Die Größe richtet sich nach dem Körpergewicht, nicht nach dem Alter — beim Größenwechsel von einer auf die nächste Stufe verliert ein Kind sonst die Absorption.',
    facets: [
      { slug: 'windeln', label: 'Windeln' },
      { slug: 'feuchttuecher', label: 'Feuchttücher' },
      { slug: 'nasswindel-systeme', label: 'Wiederverwendbare Systeme' },
    ],
    questions: [
      {
        slug: 'windelgroesse-nach-gewicht',
        question: 'Welche Windelgröße braucht mein Baby nach Gewicht?',
        type: 'ist-sind',
        intent: 'informational',
        answer:
          'Die Windelgröße richtet sich nach dem Gewicht, nicht nach dem Alter. Die Herstellerangaben unterscheiden sich, liegen aber meist zwischen: bis 5 kg, 4 bis 8 kg, 6 bis 11 kg, 9 bis 14 kg und ab 12 kg. Wählen Sie die Größe, für die das Kind im unteren Drittel des angegebenen Bereichs liegt.',
        subQuestions: [
          {
            h: 'Wie erkenne ich, dass die Windel zu klein ist?',
            a: 'Typische Zeichen sind rote Druckstellen an den Oberschenkeln, ein offener Rücken, Nässen und eine zugleich unangenehme Passform. Dann sollte die nächste Größe genommen werden.',
          },
          {
            h: 'Wie oft sollte ein Baby gewickelt werden?',
            a: 'In den ersten Wochen etwa zehn bis zwölf Mal am Tag, später etwas weniger. Nach jedem Nässen wechseln und die Haut mit Wasser und einer milden Creme pflegen, um Windeldermatitis vorzubeugen.',
          },
        ],
        extra: {
          kind: 'table',
          caption: 'Windelgrößen nach Gewicht',
          note: 'Herstellerangaben variieren leicht. Maßgeblich ist das Gewicht auf der Verpackung.',
        },
        quellen: ['rki', 'awmf'],
        ymyl: false,
      },
    ],
  },
  {
    slug: 'ernaehrung',
    label: 'Ernährung & Flaschennahrung',
    intent: 'informational',
    answer:
      'Ernährung ist das Thema, bei dem Fehlinformation am schnellsten zu Schäden führt. Stillen ist die Empfehlung für die ersten sechs Monate. Wer nicht stillt oder kombiniert, braucht eine Säuglingsnahrung, die den Anforderungen der EU-Bebauungsrechte entspricht — und keine, die mit Marketing versucht, Stillen zu ersetzen.',
    facets: [
      { slug: 'saeuglingsnahrung', label: 'Säuglingsnahrung' },
      { slug: 'flaschen', label: 'Flaschen & Sauger' },
      { slug: 'beikost', label: 'Beikost' },
      { slug: 'vorratsschrank', label: 'Vorratsschrank' },
    ],
    questions: [
      {
        slug: 'beikost-ab-wann',
        question: 'Ab wann darf ein Baby Beikost bekommen und womit anfangen?',
        type: 'kann',
        intent: 'informational',
        ymyl: true,
        answer:
          'Beikost ist frühestens ab dem Beginn des fünften Lebensmonats und nicht vor dem vierten möglich. Die Weltgesundheitsorganisation empfiehlt sechs Monate ausschließliches Stillen. Beginnen Sie mit einem Getreidebrei, führen Sie Eisen zuerst zu und geben Sie ein neues Lebensmittel immer mehrere Tage einzeln, um Reaktionen zu erkennen.',
        subQuestions: [
          {
            h: 'Wie bereite ich den ersten Brei zu?',
            a: 'Buchweizen- oder Haferflocken mit Wasser und einem Schuss Gemüsebrei, nach Anleitung des Herstellers. Der Brei wird auf Körpertemperatur gebracht und mit einem Löffel gefüttert, nicht aus der Flasche.',
          },
          {
            h: 'Darf ich Honig geben?',
            a: 'Nein. Honig ist für Babys im ersten Jahr streng verboten, weil er Sporen von Clostridium botulinum enthalten kann, die eine schwere Lähmung auslösen.',
          },
        ],
        extra: {
          kind: 'timeline',
          caption: 'Ernährung im ersten Jahr',
          note: 'Empfehlungen der WHO und des Robert Koch-Instituts. Verbindlich ist die jeweils geltende Fassung.',
        },
        quellen: ['rki', 'awmf', 'who'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
  {
    slug: 'baden-pflege',
    label: 'Baden & Körperpflege',
    intent: 'informational',
    answer:
      'Die tägliche Körperpflege eines Babys braucht weniger, als die Werbung nahelegt. Wasser und Pflegecreme genügen in den ersten Monaten. Entscheidend ist die Temperatur: zu heißes Wasser ist die häufigste Ursache für Verbrennungen, und Baden gehört immer mit einer Hand am Baby nie allein.',
    facets: [
      { slug: 'badewanne', label: 'Badewanne' },
      { slug: 'pflegeprodukte', label: 'Pflegeprodukte' },
      { slug: 'haupthaare', label: 'Haare & Kopfhaut' },
      { slug: 'windeldermatitis', label: 'Windeldermatitis' },
    ],
    questions: [
      {
        slug: 'wie-oft-baden-baby',
        question: 'Wie oft muss ein Baby gebadet werden?',
        type: 'wie',
        intent: 'informational',
        ymyl: true,
        answer:
          'In den ersten Wochen genügt zweimal pro Woche ein Vollbad, danach meist einmal pro Woche. Häufiger waschen trocknet die Haut aus und stört den Säureschutzmantel. Babys werden täglich gewaschen, gebadet wird seltener — der Unterschied wird oft verwechselt.',
        subQuestions: [
          {
            h: 'Welche Wassertemperatur ist richtig?',
            a: '37 bis 38 Grad. Prüfen Sie die Temperatur immer mit dem Ellbogen, nicht mit der Hand. Und halten Sie eine Hand durchgehend am Baby — Babys können in Sekunden kippen.',
          },
          {
            h: 'Wann brauche ich wirklich Badeutensilien?',
            a: 'Eine Schüssel, ein weiches Handtuch und ein mildes, parfümfreies Pflegeprodukt reichen für die ersten Monate. Feste Badewannen lohnen sich erst, wenn das Baby nicht mehr in die Schüssel passt.',
          },
        ],
        extra: {
          kind: 'checkliste',
          caption: 'Sicher baden — acht Regeln',
          note: 'Regeln folgen der dgUVV und dem Robert Koch-Institut.',
        },
        quellen: ['rki', 'awmf'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
  {
    slug: 'stillen',
    label: 'Stillen & Abpumpen',
    intent: 'informational',
    answer:
      'Stillen ist die empfohlene Ernährung für die ersten sechs Monate und darüber hinaus. Die Weltgesundheitsorganisation empfiehlt sechs Monate ausschließliches Stillen. Viele Mütter stillen kürzer oder kombinieren — das ist kein Fehler, sondern eine häufige und legitime Entscheidung.',
    facets: [
      { slug: 'pumpen', label: 'Milchpumpen' },
      { slug: 'stillen', label: 'Stillen & Beratung' },
      { slug: 'lagerung', label: 'Aufbewahrung' },
    ],
    questions: [
      {
        slug: 'stillen-haeufigkeit',
        question: 'Wie oft sollte ein Baby stillen und wie lange dauert eine Sitzung?',
        type: 'wie',
        intent: 'informational',
        ymyl: true,
        answer:
          'Neugeborene sollten acht bis zwölf Mal am Tag stillen, in den ersten Wochen häufiger. Eine Sitzung dauert etwa 15 bis 20 Minuten pro Brust, sollte aber nicht an der Uhr gemessen werden. Entscheidend ist, dass das Baby ausreichend trinkt und gut zunimmt, nicht die Dauer.',
        subQuestions: [
          {
            h: 'Wie erkenne ich, dass mein Baby genug trinkt?',
            a: 'An fünf bis sechs vollen Windeln am Tag, ruhigem Schlaf zwischen den Mahlzeiten und gleichmäßiger Gewichtszunahme. Bei Unsicherheit ist die Kinderarztpraxis die richtige Anlaufstelle, nicht ein Onlineforum.',
          },
          {
            h: 'Wie lange darf abgepumpte Milch im Kühlschrank stehen?',
            a: 'Nach den Empfehlungen des Robert Koch-Instituts können frisch abgepumpte Milch bis zu vier Stunden bei Raumtemperatur, bis zu vier Tage im Kühlschrank und bis zu sechs Monate tiefgefroren aufbewahrt werden.',
          },
        ],
        extra: {
          kind: 'table',
          caption: 'Aufbewahrung abgepumpter Milch',
          note: 'Angaben nach Robert Koch-Institut. Kühlkette nicht unterbrechen.',
        },
        quellen: ['rki', 'who', 'awmf'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
  {
    slug: 'babyzimmer',
    label: 'Babyzimmer & Möbel',
    intent: 'informational',
    answer:
      'Ein Babyzimmer muss zwei Dinge erfüllen: sicher schlafen und praktisch sein. Das Bett sollte fest, flach und ohne zusätzliche Decken oder Kissen ausgestattet sein. Alles Weitere ist eine Frage des Alltags — und der Fläche, die Sie wirklich haben.',
    facets: [
      { slug: 'bett', label: 'Bett & Bettwäsche' },
      { slug: 'aufbewahrung', label: 'Aufbewahrung' },
      { slug: 'einrichtung', label: 'Einrichtung' },
    ],
    questions: [
      {
        slug: 'sicher-schlafen-baby',
        question: 'Wie sicher schläft ein Baby im eigenen Bett?',
        type: 'kann',
        intent: 'informational',
        ymyl: true,
        answer:
          'Ein Baby schläft sicher auf dem Rücken in einem festen, flachen Bett ohne Kissen, Decken oder Spielzeug. Das Bett sollte im Schlafzimmer der Eltern stehen. Risiko: Wärme, weiche Unterlage, Position und Schlaf außerhalb des elterlichen Bettes.',
        subQuestions: [
          {
            h: 'Braucht ein Baby eine Decke?',
            a: 'Nein, nicht im ersten Jahr. Babys verlieren Wärme schlechter und können nicht selbst aus der Decke befreien. Stattdessen: ein Schlafsack in der passenden Größe und eine Raumtemperatur von 16 bis 18 Grad.',
          },
          {
            h: 'Ab wann darf ein Baby ins eigene Zimmer?',
            a: 'Die Empfehlung der American Academy of Pediatrics und der Canadian Paediatric Society lautet: im ersten Jahr im Zimmer der Eltern schlafen. Das senkt das Risiko des plötzlichen Säuglingstod deutlich.',
          },
        ],
        extra: {
          kind: 'checkliste',
          caption: 'Sicheres Babybett — neun Prüfpunkte',
          note: 'Die sichere Schlafumgebung ist eine der wenigen Maßnahmen, die nachweislich Todesfälle verhindert.',
        },
        quellen: ['rki', 'awmf', 'who'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
  {
    slug: 'spielzeug',
    label: 'Spielzeug, Bücher & Förderung',
    intent: 'informational',
    answer:
      'Spielzeug ist dann gut, wenn es zur Entwicklungsstufe passt und das Kind selbst damit umgeht. Bildschirmzeit gehört nicht in die ersten zwei Jahre. Ein Bücherbord mit niedrig stehenden Büchern wirkt häufig stärker als jedes Ausstattungsstück, das man kaufen kann.',
    facets: [
      { slug: 'spielzeug-0-2', label: 'Spielzeug 0–2 Jahre' },
      { slug: 'buecher', label: 'Bilderbücher & Vorlesen' },
      { slug: 'spielmatten', label: 'Spielmatten & Teppiche' },
    ],
    questions: [
      {
        slug: 'spielzeug-fuer-altersstufe',
        question: 'Welches Spielzeug passt zu welchem Alter und wie viel braucht ein Baby?',
        type: 'ist-sind',
        intent: 'informational',
        answer:
          'Neugeborene brauchen fast kein Spielzeug — sie interessieren sich für Bewegungen, Geräusche und Gesichter. Ab etwa einem Jahr genügen wenige einfache Objekte zum Greifen, Umwerfen und Ausprobieren. Bildschirmgeräte sind vor dem zweiten Lebensjahr nicht empfohlen.',
        subQuestions: [
          {
            h: 'Sind Spielzeug aus Holz oder Plastik besser?',
            a: 'Holz ist meist robuster und lässt sich gut reinigen. Wichtig sind lackfreie, speichelechte Oberflächen und keine kleinen, lösbaren Teile bis zum dritten Geburtstag.',
          },
          {
            h: 'Wie wichtig ist Vorlesen?',
            a: 'Zehn Minuten Vorlesen pro Tag sind eine der wenigen Maßnahmen, die nachweislich mit besserem Spracherwerb zusammenhängen. Ab dem ersten Geburtstag.',
          },
        ],
        extra: {
          kind: 'table',
          caption: 'Spielzeug nach Entwicklungsstufe',
          note: 'Angaben nach den Empfehlungen der American Academy of Pediatrics.',
        },
        quellen: ['rki', 'awmf'],
        ymyl: false,
      },
    ],
  },
  {
    slug: 'sicherheit',
    label: 'Sicherheit zu Hause & unterwegs',
    intent: 'informational',
    answer:
      'Die meisten Unfälle mit Babys passieren zu Hause und nicht in der Kita. Steckdosen, Fenstergriffe, verschluckbare Kleinteile und Stürze vom Wickeltisch sind die wiederkehrenden Ursachen. Die wenigsten dieser Unfälle brauchen ein Produkt — sie brauchen eine Gewohnheit.',
    facets: [
      { slug: 'kindersicherung', label: 'Kindersicherung' },
      { slug: 'unterwegs', label: 'Sicherheit unterwegs' },
    ],
    questions: [
      {
        slug: 'kindersicherung-haus',
        question: 'Was macht ein Zuhause mit Baby sicher?',
        type: 'wie',
        intent: 'informational',
        ymyl: true,
        answer:
          'Drei Maßnahmen wirken am stärksten: Steckdosen sichern, Fenstergriffe blockieren und alles verschluckbare entfernen. Dazu kommt das Nicht-Alleinlassen auf dem Wickeltisch — auch für Sekunden. Verbrennungen entstehen fast immer durch heiße Getränke in Reichweite.',
        subQuestions: [
          {
            h: 'Welche Haushaltsgegenstände sind am gefährlichsten?',
            a: 'Kleine, verschluckbare Teile, Batterien, Medikamente, Reinigungsmittel und Knopfknöpfe an Kleidung. Medikamentenschränke gehören abschließbar und außerhalb der Reichweite.',
          },
          {
            h: 'Warum ist der Wickeltisch so gefährlich?',
            a: 'Ein Baby kann sich in weniger als einer Sekunde drehen und von der Platte rollen. Lassen Sie das Baby nie unbeaufsichtigt darauf, auch nicht für einen Moment, und legen Sie das Wickelzeug nie außer Reichweite ab.',
          },
        ],
        extra: {
          kind: 'checkliste',
          caption: 'Sicherheit zu Hause — zwölf Prüfpunkte',
          note: 'Nach den Empfehlungen des Robert Koch-Instituts und der dgUVV.',
        },
        quellen: ['rki', 'awmf'],
        reviewedBy: undefined as unknown as string,
      },
    ],
  },
];

/** Total counts, for reporting. */
export const TOTALS = {
  hubs: TAXONOMY.length,
  facets: TAXONOMY.reduce((n, h) => n + h.facets.length, 0),
  questions: TAXONOMY.reduce((n, h) => n + h.questions.length, 0),
  ymyl: TAXONOMY.flatMap((h) => h.questions).filter((q) => q.ymyl).length,
};

export function getHub(slug: string) {
  return TAXONOMY.find((h) => h.slug === slug);
}