/**
 * Runs the content audit over every question page in src/content/fragen/de/ (German gate)
 * and src/content/fragen/en/ (English checks).
 *
 * Usage: npm run audit            (or: npx -y tsx scripts/run-audit.ts [--json])
 *
 * Exit code 1 only on hard errors: missing sources on a page that is not held,
 * Italian references, emojis, or broken frontmatter. Warnings never fail the run.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import {
  auditContent,
  auditEnglish,
  report,
  reportEnglish,
  HARD_RULES,
  type AuditResult,
  type EnglishResult,
} from '../src/lib/audit';

const DE_DIR = new URL('../src/content/fragen/de/', import.meta.url).pathname;
const EN_DIR = new URL('../src/content/fragen/en/', import.meta.url).pathname;

function fm(txt: string) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const d: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    d[kv[1]] = kv[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
  }
  return { data: d, body: m[2] };
}

/** Parses `quellen: ["a", "b"]` or `quellen: a, b` into source keys. */
function sources(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/[[\]]/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function mdFiles(dir: string) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
}

// ---- German (existing gate) ------------------------------------------------
const deResults: AuditResult[] = mdFiles(DE_DIR).map((f) => {
  const txt = readFileSync(DE_DIR + f, 'utf-8');
  const p = fm(txt);
  if (!p) {
    return {
      slug: f.replace('.md', ''),
      issues: [{ level: 'error' as const, rule: 'frontmatter', msg: 'Kein valides YAML-Frontmatter' }],
      score: 0,
      pass: false,
    };
  }
  const { data, body } = p;
  // split body into H2 sections to pair each question with its answer
  const sections = body.split(/^##\s+/m).slice(1);
  const subQuestions = sections.map((s) => {
    const lines = s.split('\n');
    // Keep table cells as content: a table-only answer is a valid visible extra,
    // so stripping it would misreport a real answer as empty.
    return {
      h: lines[0].trim(),
      a: lines
        .slice(1)
        .join(' ')
        .replace(/^\|\s*[-:| ]+\|.*$/gm, ' ') // drop separator rows only
        .replace(/[*_`>#]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    };
  });

  return auditContent({
    slug: data.slug || f.replace('.md', ''),
    title: data.title || data.frage || '',
    description: data.description || '',
    answer: data.antwort || '',
    subQuestions,
    extra: /\|---/.test(body) || /- \[ \]/.test(body) ? { kind: 'table', caption: '' } : undefined,
    quellen: sources(data.quellen),
    ymyl: data.ymyl === 'true',
    reviewedBy: data.reviewedBy || '',
    body,
  });
});

// ---- English (new checks) --------------------------------------------------
const enResults: (EnglishResult | AuditResult)[] = mdFiles(EN_DIR).map((f) => {
  const txt = readFileSync(EN_DIR + f, 'utf-8');
  const p = fm(txt);
  if (!p) {
    return {
      slug: f.replace('.md', ''),
      issues: [{ level: 'error' as const, rule: 'frontmatter', msg: 'No valid YAML frontmatter' }],
      score: 0,
      pass: false,
      held: false,
    };
  }
  const { data, body } = p;
  return auditEnglish(body, {
    slug: data.slug || f.replace('.md', ''),
    antwort: data.antwort || '',
    quellen: sources(data.quellen),
    ymyl: data.ymyl === 'true',
    reviewedBy: data.reviewedBy || '',
  });
});

// ---- Output ----------------------------------------------------------------
const hardErrors = [...deResults, ...enResults].flatMap((r) =>
  r.issues
    .filter((i) => i.level === 'error' && ([...HARD_RULES, 'frontmatter'] as string[]).includes(i.rule))
    .map((i) => ({ slug: r.slug, ...i })),
);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ de: deResults, en: enResults, hardErrors }, null, 2));
} else {
  console.log(report(deResults));
  const ymylBlocked = deResults.filter((r) => r.issues.some((i) => i.rule === 'ymyl-no-reviewer'));
  const shippable = deResults.filter((r) => r.pass || !r.issues.some((i) => i.rule === 'ymyl-no-reviewer'));
  console.log(`\n  YMYL-gesperrt (kein benannter Reviewer): ${ymylBlocked.length}`);
  console.log(`  Technisch sauber & shippbar:            ${shippable.length}\n`);
  console.log(reportEnglish(enResults as EnglishResult[]));
  console.log(`\nHard errors (exit 1): ${hardErrors.length}`);
  for (const e of hardErrors) console.log(`  ${e.slug}: [${e.rule}] ${e.msg}`);
}

process.exitCode = hardErrors.length > 0 ? 1 : 0;
