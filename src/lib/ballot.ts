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
 * Every label a reader sees is in here or in ballot-calendar.ts, in both
 * languages, so one test can check none of them says "recommend"
 * (questions.html Q5). The page says how Gabriel is voting; it never tells
 * anyone what to do.
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

/** Fixed wording on the page, per language. */
export const BALLOT_COPY = {
  en: {
    what: 'What it does',
    share: 'Share',
    copied: 'Link copied',
    unavailable: 'Copy the link from your address bar',
    slateHeading: 'The whole ballot at a glance',
    slateHint: 'Screenshot it, print it, or tap any code for the reasoning.',
    slateTitle: 'My Denver ballot',
    slateKey: 'gold = yes · outline = no',
    slateFoot: 'Gabriel Konkle · Denver City Council At-Large B',
    shareGuide: 'Share this guide',
    print: 'Print this guide',
    jumpNav: 'Ballot sections',
    howToVote: 'How to vote',
    electionDay: 'Election Day',
    electionHeld: 'Election held',
    closed: 'Closed',
    ctaHeading: 'Agree with this ballot?',
    ctaBody: 'Send it to three friends, then help get it to every door.',
    donate: 'Donate',
    volunteer: 'Volunteer',
    printIntro:
      'How Gabriel Konkle is voting, top to bottom in ballot order. Full reasons: gabrielfordenver.com/ballot',
    printItem: 'Race or measure',
    printFoot: 'Paid for by Gabriel for Denver',
  },
  es: {
    what: 'Qué hace',
    share: 'Compartir',
    copied: 'Enlace copiado',
    unavailable: 'Copia el enlace de la barra de direcciones',
    slateHeading: 'Toda la boleta de un vistazo',
    slateHint:
      'Haz una captura, imprímela o toca cualquier código para ver el porqué.',
    slateTitle: 'Mi boleta de Denver',
    slateKey: 'dorado = sí · contorno = no',
    slateFoot:
      'Gabriel Konkle · Concejo Municipal de Denver, Miembro General Escaño B',
    shareGuide: 'Compartir esta guía',
    print: 'Imprimir esta guía',
    jumpNav: 'Secciones de la boleta',
    howToVote: 'Cómo votar',
    electionDay: 'Día de las elecciones',
    electionHeld: 'Elección celebrada',
    closed: 'Cerrado',
    ctaHeading: '¿De acuerdo con esta boleta?',
    ctaBody:
      'Envíala a tres amistades y luego ayúdanos a llevarla a cada puerta.',
    donate: 'Donar',
    volunteer: 'Voluntario',
    printIntro:
      'Cómo va a votar Gabriel Konkle, de arriba abajo en el orden de la boleta. Razones completas: gabrielfordenver.com/es/ballot',
    printItem: 'Contienda o medida',
    printFoot: 'Pagado por Gabriel por Denver',
  },
} as const satisfies Record<Lang, Record<string, string>>

type SectionWording = { label: string; short: string; note: string }

// Keyed by the enum, so a new section can't ship without wording in both
// languages. The notes are the deck's section subtitles; the judges one is the
// only deck label this page changes (Q5).
const SECTION_WORDING: Record<BallotSection, Record<Lang, SectionWording>> = {
  candidates: {
    en: {
      label: 'Candidates',
      short: 'Candidates',
      note: 'There’s a lot of us.',
    },
    es: { label: 'Candidatos', short: 'Candidatos', note: 'Somos muchos.' },
  },
  judges: {
    en: {
      label: 'Judges',
      short: 'Judges',
      note: '25 judges. Here’s how I’m voting.',
    },
    es: {
      label: 'Jueces',
      short: 'Jueces',
      note: '25 jueces. Así voy a votar.',
    },
  },
  amendments: {
    en: {
      label: 'Statewide Amendments',
      short: 'Amendments',
      note: 'Changes to our state’s constitution.',
    },
    es: {
      label: 'Enmiendas estatales',
      short: 'Enmiendas',
      note: 'Cambios a la constitución de nuestro estado.',
    },
  },
  propositions: {
    en: {
      label: 'Statutory Measures',
      short: 'Statutory',
      note: 'New state laws.',
    },
    es: {
      label: 'Medidas estatutarias',
      short: 'Estatutarias',
      note: 'Nuevas leyes estatales.',
    },
  },
  local: {
    en: {
      label: 'Denver City & County',
      short: 'Denver',
      note: 'Everything affecting us at the most local level!',
    },
    es: {
      label: 'Ciudad y Condado de Denver',
      short: 'Denver',
      note: '¡Todo lo que nos afecta al nivel más local!',
    },
  },
}

