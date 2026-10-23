import { z } from 'astro/zod'
import {
  type Entry,
  type Lang,
  localized,
  translatableFields,
} from './platform'
import { stripMarkdown } from './seo'

/**
 * The ballot guide at /ballot: one entry per race or measure (`ballotItems`)
 * and one for the page around them (`ballotGuide`). Like platform.ts, this
 * file stays free of `astro:content` so all of it can be unit tested; the
 * loading lives in ballot-content.ts.
 *
 * The page's fixed wording lives in ballot-copy.ts, and the calendar and its
 * how-to-vote steps in ballot-calendar.ts.
 */

export type { Entry, Lang }

/**
 * Printed-ballot order (Q1), checked against Denver's 2026 general election
 * sample ballot: candidate races, judicial retention, statewide amendments,
 * statewide statutory propositions, then Denver's own questions.
 */
export const BALLOT_SECTIONS = [
  'candidates',
  'judges',
  'amendments',
  'propositions',
  'local',
] as const
export type BallotSection = (typeof BALLOT_SECTIONS)[number]

/** `pick` is a named candidate or slate; `none` is undecided. */
export const BALLOT_STANCES = ['yes', 'no', 'pick', 'none'] as const
export type BallotStance = (typeof BALLOT_STANCES)[number]

const publishStatus = z.enum(['draft', 'published'])

/**
 * `_es` twins are optional so an item can be drafted in English and saved;
 * `assertTranslated` gates publishing instead, the same as planks.
 */
export const ballotItemSchema = z.object({
  slug: z.string(),
  code: z.string(),
  code_es: z.string().optional(),
  codeLabel: z.string().optional(),
  codeLabel_es: z.string().optional(),
  title: z.string(),
  title_es: z.string().optional(),
  section: z.enum(BALLOT_SECTIONS),
  order: z.number(),
  stance: z.enum(BALLOT_STANCES),
  stanceLabel: z.string().optional(),
  stanceLabel_es: z.string().optional(),
  chip: z.string().optional(),
  chip_es: z.string().optional(),
  what: z.string(),
  what_es: z.string().optional(),
  why: z.string(),
  why_es: z.string().optional(),
  sources: z
    .array(
      z.object({
        label: z.string(),
        label_es: z.string().optional(),
        // Not `.url()`, for the reason given on plankSchema's sources: the
        // CMS field's `pattern` catches a typo where it can be fixed.
        url: z.string(),
      }),
    )
    .optional(),
  status: publishStatus.default('draft'),
})
export type BallotItem = z.infer<typeof ballotItemSchema>

export const ballotGuideSchema = z.object({
  heading: z.string(),
  heading_es: z.string(),
  intro: z.string(),
  intro_es: z.string(),
  // Bare YAML dates, which `z.coerce.date()` parses as midnight UTC. Every
  // function below reads only their calendar day, as a day in Denver.
  electionDate: z.coerce.date(),
  mailByDate: z.coerce.date(),
  registerOnlineByDate: z.coerce.date(),
  credit: z.string().optional(),
  credit_es: z.string().optional(),
})
export type BallotGuide = z.infer<typeof ballotGuideSchema>
/** What the preview images' captions read from the guide. */
export type OgGuide = Pick<
  BallotGuide,
  'heading' | 'heading_es' | 'electionDate'
>
export type BallotDates = Pick<
  BallotGuide,
  'electionDate' | 'mailByDate' | 'registerOnlineByDate'
>

/**
 * Fields that fall back to something sensible per language, so filling only
 * one side is an editorial choice rather than a gap: the code is whatever the
 * ballot prints, and a stance label or chip falls back to the defaults below.
 */
const BALLOT_SELF_FALLBACK_FIELDS = ['code', 'stanceLabel', 'chip']

export const BALLOT_ITEM_TRANSLATABLE_FIELDS = translatableFields(
  ballotItemSchema.shape,
  BALLOT_SELF_FALLBACK_FIELDS,
)

/**
 * A section's anchor. Prefixed because item slugs are anchors on the same
 * page, and the judges item's slug is `judges`.
 */
export function sectionAnchor(section: BallotSection): string {
  return `section-${section}`
}

