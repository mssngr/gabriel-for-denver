import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { guideSchema, plankSchema } from './lib/platform'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/pages' }),
  schema: () =>
    z.object({
      heading: z.string(),
      heading_es: z.string(),
      content: z.string(),
      content_es: z.string(),
      photoAltText: z.string(),
      photoAltText_es: z.string(),
    }),
})

const issues = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/issues' }),
  schema: () =>
    z.object({
      title: z.string(),
      title_es: z.string(),
      summary: z.string(),
      summary_es: z.string(),
      intro: z.string(),
      intro_es: z.string(),
      slug: z.string(),
      lucideIcon: z.string(),
      order: z.number(),
      subIssues: z
        .array(
          z.object({
            title: z.string(),
            title_es: z.string(),
            summary: z.string(),
            summary_es: z.string(),
            problemsAndSolutions: z.array(
              z.object({
                problem: z.string(),
                problem_es: z.string(),
                solution: z.string(),
                solution_es: z.string(),
              }),
            ),
          }),
        )
        .optional(),
    }),
})

// The platform: one guide per issue area, one plank per promise. Kept apart
// from `issues` on purpose so the new material can be written and previewed
// without touching what /issues renders today. Field definitions live in
// src/lib/platform.ts so the same shapes can be unit tested.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/guides' }),
  // `image()` is only available inside this callback, so artwork is the one
  // field that can't live alongside the rest of the schema.
  schema: ({ image }) => guideSchema.extend({ artwork: image().optional() }),
})

const planks = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/planks' }),
  schema: () => plankSchema,
})

const events = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      title_es: z.string(),
      location: z.string(),
      address: z.string().optional(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date().optional(),
      description: z.string(),
      description_es: z.string(),
      image: image().optional(),
      imageAlt: z.string().optional(),
      imageAlt_es: z.string().optional(),
    }),
})

const posts = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      title_es: z.string(),
      slug: z.string(),
      date: z.coerce.date(),
      intro: z.string(),
      intro_es: z.string(),
      content: z.string(),
      content_es: z.string(),
      photo: image(),
      photoAlt: z.string(),
      photoAlt_es: z.string(),
    }),
})

export const collections = { pages, issues, guides, planks, events, posts }
