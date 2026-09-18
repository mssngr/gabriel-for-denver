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
 * Three beats, so a three-plank guide shows every colour — the earlier
 * ink, sky, ink, gold rotation only reached gold on a fourth plank. Adjacent
 * bands still never share a colour, since every beat differs from the next.
 */
export const BAND_ROTATION: readonly BandTheme[] = ['ink', 'sky', 'gold']

export const TIMELINES = [
  'day-one',
  'first-budget',
  'ordinance',
  'ballot-referral',
  'ongoing',
] as const
export type Timeline = (typeof TIMELINES)[number]

// Keyed by the enum, so the type checker refuses a new timeline value until it
// has wording in both languages — the stored slug is never shown to a reader.
const TIMELINE_LABELS: Record<Timeline, Record<Lang, string>> = {
  'day-one': { en: 'Day one', es: 'Primer día' },
  'first-budget': { en: 'First budget', es: 'Primer presupuesto' },
  ordinance: { en: 'Ordinance', es: 'Ordenanza' },
  'ballot-referral': { en: 'Ballot referral', es: 'Medida electoral' },
  ongoing: { en: 'Ongoing', es: 'Continuo' },
}

const relatedLinkObject = z.object({
  guide: z.string(),
  reason: z.string().optional(),
  reason_es: z.string().optional(),
})
export type RelatedLink = z.infer<typeof relatedLinkObject>

/**
 * A cross-link to another guide, with an optional one-line reason.
 *
 * Still accepts the plain slug the CMS used to store here. An editor with the
 * old admin page open could save that shape after this deploys, and a Sveltia
 * save goes straight to main — rejecting it would stop the whole site
 * building. Both shapes normalize to the object.
 */
const relatedLink = z
  .union([z.string(), relatedLinkObject])
  .transform(
    (link): RelatedLink => (typeof link === 'string' ? { guide: link } : link),
  )

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
  related: z.array(relatedLink).optional(),
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
  pullQuote: z.string().optional(),
  pullQuote_es: z.string().optional(),
  // Shared by whichever hero above is in play: what the figure counts, or
  // who said the quote, e.g. "A Denver Police Officer". A number with no
  // caption is a rumour; a quote is fine standing on its own.
  caption: z.string().optional(),
  caption_es: z.string().optional(),
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
  | { kind: 'quote'; quote: string; caption?: string }
  | { kind: 'statement'; text: string }

/**
 * What anchors a plank's band. Resolved in priority order rather than
 * validated as exactly-one-of: a Sveltia save commits straight to `main`, so a
 * schema that can reject an editor's entry is a schema that can take the whole
 * site's next build down. A plank with no figure and no quote falls back to
 * its own commitment set large, which is a perfectly good band.
 *
 * `caption` is a single field shared by both hero kinds — what the figure
 * counts, or who said the quote — since only one of them is ever the hero at
 * once.
 */
export function resolveHero(plank: Plank, lang: Lang): PlankHero {
  const caption = localized(plank, 'caption', lang)
  if (plank.statValue) {
    return { kind: 'stat', value: plank.statValue, caption: caption ?? '' }
  }
  const quote = localized(plank, 'pullQuote', lang)
  if (quote) return { kind: 'quote', quote, caption }
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
        .filter(link => !known.has(link.guide))
        .map(link => `${guide.id} -> "${link.guide}"`),
    ),
  ]
  if (broken.length === 0) return
  throw new Error(
    `Entries point at a guide that doesn't exist: ${broken.join(', ')}. ` +
      `Known guides: ${[...known].join(', ')}`,
  )
}

/**
 * The id a content entry gets, derived from its filename rather than a
 * frontmatter field. Passed as `generateId` to `glob()` in `content.config.ts`
 * for every collection `assertUniqueSlugs` checks.
 *
 * The loader's own default reads the `slug` field when one is present, which
 * means two files that happen to share a slug also share an id — the loader
 * silently keeps whichever one it processes last and drops the other before
 * `getCollection` ever returns. `assertUniqueSlugs` can't catch a collision it
 * never sees. Deriving the id from the filename instead means two files can
 * never collide, so both survive into `assertUniqueSlugs` and a real slug
 * clash actually fails the build instead of quietly losing a route.
 */
