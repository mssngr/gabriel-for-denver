import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const pages = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './site/pages' }),
})

const issues = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './site/issues' }),
})

export const collections = { pages, issues }
