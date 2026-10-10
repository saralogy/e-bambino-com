// GEO: /llms-full.txt — the full text of every published English question, checklist and guide.
// Static endpoint, generated at build time. Sections are separated by '---'.
import type { APIRoute } from 'astro';
import { header, isoDate, label, publishedQuestions, checklists, guides, TEXT_HEADERS } from '../lib/llms';
import { SITE } from '../i18n';

export const prerender = true;

export const GET: APIRoute = async () => {
  const questions = await publishedQuestions();
  const sections: string[] = [];

  for (const { entry, url } of questions) {
    const d = entry.data;
    sections.push(
      [
        `## ${label(d.frage)}`,
        `URL: ${url}`,
        `Short answer: ${d.antwort.trim()}`,
        `Sources: ${d.quellen.join(', ')}`,
        `Updated: ${isoDate(d.updatedDate ?? d.date)}`,
        '',
        entry.body?.trim() ?? '',
      ].join('\n'),
    );
  }

  for (const { entry, url } of [...(await checklists()), ...(await guides())]) {
    const d = entry.data;
    sections.push(
      [
        `## ${label(String(d.title))}`,
        `URL: ${url}`,
        `Updated: ${isoDate((d.updatedDate ?? d.date) as Date)}`,
        '',
        entry.body?.trim() ?? '',
      ].join('\n'),
    );
  }

  const body = sections.join('\n\n---\n\n');
  const text = `${header()}\nFull text of the published English content. Index: ${SITE}/llms.txt\n\n---\n\n${body}\n`;

  return new Response(text, { headers: TEXT_HEADERS });
};
