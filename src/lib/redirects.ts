/**
 * Where each old `/issues/<slug>` page goes now that the platform is the
 * campaign's platform (PR 3 of docs/proposals/2026-09-13-platform-field-guide).
 *
 * Hand-written rather than derived, because the two content models don't line
 * up one-to-one: the platform reorganised six issues into six guides that
 * split and merge the old subjects. Four map onto a guide about the same
 * thing. "Affordability" doesn't — it spanned housing, childcare and food,
 * so it lands on the index where a reader can pick, rather than on whichever
 * guide we'd have had to choose for them.
 *
 * These are 301s on URLs that have been shared for a year. An old slug
 * missing from this map keeps rendering its own page until PR 4 deletes the
 * route, and then 404s, which is what `redirects.test.ts` guards against.
 */
export const ISSUE_TO_PLATFORM: Record<string, string> = {
  affordability: '/platform',
  'housing-crisis': '/platform/affordable-housing',
  'criminal-injustice': '/platform/accountable-public-safety',
  'food-security': '/platform/food-security',
  homelessness: '/platform/housing-for-all',
  'big-tech': '/platform/humans-before-ai',
}

/**
 * The full redirect table for `astro.config.mjs`: every issue in both
 * languages, plus the index. Astro's config redirects take priority over a
 * file route that would otherwise build at the same path, so these take
 * effect while `src/pages/issues/` is still in the repo — which is what keeps
 * the cutover revertible in one commit until PR 4 removes those routes.
 */
export function issueRedirects(): Record<string, string> {
  const redirects: Record<string, string> = {
    '/issues': '/platform',
    '/es/issues': '/es/platform',
  }
  for (const [slug, target] of Object.entries(ISSUE_TO_PLATFORM)) {
    redirects[`/issues/${slug}`] = target
    redirects[`/es/issues/${slug}`] = `/es${target}`
  }
  return redirects
}
