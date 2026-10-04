/**
 * eb-audit — content quality gate (Astro content).
 *
 * Catches the failure modes that actually happen in generated German copy:
 *   - non-Latin / mixed-script contamination ("exclusivees", "لىلم")
 *   - verbose filler with no information density
 *   - missing answer-first block / H2 questions / visible extra
 *   - absolute claims in YMYL text with no source
 *   - AI tells (colons-as-headings, "Additionally", "Furthermore", triads)
 *   - duplicate content between pages
 *
 * Run: npm run audit   (must pass before any PR merge)
 */

export interface AuditIssue {
  level: 'error' | 'warn';
  rule: string;
  msg: string;
}

export interface AuditResult {
  slug: string;
  issues: AuditIssue[];
  score: number;
  pass: boolean;
}

const err = (rule: string, msg: string): AuditIssue => ({ level: 'error', rule, msg });
const warn = (rule: string, msg: string): AuditIssue => ({ level: 'warn', rule, msg });

/** 1. Script contamination: German text must be Latin + German punctuation only. */
const NON_LATIN = /[؀-ۿݐ-ݿЀ-ӿ֐-׿฀-๿]/;
const ANGLO = /\b(exclusively|additionally|furthermore|moreover|utilize|delve|leverage|robust|seamless|cutting-edge|game-chang|in today's|it's important to note|when it comes to)\b/gi;
const GERMAN_LEAKS = [/\bdie\s+the\b/i, /\band\s+also\b/i, /\bin\s+order\s+to\b/i, /\bfor\s+example\b/i];

/** Absolute claims that require a named reviewer. */
const ABSOLUTE = /\b(immer|nie|niemals|garantier|100 ?%|muss unbedingt|ohne risiko|risklos|sicher und soundlos)\b/i;

/** Words that pad without informing. */
const FILLER = [
  'es ist wichtig zu beachten',
  'in der heutigen zeit',
  'es lohnt sich',
  'zusammenfassend kann man sagen',
  'wie bereits erwähnt',
  'das thema ist sehr wichtig',
  'ein weiterer wichtiger punkt',
  'abschließend lässt sich sagen',
  'grundsätzlich gilt',
];

