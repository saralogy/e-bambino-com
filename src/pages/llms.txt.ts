// GEO: /llms.txt — a machine-readable index of the English site (llmstxt.org format).
// Static endpoint, generated at build time. Lists only published content.
import type { APIRoute } from 'astro';
import { abs, header, label, plural, publishedQuestions, topics, checklists, guides, names, TEXT_HEADERS } from '../lib/llms';
import { sectionPath, path } from '../i18n';

export const prerender = true;

export const GET: APIRoute = async () => {
  const questions = await publishedQuestions();
  const hubs = topics(questions);
  const lists = [
    ['Checklists', await checklists()],
    ['Guides', await guides()],
    ['Baby names', await names()],
  ] as const;

  const lines: string[] = [header()];

  lines.push('## Topics', '');
  for (const { hub, count } of hubs) {
    lines.push(`- [${label(hub.label)}](${abs(path('en', hub.slug))}): ${plural(count, 'question')}`);
  }

  lines.push('', '## Questions', '');
  for (const q of questions) {
    lines.push(`- [${label(q.entry.data.frage)}](${q.url}): ${label(q.entry.data.description)}`);
  }

  for (const [title, items] of lists) {
    if (!items.length) continue;
    lines.push('', `## ${title}`, '');
    for (const { entry, url } of items) {
      lines.push(`- [${label(String(entry.data.title))}](${url}): ${label(String(entry.data.description ?? ''))}`.replace(/: $/, ''));
    }
  }

  lines.push(
    '',
    '## German version',
    '',
    `- [Deutsche Startseite](${abs(path('de'))}): Der Premium-Ratgeber für Baby und Mama, auf Deutsch`,
    `- [Fragen & Antworten (Deutsch)](${abs(sectionPath('de', 'questions') ?? '/de/fragen/')}): deutsche Fragen und Antworten`,
    '',
    '## Optional',
    '',
    `- [About](${abs(sectionPath('en', 'about') ?? '/about/')}): who runs e-bambino and how we work`,
    `- [Sources](${abs(sectionPath('en', 'sources') ?? '/sources/')}): the sources the editorial team checks content against`,
    `- [Legal notice](${abs(sectionPath('en', 'legal') ?? '/legal-notice/')}): operator details`,
    `- [Privacy](${abs(sectionPath('en', 'privacy') ?? '/privacy/')}): how the site handles data`,
    `- [Full text](${abs('/llms-full.txt')}): all published English questions, checklists and guides in one file`,
    '',
  );

  return new Response(lines.join('\n'), { headers: TEXT_HEADERS });
};