export function idFromFilename(entryPath: string): string {
  return entryPath.replace(/\.[^./]+$/, '')
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

/**
 * Display order: `order`, then `slug`. The slug tie-break means two entries
 * accidentally given the same `order` — an easy slip in the CMS — sort the same
 * way on every build, instead of in whatever order the loader returned them.
 * A plain comparison rather than `localeCompare`, so it can't vary by locale.
 */
function compareOrder(
  a: { order: number; slug: string },
  b: { order: number; slug: string },
): number {
  if (a.order !== b.order) return a.order - b.order
  if (a.slug === b.slug) return 0
  return a.slug < b.slug ? -1 : 1
}

export const byOrder = <T extends { data: { order: number; slug: string } }>(
  a: T,
  b: T,
): number => compareOrder(a.data, b.data)

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
 *
 * The reason is read strictly in the page's language, with no English
 * fallback. It's a sentence, not a title, so English on the Spanish page would
 * be a visible slip, whereas a link with no reason still reads fine.
 */
export function relatedGuides<G extends Entry<Guide>>(
  guides: G[],
  guide: Guide,
  lang: Lang,
): { guide: G; reason?: string }[] {
  const visible =
    guide.status === 'draft'
      ? guides
      : guides.filter(entry => entry.data.status === 'published')
  return (guide.related ?? []).flatMap(link => {
    const target = visible.find(entry => entry.data.slug === link.guide)
    if (!target) return []
    const reason = lang === 'es' ? link.reason_es : link.reason
    return [{ guide: target, reason }]
  })
}

/**
 * The guide a reader moves on to from this one: the first published guide that
 * comes after it in display order (`byOrder`, so guides sharing an `order`
 * still lead from one to the next). Drafts are never a destination, so a
 * published page can't point into an unlisted preview. No wrap-around from the
 * last guide — "next" back to the first reads as a loop, not progress.
 */
export function nextGuide<G extends Entry<Guide>>(
  guides: G[],
  guide: Guide,
): G | undefined {
  return guides
    .filter(
      entry =>
        entry.data.status === 'published' &&
        compareOrder(entry.data, guide) > 0,
    )
    .sort(byOrder)[0]
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
 * Whether a guide's page shows the plank rail beside its bands. A single plank
 * has nothing to move between, so it gets no rail.
 *
 * Both the rail and the bands' desktop left gutter follow this, so the gutter
 * only exists when there is a rail to clear. Deciding it in two places is how
 * the rail first shipped sitting on top of the text.
 */
export function showsPlankRail(plankCount: number): boolean {
  return plankCount > 1
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
 * The label above a plank's commitment in its detail panel: "Action 01 ·
 * Zoning", or just "Action 03" when the plank has no sub-topic.
 *
 * One string rather than separate template expressions. Written as adjacent
 * expressions, a formatter can move them onto separate lines, and Astro then
 * drops the whitespace between them — which is how the panel came to read
 * "PLANK01".
 */
export function plankLabel(plank: Plank, index: number, lang: Lang): string {
  const word = lang === 'es' ? 'Acción' : 'Action'
  const number = String(index + 1).padStart(2, '0')
  const kicker = localized(plank, 'kicker', lang)
  return kicker ? `${word} ${number} · ${kicker}` : `${word} ${number}`
}

/** How a plank's timeline reads on the page, e.g. "Day one" for `day-one`. */
export function timelineLabel(timeline: Timeline, lang: Lang): string {
  return TIMELINE_LABELS[timeline][lang]
}

/**
 * How many actions a guide carries, e.g. "3 actions" — the line above a
 * card's list on the platform index, and the count in a guide's meta row.
 *
 * "Action", never "promise", and never the CMS's own word "plank". A council
 * member proposes, champions and votes; they cannot single-handedly deliver
 * an outcome, so language that reads as a guarantee would misrepresent the
 * job. Everything a reader sees says action; `plank` stays the name of the
 * content model, in the CMS and in this file.
 */
export function actionCount(count: number, lang: Lang): string {
  const word =
    lang === 'es'
      ? count === 1
        ? 'acción'
        : 'acciones'
      : count === 1
        ? 'action'
        : 'actions'
  return `${count} ${word}`
}

/**
 * The platform index's eyebrow, e.g. "4 actions across 6 issues".
 *
 * Null before the first action is published: the line sits above the page's
 * title, where "0 actions" would undersell a platform that is simply still
 * being written.
 */
export function platformSummary(
  plankCount: number,
  guideCount: number,
  lang: Lang,
): string | null {
  if (plankCount === 0) return null
  const actions = actionCount(plankCount, lang)
  const issues =
    lang === 'es'
      ? `${guideCount} ${guideCount === 1 ? 'tema' : 'temas'}`
      : `${guideCount} ${guideCount === 1 ? 'issue' : 'issues'}`
  const joiner = lang === 'es' ? 'en' : 'across'
  return `${actions} ${joiner} ${issues}`
}

export type Source = NonNullable<Plank['sources']>[number]

/**
 * A source's label in the page's language. Falls back to the original, unlike a
 * related-guide reason: a source label is usually the document's own title,
 * which is often correct untranslated — the same reason nested twins sit
 * outside the translation gate.
 */
export function sourceLabel(source: Source, lang: Lang): string {
  return (lang === 'es' && source.label_es) || source.label
}

/**
 * The footnote on a plank's band: its first source. The band is the unit a
 * reader screenshots or links to, so the claim on it carries its own citation;
 * the full list stays in the detail panel.
 */
export function leadSource(
  plank: Plank,
  lang: Lang,
): { label: string; url: string } | undefined {
  const first = plank.sources?.[0]
  if (!first) return undefined
  return { label: sourceLabel(first, lang), url: first.url }
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
