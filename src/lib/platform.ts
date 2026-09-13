import { z } from 'astro/zod'
import { stripMarkdown } from './seo'
import { slugify } from './slug'

/**
 * The platform content model: `guides` (one per issue area) and `planks` (one
 * per promise). Everything here is deliberately free of `astro:content` so it
 * can be unit tested — vitest runs in a plain node environment where Astro's
 * virtual modules don't resolve, which is why `src/lib/events.ts` has no tests
 * today. Pages read the collections and hand the entries to these functions.
 */

export type Lang = 'en' | 'es'

/** An entry as a content collection hands it over: an id plus parsed data. */
export type Entry<T> = { id: string; data: T }

export const BAND_THEMES = ['ink', 'sky', 'gold', 'paper'] as const
export type BandTheme = (typeof BAND_THEMES)[number]

/**
 * The rotation bands cycle through when a plank doesn't name its own theme.
 * Ink is the workhorse; sky and gold alternate as the light beats so a long
 * guide doesn't read as a two-stripe zebra.
 */
export const BAND_ROTATION: readonly BandTheme[] = ['ink', 'sky', 'ink', 'gold']

const TIMELINES = [
  'day-one',
  'first-budget',
  'ordinance',
  'ballot-referral',
  'ongoing',
] as const

const publishStatus = z.enum(['draft', 'published'])
export type PublishStatus = z.infer<typeof publishStatus>

/**
 * `_es` twins are optional here so a plank can be drafted in English and
 * saved. Completeness is enforced at publish time instead, by
 * `assertTranslated` — see that function for why the gate sits there.
 */
export const guideSchema = z.object({
  title: z.string(),
  title_es: z.string().optional(),
  slug: z.string(),
  stance: z.string(),
  stance_es: z.string().optional(),
  lucideIcon: z.string(),
  order: z.number(),
  status: publishStatus.default('draft'),
  artworkAlt: z.string().optional(),
  artworkAlt_es: z.string().optional(),
  lastReviewed: z.coerce.date().optional(),
  related: z.array(z.string()).optional(),
  metaDescription: z.string().optional(),
  metaDescription_es: z.string().optional(),
})

export const plankSchema = z.object({
  guide: z.string(),
  slug: z.string(),
  order: z.number(),
  status: publishStatus.default('draft'),
  kicker: z.string().optional(),
  kicker_es: z.string().optional(),
  // A string, not a number, so "77%", "1 in 3" and "$1.2B" all work without
  // any formatting logic deciding what a figure is supposed to look like.
  statValue: z.string().optional(),
  statCaption: z.string().optional(),
  statCaption_es: z.string().optional(),
  pullQuote: z.string().optional(),
  pullQuote_es: z.string().optional(),
  commitment: z.string(),
  commitment_es: z.string().optional(),
  why: z.string(),
  why_es: z.string().optional(),
  detail: z.string().optional(),
  detail_es: z.string().optional(),
  authority: z.string().optional(),
  authority_es: z.string().optional(),
  timeline: z.enum(TIMELINES).optional(),
  sources: z
    .array(
      z.object({
        label: z.string(),
        label_es: z.string().optional(),
        // Deliberately not `.url()`. A Sveltia save commits straight to
        // main, so a strict URL check here turns one typo into a failed
        // build for the whole site. The CMS field carries a `pattern` that
        // catches it at the point of entry instead, where it is fixable.
        url: z.string(),
      }),
    )
    .optional(),
  theme: z.enum(BAND_THEMES).optional(),
})

export type Guide = z.infer<typeof guideSchema>
export type Plank = z.infer<typeof plankSchema>

/**
 * Fields that already fall back to something sensible per language, so filling
 * one side and leaving the other is a real editorial choice rather than a gap.
 * `metaDescription` defaults to `stripMarkdown(stance)` in whichever language
 * the page is in, which is the whole reason it exists — an editor who
 * overrides only the Spanish snippet because the generated one reads badly has
 * done nothing wrong, and failing the site's build over it is exactly the
 * outcome this schema is shaped to avoid.
 *
 * Nothing else belongs here. A one-sided `kicker` or `pullQuote` genuinely
 * diverges the two pages, and `localized()` would render the English text on
 * the Spanish page rather than omit it, which is worse than a gap.
 */
const SELF_FALLBACK_FIELDS: readonly string[] = ['metaDescription']

/**
 * Every field the schema gives an `_es` twin, derived from the shape rather
 * than listed by hand so a new translatable field is covered by the publish
 * gate the moment it's added.
 *
 * Only top level, so a source's `label_es` is never gated — deliberately: a
 * source label is usually a document title ("Denver zoning analysis, 2024"),
 * and those are often correct untranslated. There's a test pinning this.
 */
