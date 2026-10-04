import { defineCollection, z } from 'astro:content';

/**
 * FRAGEN collection — the SEO/AEO question layer.
 *
 * This is the layer that ranks. Each page answers one real German search question
 * with a 40–60 word answer-first block, then 2–3 sentence answers under real
 * question H2s, plus one visible extra (table/checklist/timeline).
 *
 * Every page passes src/lib/audit.ts before merge.
 */

const fragen = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(10).max(70),
    description: z.string().min(20).max(180),
    author: z.string().default('e-bambino Redaktion'),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    hub: z.string(),
    category: z.string(),
    frage: z.string(),
    frageTyp: z.enum(['was', 'wie', 'ist-sind', 'kann', 'sonstiges']),
    intention: z.enum(['informational', 'comparative', 'transactional', 'navigational']),
    slug: z.string(),
    /** 40–60 words. The AI-snippet-optimised direct answer. */
    antwort: z.string(),
    quellen: z.array(z.string()).default([]),
    /** YMYL clusters need a named human reviewer before merge. Empty = blocked. */
    ymyl: z.boolean().default(false),
    reviewedBy: z.string().default(''),
  }),
});

export const collections = { fragen };