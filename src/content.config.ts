import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { guideSchema, idFromFilename, plankSchema } from './lib/platform'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './src/content/pages' }),
  schema: () =>
    z.object({
      heading: z.string(),
      heading_es: z.string(),
      content: z.string(),
      content_es: z.string(),
      // Optional because not every page has a photo to describe: the platform
      // index is all cards. The pages that do have one still set it, and each
      // reads it with a `|| null` fallback already.
      photoAltText: z.string().optional(),
      photoAltText_es: z.string().optional(),
    }),
})

// `generateId` pins the id to the filename, same as `guides`/`planks` below —
// `issues` also keys its entries off a `slug` field, so it's exposed to the
// same silent-collision risk `idFromFilename` closes off.
const issues = defineCollection({
  loader: glob({
    pattern: '**/*.yml',
    base: './src/content/issues',
    generateId: ({ entry }) => idFromFilename(entry),
  }),
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
// `generateId` on both loaders below pins each entry's id to its filename
// instead of the glob loader's default, which reads the `slug` field when
// present. That default is what let two files silently share an id — see
// `idFromFilename` in src/lib/platform.ts.
const guides = defineCollection({
  loader: glob({
    pattern: '**/*.yml',
    base: './src/content/guides',
    generateId: ({ entry }) => idFromFilename(entry),
  }),
  // `image()` is only available inside this callback, so artwork is the one
  // field that can't live alongside the rest of the schema.
  schema: ({ image }) => guideSchema.extend({ artwork: image().optional() }),
})

const planks = defineCollection({
  loader: glob({
    pattern: '**/*.yml',
    base: './src/content/planks',
    generateId: ({ entry }) => idFromFilename(entry),
  }),
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

// `generateId` pins the id to the filename, for the same reason as `issues`
// above — `posts` also keys its entries off a `slug` field.
const posts = defineCollection({
  loader: glob({
    pattern: '**/*.yml',
    base: './src/content/posts',
    generateId: ({ entry }) => idFromFilename(entry),
  }),
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