function translatableFields(shape: z.ZodRawShape): readonly string[] {
  return Object.keys(shape).filter(
    key =>
      !key.endsWith('_es') &&
      `${key}_es` in shape &&
      !SELF_FALLBACK_FIELDS.includes(key),
  )
}

export const GUIDE_TRANSLATABLE_FIELDS = translatableFields(guideSchema.shape)
export const PLANK_TRANSLATABLE_FIELDS = translatableFields(plankSchema.shape)

/**
 * Which theme a band gets. Modulo rather than a per-index branch, so adding a
 * twelfth plank can't fall through to no background the way the sub-issue
 * colour chain in `src/pages/issues/[id].astro` does past its third case.
 */
export function bandTheme(index: number, override?: BandTheme): BandTheme {
  if (override) return override
  const length = BAND_ROTATION.length
  return BAND_ROTATION[((index % length) + length) % length]
}

/**
 * A field in the reader's language, falling back to English when the Spanish
 * twin is missing. That fallback only ever shows on a draft — `assertTranslated`
 * stops a half-translated entry from being published at all.
 */
export function localized<T extends object, K extends TranslatableKey<T>>(
  data: T,
  field: K,
  lang: Lang,
): string | undefined {
  const values = data as Record<string, string | undefined>
  if (lang === 'es') return values[`${field}_es`] || values[field]
  return values[field]
}

/** The keys of `T` that have an `_es` twin — the only ones worth localizing. */
type TranslatableKey<T> = {
  [K in keyof T & string]: `${K}_es` extends keyof T ? K : never
}[keyof T & string]

export type PlankHero =
  | { kind: 'stat'; value: string; caption: string }
  | { kind: 'quote'; quote: string }
  | { kind: 'statement'; text: string }

/**
 * What anchors a plank's band. Resolved in priority order rather than
 * validated as exactly-one-of: a Sveltia save commits straight to `main`, so a
 * schema that can reject an editor's entry is a schema that can take the whole
 * site's next build down. A plank with no figure and no quote falls back to
 * its own commitment set large, which is a perfectly good band.
 */
export function resolveHero(plank: Plank, lang: Lang): PlankHero {
  if (plank.statValue) {
    return {
      kind: 'stat',
      value: plank.statValue,
      caption: localized(plank, 'statCaption', lang) ?? '',
    }
  }
  const quote = localized(plank, 'pullQuote', lang)
  if (quote) return { kind: 'quote', quote }
  return {
    kind: 'statement',
    text: localized(plank, 'commitment', lang) ?? plank.commitment,
  }
}

/**
 * Fails the build when a plank points at a guide that doesn't exist.
 *
 * This is not theoretical. Sveltia's relation widget fails open: when its
 * `value_field` can't be resolved, it silently substitutes the entry summary
 * and then the entry slug, so a guide saved with an empty `slug` makes every
 * plank attached to it store the guide's *title* instead. The message names
 * both sides because that is otherwise a very hard red build to read.
 */
export function assertGuideRefs(
  guides: Entry<Guide>[],
  planks: Entry<Plank>[],
): void {
  const known = new Set(guides.map(guide => guide.data.slug))
  const broken = [
    ...planks
      .filter(plank => !known.has(plank.data.guide))
      .map(plank => `${plank.id} -> "${plank.data.guide}"`),
    ...guides.flatMap(guide =>
      (guide.data.related ?? [])
        .filter(slug => !known.has(slug))
        .map(slug => `${guide.id} -> "${slug}"`),
    ),
  ]
  if (broken.length === 0) return
  throw new Error(
    `Entries point at a guide that doesn't exist: ${broken.join(', ')}. ` +
      `Known guides: ${[...known].join(', ')}`,
  )
}

/**
 * Fails the build when two entries claim the same slug. Nothing errors on its
 * own if they do — one of them just quietly loses its route, or its planks,
 * to the other.
 */
export function assertUniqueSlugs<T extends { slug: string }>(
  collection: string,
  entries: Entry<T>[],
): void {
  const idsBySlug = new Map<string, string[]>()
  for (const entry of entries) {
    const ids = idsBySlug.get(entry.data.slug)
    if (ids) ids.push(entry.id)
    else idsBySlug.set(entry.data.slug, [entry.id])
  }
  const clashes = [...idsBySlug.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, ids]) => `"${slug}" (${ids.join(', ')})`)
  if (clashes.length === 0) return
  throw new Error(
    `Two or more ${collection} share a slug: ${clashes.join('; ')}. ` +
      `Slugs are routes, so one of them would silently win.`,
  )
}

