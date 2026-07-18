import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

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
      content: z.string(),
      content_es: z.string(),
      link: z.string(),
      slug: z.string(),
      lucideIcon: z.string(),
      order: z.number(),
    }),
})

export const collections = { pages, issues }
