import { type CollectionEntry, getCollection, getEntry } from 'astro:content'
import { BALLOT_ITEM_TRANSLATABLE_FIELDS, sortBallot } from './ballot'
import { assertTranslated, assertUniqueSlugs } from './platform'

/**
 * Reads the ballot collections. Kept apart from `ballot.ts` for the same
 * reason `platform-content.ts` is: `astro:content` doesn't resolve under
 * vitest, so this file stays down to loading and the checks that need every
 * entry in hand at once.
 */

export type BallotItemEntry = CollectionEntry<'ballotItems'>
export type BallotGuideEntry = CollectionEntry<'ballotGuide'>

/**
 * Published items in ballot order. Two items sharing a slug would share an
 * anchor, leaving one unreachable, so that fails the build; so does a
 * published item missing a translation, since both languages go live at once.
 */
export async function getBallotItems(): Promise<BallotItemEntry[]> {
  const items = await getCollection('ballotItems')
  assertUniqueSlugs('ballotItems', items)
  assertTranslated('ballotItems', items, BALLOT_ITEM_TRANSLATABLE_FIELDS)
  return sortBallot(items.filter(item => item.data.status === 'published'))
}

/** The page's own copy and dates. There's only ever one entry. */
export async function getBallotGuide(): Promise<BallotGuideEntry['data']> {
  const guide = await getEntry('ballotGuide', 'current')
  if (!guide) {
    throw new Error(
      'src/content/ballot-guide/current.yml is missing; /ballot needs its dates.',
    )
  }
  return guide.data
}