export function sectionLabel(section: BallotSection, lang: Lang): string {
  return SECTION_WORDING[section][lang].label
}

/** The jump-nav's pill text, short enough to fit a phone's row. */
export function sectionShortLabel(section: BallotSection, lang: Lang): string {
  return SECTION_WORDING[section][lang].short
}

export function sectionNote(section: BallotSection, lang: Lang): string {
  return SECTION_WORDING[section][lang].note
}

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

const STANCE_DEFAULTS: Record<BallotStance, Record<Lang, string>> = {
  yes: { en: 'Yes', es: 'Sí' },
  no: { en: 'No', es: 'No' },
  pick: { en: 'My pick', es: 'Mi elección' },
  none: { en: 'Undecided', es: 'Indeciso' },
}

/**
 * The verdict on an item's card, e.g. "Yes", "Retain them." or "The
 * Democrats". The override is read strictly in the page's language, like a
 * guide's `metaDescription`: an English override on the Spanish page would be
 * worse than the Spanish default.
 */
export function stanceLabel(item: BallotItem, lang: Lang): string {
  const override = lang === 'es' ? item.stanceLabel_es : item.stanceLabel
  return override || STANCE_DEFAULTS[item.stance][lang]
}

/** The small label over every verdict (Q5). */
export function verdictHeading(lang: Lang): string {
  return lang === 'es' ? 'Así voy a votar' : 'How I’m voting'
}

/**
 * What heads an item's second column. An undecided race has no reason to give,
 * only the candidates, so its `why` holds the list and is headed as such.
 */
export function reasonLabel(stance: BallotStance, lang: Lang): string {
  if (stance === 'none') return lang === 'es' ? 'En la boleta' : 'On the ballot'
  return lang === 'es' ? 'Por qué' : 'Why'
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

// Private-use characters stand in for escaped markdown while it's stripped.
const ESCAPED = /\\([\\*_`[\]])/g
const PLACEHOLDER = /(\d+)/g

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
    (_, char: string) => `${held.push(char) - 1}`,
  )
  const bulleted = protectedText.replace(/^\s*[-*+]\s+/gm, '• ')
  return stripMarkdown(bulleted).replace(
    PLACEHOLDER,
    (_, index: string) => held[Number(index)],
  )
}

/** The link an item's Share button sends: its card on the guide page. */
export function ballotItemUrl(pageUrl: string, slug: string): string {
  return `${pageUrl}#${slug}`
}

/** The hero's count, e.g. "25 decisions · 5 sections". */
export function ballotSummary(
  itemCount: number,
  sectionCount: number,
  lang: Lang,
): string {
  const one = (count: number) => count === 1
  if (lang === 'es') {
    return `${itemCount} ${one(itemCount) ? 'decisión' : 'decisiones'} · ${sectionCount} ${one(sectionCount) ? 'sección' : 'secciones'}`
  }
  return `${itemCount} ${one(itemCount) ? 'decision' : 'decisions'} · ${sectionCount} ${one(sectionCount) ? 'section' : 'sections'}`
}

/** Where the closing call to action's buttons go, per language. */
export function closingLinks(lang: Lang): {
  donate: string
  volunteer: string
} {
  const prefix = lang === 'es' ? '/es' : ''
  return {
    donate: `${prefix}/donate`,
    volunteer: `${prefix}/get-involved/volunteer`,
  }
}

/** The page's `<title>` and meta description. */
export function ballotPageMeta(
  guide: Pick<BallotGuide, 'heading' | 'heading_es'>,
  lang: Lang,
): { title: string; description: string } {
  if (lang === 'es') {
    return {
      title: `${stripMarkdown(guide.heading_es)} | Gabriel por Denver`,
      description:
        'Cómo va a votar Gabriel Konkle en cada contienda y medida de una boleta de Denver, y por qué.',
    }
  }
  return {
    title: `${stripMarkdown(guide.heading)} | Gabriel for Denver`,
    description:
      'How Gabriel Konkle is voting on every race and measure on a Denver ballot, and why.',
  }
}
