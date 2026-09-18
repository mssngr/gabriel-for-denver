/**
 * Which Netlify deploy contexts should be kept out of search results.
 *
 * Netlify adds `X-Robots-Tag: noindex` to deploy previews and to *stale*
 * branch deploys, but not to the current deploy of a live branch. Since every
 * CMS save branch-deploys `content` (see AGENTS.md, "Deploys"), that URL is a
 * full copy of the site and would otherwise be indexable duplicate content.
 */

/** Netlify's own name for the live site; every other context is a copy of it. */
const PRODUCTION = 'production'

/**
 * `context` is Netlify's `CONTEXT` environment variable, absent off Netlify.
 * A local build gets no header at all — there is nothing to serve it, and
 * writing one would only show up as an unexplained diff in `dist`.
 */
export const shouldNoindex = (context: string | undefined): boolean =>
  Boolean(context) && context !== PRODUCTION
