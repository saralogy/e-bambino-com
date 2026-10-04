import { auditContent, report } from '../src/lib/audit';

const good = auditContent({
  slug: 'good-page', title: 'Welche Windelgröße braucht mein Baby?',
  description: 'Die Windelgröße richtet sich nach Gewicht, nicht nach Alter, mit Herstellerunterschieden.',
  answer: 'Die Windelgröße richtet sich nach dem Gewicht, nicht nach dem Alter. Die Herstellerangaben unterscheiden sich, liegen aber meist zwischen 4 und 8 kg für die zweite Größe. Wählen Sie die Größe, für die das Kind im unteren Drittel des angegebenen Bereichs liegt, damit die Windel nicht ausläuert.',
  subQuestions: [{ h: 'Wie erkenne ich, dass die Windel zu klein ist?', a: 'Typische Zeichen sind rote Druckstellen an den Oberschenkeln, ein offener Rücken und zugleich Nässen. Dann sollte die nächste Größe genommen werden.' }],
  extra: { kind: 'table', caption: 'Windelgrößen' },
  quellen: ['rki'], ymyl: false,
});

const bad = auditContent({
  slug: 'bad-page', title: 'Alles über Babybekleidung: eine umfassende Einführung in die Welt der Kleidung für Neugeborene und Kleinkinder',
  description: 'Kleidung',
  answer: 'Babykleidung ist wichtig. Additionally, when it comes to choosing the right size, it is important to note that in order to make an informed decision you should consider several factors.',
  subQuestions: [{ h: 'Strampler oder Body:', a: 'Das kommt darauf an.' }],
  quellen: [], ymyl: true,
});

console.log(report([good, bad]));
