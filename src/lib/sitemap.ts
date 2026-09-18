import { readdirSync, readFileSync } from 'node:fs'

/**
 * Which pages belong in `sitemap.xml`, and which guides are still drafts.
 *
 * The sitemap filter runs inside `astro.config.mjs`, where `astro:content`
 * doesn't exist yet — the collections aren't loaded when the config is
 * evaluated. So the draft slugs are read off the YAML directly, with the
 * narrowest parse that answers the question, rather than pulling in a YAML
 * parser the project doesn't otherwise depend on.
 */

const GUIDES_DIR = 'src/content/guides'

/** Matches `slug: housing-for-all`, quoted or not, on its own line. */
const SLUG_LINE = /^slug:\s*['"]?([^'"\n]+?)['"]?\s*$/m
/** Matches `status: published` exactly; anything else counts as a draft. */
const PUBLISHED_LINE = /^status:\s*['"]?published['"]?\s*$/m

/**
 * The slugs of every guide that isn't published yet.
 *
 * Deliberately fails towards "draft": a file this can't read, or one with no
 * `status` at all (the schema defaults it to draft), is treated as unpublished.
 * The cost of being wrong that way is a published page missing from the
 * sitemap for one deploy; the cost of the other way is an unfinished page
 * offered to search engines.
 */
export function readDraftGuideSlugs(guidesDir: string = GUIDES_DIR): string[] {
  return readdirSync(guidesDir)
    .filter(file => file.endsWith('.yml'))
    .map(file => readFileSync(`${guidesDir}/${file}`, 'utf8'))
    .filter(source => !PUBLISHED_LINE.test(source))
    .map(source => source.match(SLUG_LINE)?.[1])
    .filter((slug): slug is string => Boolean(slug))
}

/** Pages that exist for a purpose other than being found by a reader. */
const NOT_FOR_READERS = /\/(admin|thank-you|404)\/?$/
const POSTS = /(^|\/)posts(\/|$)/
/** One guide's page, in either language, capturing its slug. */
const GUIDE_PAGE = /^\/(?:es\/)?platform\/([^/]+)\/?$/

/**
 * Whether one built page belongs in the sitemap. `page` is the absolute URL
 * the sitemap integration hands over.
 *
 * A draft guide still builds a page, carrying `noindex`, so the campaign can
 * read its work in progress on the real domain. Listing it here would invite
 * exactly the crawl that `noindex` then turns away.
 */
export function includeInSitemap(
  page: string,
  draftGuideSlugs: readonly string[],
): boolean {
  const { pathname } = new URL(page)
  if (NOT_FOR_READERS.test(pathname) || POSTS.test(pathname)) return false
  const guideSlug = pathname.match(GUIDE_PAGE)?.[1]
  return !(guideSlug && draftGuideSlugs.includes(guideSlug))
}
