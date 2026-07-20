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
      summary: z.string(),
      summary_es: z.string(),
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

export const collections = { pages, issues }
