/**
 * Runs the (German-language) audit gate over every page in src/content/fragen/de/.
 * Usage: npx tsx scripts/run-audit.ts [--json]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { auditContent, report } from '../src/lib/audit';

const DIR = new URL('../src/content/fragen/de/', import.meta.url).pathname;

function fm(txt: string) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const d: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    d[kv[1]] = kv[2].trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, '$1');
  }
  return { data: d, body: m[2] };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));
const results = files.map((f) => {
  const txt = readFileSync(DIR + f, 'utf-8');
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
  const h2s = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
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
    quellen: data.quellen ? data.quellen.replace(/[[\]]/g, '').split(',').filter(Boolean) : [],
    ymyl: data.ymyl === 'true',
    reviewedBy: data.reviewedBy || '',
    body,
  });
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(report(results));
  const ymylBlocked = results.filter((r) => r.issues.some((i) => i.rule === 'ymyl-no-reviewer'));
  const shippable = results.filter((r) => r.pass || !r.issues.some((i) => i.rule === 'ymyl-no-reviewer'));
  console.log(`\n  YMYI-gesperrt (kein benannter Reviewer): ${ymylBlocked.length}`);
  console.log(`  Technisch sauber & shippbar:            ${shippable.length}`);
}