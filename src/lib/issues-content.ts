import { type CollectionEntry, getCollection } from 'astro:content'
import { assertUniqueSlugs } from './platform'

export type IssueEntry = CollectionEntry<'issues'>

/**
 * Every issue, checked for slug collisions once per build. `issues` keys its
 * entries off a `slug` field the same way `guides`/`planks` do — see
 * `assertUniqueSlugs` and `idFromFilename` in `platform.ts` for why that
 * check needs to run here rather than trusting the loader.
 */
let issues: ReturnType<typeof readIssues> | null = null

async function readIssues(): Promise<IssueEntry[]> {
  const entries = await getCollection('issues')
  assertUniqueSlugs('issues', entries)
  return entries
}

export async function getIssues(): Promise<IssueEntry[]> {
  issues ??= readIssues()
  return issues
}
