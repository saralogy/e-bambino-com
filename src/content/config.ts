import { defineCollection, z } from 'astro:content';

// Common schema for all content collections
const seoSchema = z.object({
  title: z.string().min(5).max(70).optional(),
  description: z.string().min(10).max(300).optional(),
  image: z.string().url().optional(),
  canonical: z.string().url().optional(),
});

const contentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().default('e-bambino Redaktion'),
  date: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().default('ratgeber'),
  seo: seoSchema.optional(),
  /** English entries: slug of the German original, links the two versions. */
  translationOf: z.string().optional(),
});

// Names collection (baby names with meaning and origin)
const namenCollection = defineCollection({
  type: 'content',
  schema: contentSchema.extend({
    typ: z.enum(['mädchen', 'jungen', 'girl', 'boy']).optional(),
    bedeutung: z.string().optional(),
    herkunft: z.string().optional(),
    popularitaet: z.string().optional(),
    variationen: z.array(z.string()).default([]),
    bekannte_traeger: z.array(z.string()).default([]),
  }),
});

// Checklists collection
const checklistenCollection = defineCollection({
  type: 'content',
  schema: contentSchema,
});

// Finanzhilfen collection
const finanzCollection = defineCollection({
  type: 'content',
  schema: contentSchema,
});

// Ratgeber collection
const ratgeberCollection = defineCollection({
  type: 'content',
  schema: contentSchema,
});

// Export all collections
export const collections = {
  namen: namenCollection,
  checklisten: checklistenCollection,
  finanz: finanzCollection,
  ratgeber: ratgeberCollection,
};
