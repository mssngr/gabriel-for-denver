import { type CollectionEntry, getCollection } from 'astro:content'
import {
  assertGuideRefs,
  assertTranslated,
  assertUniqueSlugs,
  byOrder,
  GUIDE_TRANSLATABLE_FIELDS,
  PLANK_TRANSLATABLE_FIELDS,
  planksForPage,
  selectPublished,
} from './platform'

/**
 * The thin layer that actually reads the collections. It lives apart from
 * `platform.ts` on purpose: `astro:content` is a virtual module that doesn't
 * resolve under vitest, so anything importing it can't be unit tested. Keeping
 * this file to loading and delegation means the logic stays testable and only
 * the wiring doesn't.
 */

export type GuideEntry = CollectionEntry<'guides'>
export type PlankEntry = CollectionEntry<'planks'>

/**
 * Both collections, with every cross-entry invariant checked. These are the
 * assertions that can only run here — each one needs both collections in hand
 * at once, which no single schema can see.
 */
async function readPlatform() {
  const guides = await getCollection('guides')
  const planks = await getCollection('planks')
  assertUniqueSlugs('guides', guides)
  assertUniqueSlugs('planks', planks)
  assertGuideRefs(guides, planks)
  assertTranslated('guides', guides, GUIDE_TRANSLATABLE_FIELDS)
  assertTranslated('planks', planks, PLANK_TRANSLATABLE_FIELDS)
  return { guides, planks }
}

/**
 * One read per build. `getStaticPaths` and every page body below call this, so
 * without the cache the same entries get re-validated a dozen times over.
 */
let platform: ReturnType<typeof readPlatform> | null = null

function loadPlatform() {
  platform ??= readPlatform()
  return platform
}

/**
 * Every guide, drafts included, in display order. Drafts get a page too — it
 * carries `noindex` and nothing links to it, which is how the campaign reads
 * its own work in progress on the real domain.
 */
export async function getGuides(): Promise<GuideEntry[]> {
  const { guides } = await loadPlatform()
  return [...guides].sort(byOrder)
}

/** The planks that render on one guide's page. See `planksForPage`. */
export async function getPlanks(guide: GuideEntry): Promise<PlankEntry[]> {
  const { planks } = await loadPlatform()
  return planksForPage(planks, guide.data)
}

/** What the index page lists: published guides and their published planks. */
export async function getPublishedPlatform(): Promise<{
  guides: GuideEntry[]
  planks: PlankEntry[]
}> {
  const { guides, planks } = await loadPlatform()
  return selectPublished(guides, planks)
}