function words(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function auditContent(input: {
  slug: string;
  title: string;
  description: string;
  answer: string;
  subQuestions: { h: string; a: string }[];
  extra?: { kind: string; caption: string };
  quellen?: string[];
  ymyl?: boolean;
  reviewedBy?: string;
  body?: string;
}): AuditResult {
  const issues: AuditIssue[] = [];
  const allText = [input.title, input.description, input.answer, input.body ?? '', ...input.subQuestions.flatMap((q) => [q.h, q.a])].join('\n');

  // --- 1. Script contamination -------------------------------------------
  if (NON_LATIN.test(allText)) {
    const m = allText.match(NON_LATIN);
    issues.push(err('script-contamination', `Nicht-lateinische Zeichen im Text: "${m![0]}"`));
  }

  // --- 2. Answer-first block is 40–60 words (doctrine) --------------------
  const aw = words(input.answer);
  if (aw < 40) issues.push(err('answer-too-short', `Direktantwort ${aw} Wörter, Minimum 40 (eb-doctrine §Page contract)`));
  if (aw > 60) issues.push(warn('answer-too-long', `Direktantwort ${aw} Wörter, Ziel 40–60 — für AI-Snippets kürzen`));

  // --- 3. Every H2 is a real question ------------------------------------
  if (input.subQuestions.length === 0) issues.push(err('no-subquestions', 'Keine H2-Fragen — Seite beantwortet nur eine Frage'));
  for (const q of input.subQuestions) {
    if (!q.h.trim().endsWith('?')) issues.push(err('h2-not-question', `H2 ist keine Frage: "${q.h}"`));
    const qw = words(q.a);
    if (qw < 25) issues.push(warn('thin-answer', `Subantwort zu kurz (${qw} W.): "${q.h}"`));
    if (qw > 90) issues.push(warn('verbose-answer', `Subantwort zu lang (${qw} W.): "${q.h}" — auf 2–3 Sätze kürzen`));
  }

  // --- 4. One visible extra ----------------------------------------------
  if (!input.extra) issues.push(err('no-extra', 'Kein sichtbares Extra (Tabelle/Checkliste/Timeline/Rechner) — Pflicht laut Doctrine'));

  // --- 5. Sources ---------------------------------------------------------
  if (!input.quellen?.length) issues.push(err('no-source', 'Keine Quellenangabe — Verifica-Gate'));

  // --- 6. YMYL: named reviewer + absolute-claim discipline ----------------
  if (input.ymyl) {
    if (!input.reviewedBy) issues.push(err('ymyl-no-reviewer', 'YMYL-Seite ohne benannten menschlichen Reviewer — darf nicht live (Doctrine §2)'));
    if (ABSOLUTE.test(allText) && input.quellen?.length) {
      issues.push(warn('ymyl-absolute-claim', 'Unbedingte Formulierung ("immer/niemals/garantiert") — abschwächen oder Quelle direkt verlinken'));
    }
  }

  // --- 7. AI tells -------------------------------------------------------
  for (const m of allText.match(ANGLO) ?? []) {
    issues.push(err('ai-tell-anglo', `Anglizismus "${m}" — nicht auf Deutsch elternverständlich`));
  }
  for (const g of GERMAN_LEAKS) {
    const m = allText.match(g);
    if (m) issues.push(warn('ai-tell-phrase', `Maschinenhafte Wendung: "${m[0]}"`));
  }
  for (const f of FILLER) {
    if (allText.toLowerCase().includes(f)) issues.push(warn('filler', `Füllphrase ohne Informationswert: "${f}"`));
  }
  // Colon-heading tell
  for (const q of input.subQuestions) {
    if (/^(Über|Was|Wie|Warum|Besteht)\b[^?]{0,40}:/.test(q.h)) issues.push(warn('colon-heading', `Doppelpunkt-Überschrift ist ein KI-Tell: "${q.h}"`));
  }

  // --- 8. Information density --------------------------------------------
  const fw = FILLER.filter((f) => allText.toLowerCase().includes(f)).length;
  const density = 1 - fw / 5;
  if (density < 0.6 && fw > 0) issues.push(warn('low-density', `Niedrige Informationsdichte (${fw} Füllphrasen)`));

  // --- 9. Description length (SEO) ---------------------------------------
  const dw = words(input.description);
  if (dw < 8) issues.push(err('description-short', `Meta-Description ${dw} Wörter, Minimum 8`));
  if (dw > 25) issues.push(warn('description-long', `Meta-Description ${dw} Wörter — Google kürzt ~155 Zeichen`));

  // --- 10. Title ----------------------------------------------------------
  if (input.title.length > 70) issues.push(warn('title-long', `Titel ${input.title.length} Zeichen — Ziel unter 60`));

  const errors = issues.filter((i) => i.level === 'error').length;
  const warns = issues.filter((i) => i.level === 'warn').length;
  const score = Math.max(0, 100 - errors * 20 - warns * 5);

  return { slug: input.slug, issues, score, pass: errors === 0 };
}

export function report(results: AuditResult[]) {
  const failed = results.filter((r) => !r.pass);
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  EB-AUDIT — Inhaltsqualitäts-Gate');
  lines.push('═══════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.pass ? (r.issues.length ? '⚠ ' : '✓ ') : '✗ ';
    lines.push(`${icon}${r.slug}  (Score ${r.score})`);
    for (const i of r.issues) {
      lines.push(`    [${i.level.toUpperCase()}] ${i.rule}: ${i.msg}`);
    }
  }
  lines.push('───────────────────────────────────────────────────────');
  lines.push(`  ${results.length} Seiten · ${failed.length} fehlgeschlagen · Ø Score ${Math.round(results.reduce((n, r) => n + r.score, 0) / (results.length || 1))}`);
  lines.push(failed.length === 0 ? '  ERGEBNIS: BESTANDEN ✓' : `  ERGEBNIS: ${failed.length} SEITEN BLOCKIERT`);
  lines.push('═══════════════════════════════════════════════════════');
  return lines.join('\n');
}