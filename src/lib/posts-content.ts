import { type CollectionEntry, getCollection } from 'astro:content'
import { assertUniqueSlugs } from './platform'

export type PostEntry = CollectionEntry<'posts'>

/**
 * Every post, checked for slug collisions once per build. Same reasoning as
 * `issues-content.ts` — `posts` also keys its entries off a `slug` field.
 */
let posts: ReturnType<typeof readPosts> | null = null

async function readPosts(): Promise<PostEntry[]> {
  const entries = await getCollection('posts')
  assertUniqueSlugs('posts', entries)
  return entries
}

export async function getPosts(): Promise<PostEntry[]> {
  posts ??= readPosts()
  return posts
}
