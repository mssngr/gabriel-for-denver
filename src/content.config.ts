import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

const sections = defineCollection({
  loader: glob({ pattern: '**/*.yml', base: './site/content' }),
})

export const collections = { sections }