/**
 * Fails the build when a *published* entry has a field in one language but not
 * the other. Drafts are exempt, which is the whole reason `_es` is optional in
 * the schema: the platform has to be draftable in English over weeks, while
 * the two live sites still can't drift apart.
 *
 * The check runs both ways on purpose. A Spanish twin written ahead of its
 * English base — a `kicker_es` with no `kicker` — diverges the two sites just
 * as much as the reverse, it just does it to the English page instead.
 */
export function assertTranslated<T extends { status: PublishStatus }>(
  collection: string,
  entries: Entry<T>[],
  fields: readonly string[],
): void {
  const problems = entries
    .filter(entry => entry.data.status === 'published')
    .flatMap(entry => {
      const values = entry.data as Record<string, unknown>
      const gaps = fields.flatMap(field => {
        const hasEnglish = Boolean(values[field])
        const hasSpanish = Boolean(values[`${field}_es`])
        if (hasEnglish === hasSpanish) return []
        return [hasEnglish ? `${field}_es` : field]
      })
      if (gaps.length === 0) return []
      return [`${entry.id} (${gaps.join(', ')})`]
    })
  if (problems.length === 0) return
  throw new Error(
    `Published ${collection} have fields in one language but not the other: ` +
      `${problems.join('; ')}. Fill the named fields in, or set status back to draft.`,
  )
}

const byOrder = <T extends { data: { order: number } }>(a: T, b: T) =>
  a.data.order - b.data.order

/** That guide's planks, whatever their status, in the order they're shown. */
export function planksForGuide<E extends Entry<Plank>>(
  planks: E[],
  guideSlug: string,
): E[] {
  return planks.filter(plank => plank.data.guide === guideSlug).sort(byOrder)
}

/**
 * The planks that render on a guide's own page.
 *
 * A published guide's page is public, so it shows published planks only — a
 * plank still being written must not surface just because its guide went live
 * first. A draft guide's page is already unlisted and `noindex`, and previewing
 * unfinished planks is the entire reason it gets built, so there it shows
 * everything.
 */
export function planksForPage<E extends Entry<Plank>>(
  planks: E[],
  guide: Guide,
): E[] {
  const forGuide = planksForGuide(planks, guide.slug)
  if (guide.status === 'draft') return forGuide
  return forGuide.filter(plank => plank.data.status === 'published')
}

/**
 * The cross-links shown at the foot of a guide, resolved from slugs to entries.
 *
 * Status is filtered the same way `planksForPage` filters planks, and for the
 * same reason: a published page is public, so it must not hand a reader a link
 * into an unlisted, `noindex` draft. A draft guide is already a private
 * preview, so there its cross-links resolve to whatever they name.
 */
export function relatedGuides<G extends Entry<Guide>>(
  guides: G[],
  guide: Guide,
): G[] {
  const visible =
    guide.status === 'draft'
      ? guides
      : guides.filter(entry => entry.data.status === 'published')
  return (guide.related ?? [])
    .map(slug => visible.find(entry => entry.data.slug === slug))
    .filter(entry => entry !== undefined)
}

/**
 * What a visitor is allowed to see, in order. A guide's status wins over its
 * planks', so a plank published ahead of the guide it sits in can't leak onto
 * the live site on its own.
 */
export function selectPublished<G extends Entry<Guide>, P extends Entry<Plank>>(
  guides: G[],
  planks: P[],
): { guides: G[]; planks: P[] } {
  const published = guides
    .filter(guide => guide.data.status === 'published')
    .sort(byOrder)
  const visible = new Set(published.map(guide => guide.data.slug))
  return {
    guides: published,
    planks: planks
      .filter(
        plank =>
          plank.data.status === 'published' && visible.has(plank.data.guide),
      )
      .sort(byOrder),
  }
}

/**
 * The id a plank's detail panel carries, and the anchor its permalink points
 * at. Namespaced so it can't collide with a section heading's own anchor, and
 * re-slugified because `slug` is free text an editor types — a permalink has
 * to survive that.
 */
export function plankAnchor(slug: string): string {
  return `plank-${slugify(slug)}`
}

/**
 * A guide's meta description, per language: the explicit override if there is
 * one, otherwise the stance with its markdown stripped.
 *
 * The override is read directly rather than through `localized()`, and that is
 * the whole point. `localized()` falls back to English, which would put an
 * English override on the Spanish page — worse than the Spanish stance it
 * would have generated on its own. Because each language falls back
 * independently, filling in one side only is a legitimate edit, which is why
 * `metaDescription` sits in `SELF_FALLBACK_FIELDS` and outside the
 * translation gate.
 */
export function guideMetaDescription(guide: Guide, lang: Lang): string {
  const override =
    lang === 'es' ? guide.metaDescription_es : guide.metaDescription
  if (override) return override
  return stripMarkdown(localized(guide, 'stance', lang) ?? guide.stance)
}