/**
 * Ballot order: section, then `order`, then `slug`. The slug tie-break keeps
 * two items accidentally given the same `order` in the same place on every
 * build. A plain comparison rather than `localeCompare`, so it can't vary by
 * locale.
 */
export function sortBallot<E extends Entry<BallotItem>>(items: E[]): E[] {
  const rank = (item: E) => BALLOT_SECTIONS.indexOf(item.data.section)
  return [...items].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (a.data.order !== b.data.order) return a.data.order - b.data.order
    if (a.data.slug === b.data.slug) return 0
    return a.data.slug < b.data.slug ? -1 : 1
  })
}

export type SlateGroup<E> = { section: BallotSection; items: E[] }

/**
 * Items grouped by section in ballot order, for the slate card and the page's
 * sections alike. A section with nothing published in it is left out rather
 * than shown as an empty heading.
 */
export function slateGroups<E extends Entry<BallotItem>>(
  items: E[],
): SlateGroup<E>[] {
  const sorted = sortBallot(items)
  return BALLOT_SECTIONS.map(section => ({
    section,
    items: sorted.filter(item => item.data.section === section),
  })).filter(group => group.items.length > 0)
}

/** The big code on a card, as the ballot prints it: `2K`, `81`, `NN`. */
export function itemCode(item: BallotItem, lang: Lang): string {
  return (lang === 'es' && item.code_es) || item.code
}

/**
 * An item's chip on the slate card. Defaults to its code; an override is read
 * strictly in its language, since "City Council: Konkle" on the Spanish page
 * would be a slip and the code never is.
 */
export function chipText(item: BallotItem, lang: Lang): string {
  const override = lang === 'es' ? item.chip_es : item.chip
  return override || itemCode(item, lang)
}

// Escaped markdown is held aside under these private-use characters while the
// rest is stripped, then put back.
const ESCAPED = /\\([\\*_`[\]])/g
const HOLD_OPEN = String.fromCharCode(0xe000)
const HOLD_CLOSE = String.fromCharCode(0xe001)
const HELD = new RegExp(`${HOLD_OPEN}(\\d+)${HOLD_CLOSE}`, 'g')

/**
 * The print sheet's "Why": the item's full text with markdown removed. Never
 * shortened (Q3) — the sheet carries the deck's words, the same as the card.
 *
 * Backslash escapes are held aside while stripping, so 81's `\*\*\*\*`
 * prints as the four asterisks it stands for instead of being read as bold.
 * List items become inline bullets, since the sheet's cell is one line.
 */
export function printLine(item: BallotItem, lang: Lang): string {
  const held: string[] = []
  const why = localized(item, 'why', lang) ?? item.why
  const protectedText = why.replace(
    ESCAPED,
    (_, char: string) => `${HOLD_OPEN}${held.push(char) - 1}${HOLD_CLOSE}`,
  )
  const bulleted = protectedText.replace(/^\s*[-*+]\s+/gm, '• ')
  return stripMarkdown(bulleted).replace(
    HELD,
    (_, index: string) => held[Number(index)],
  )
}

/** The guide page itself. */
export function guidePath(lang: Lang): string {
  return lang === 'es' ? '/es/ballot' : '/ballot'
}

/**
 * An item's own page, which the Share button sends (Q9). Slugs are routes
 * here, so `og` is reserved for the image folder and the CMS rejects it.
 */
export function itemPath(slug: string, lang: Lang): string {
  return `${guidePath(lang)}/${slug}`
}

/** The 1200×630 preview image for an item, or for the guide without a slug. */
export function ogImagePath(lang: Lang, slug?: string): string {
  return slug
    ? `${guidePath(lang)}/og/${slug}.png`
    : `${guidePath(lang)}/og.png`
}

/**
 * The item after this one in ballot order, crossing into the next section at
 * a boundary, or nothing after the last. Sorts first, so it can't be thrown
 * off by the order the entries were handed over in.
 */
export function nextItem<E extends Entry<BallotItem>>(
  items: E[],
  slug: string,
): E | undefined {
  const sorted = sortBallot(items)
  const index = sorted.findIndex(item => item.data.slug === slug)
  return index === -1 ? undefined : sorted[index + 1]
}
