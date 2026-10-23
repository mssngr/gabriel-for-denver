import type { APIRoute, GetStaticPaths } from 'astro'
import type { BallotItem, Lang } from './ballot'
import { getBallotGuide, getBallotItems } from './ballot-content'
import { ballotGuideOgTree, ballotOgTree } from './ballot-og'
import { ogPng, pngResponse } from './ballot-og-render'

/**
 * The preview-image endpoints under /ballot/og and /es/ballot/og, shared by
 * both languages' thin route files. Like ballot-content.ts this reads
 * `astro:content`, so it has no tests of its own; the images' content and
 * layout are covered in ballot-og.test.ts and ballot-og-render.test.ts.
 */

// `site` is set in astro.config.mjs, so it is always there at build.
const siteHost = (site: URL | undefined) => (site as URL).host

/** One image per published item. */
export const itemOgPaths: GetStaticPaths = async () => {
  const items = await getBallotItems()
  return items.map(({ data }) => ({
    params: { slug: data.slug },
    props: { item: data },
  }))
}

export function itemOgRoute(lang: Lang): APIRoute {
  return async ({ props, site }) => {
    const guide = await getBallotGuide()
    const item = props.item as BallotItem
    const host = siteHost(site)
    return pngResponse(await ogPng(ballotOgTree({ item, lang, guide, host })))
  }
}

export function guideOgRoute(lang: Lang): APIRoute {
  return async ({ site }) => {
    const guide = await getBallotGuide()
    const items = (await getBallotItems()).map(({ data }) => data)
    const host = siteHost(site)
    return pngResponse(
      await ogPng(ballotGuideOgTree({ items, lang, guide, host })),
    )
  }
}
