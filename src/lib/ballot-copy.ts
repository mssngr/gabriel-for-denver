import {
  type BallotGuide,
  type BallotItem,
  type BallotSection,
  type BallotStance,
  itemCode,
} from './ballot'
import { formatBallotDate } from './ballot-calendar'
import { type Lang, localized } from './platform'
import { stripMarkdown } from './seo'

/**
 * Every fixed label the ballot guide shows, in both languages, apart from the
 * how-to-vote steps in ballot-steps.ts. One test in ballot-copy.test.ts sweeps
 * both for "recommend" (questions.html Q5): the page says how Gabriel is
 * voting, never what anyone else should do.
 */

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
    wholeBallot: 'The whole ballot',
    nextHeading: 'Next on your ballot',
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
    wholeBallot: 'Toda la boleta',
    nextHeading: 'Siguiente en tu boleta',
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

const HOME_CALLOUT = {
  en: {
    eyebrow: 'Ballots are out',
    heading: 'How I’m voting, race by race',
    body: 'Every race and measure on a Denver ballot, in ballot order, with my reasons. Keep it open next to yours.',
    cta: 'See how I’m voting',
  },
  es: {
    eyebrow: 'Ya llegaron las boletas',
    heading: 'Cómo voy a votar, contienda por contienda',
    body: 'Cada contienda y medida de una boleta de Denver, en el orden de la boleta, con mis razones. Tenla abierta junto a la tuya.',
    cta: 'Ver cómo voy a votar',
  },
} as const satisfies Record<Lang, Record<string, string>>

/**
 * The home page's callout pointing at the guide while ballots are out. It
 * comes down after the election (follow-up F1), so it lives apart from the
 * guide's own wording.
 */
export function homeCallout(lang: Lang): {
  eyebrow: string
  heading: string
  body: string
  cta: string
  href: string
} {
  return {
    ...HOME_CALLOUT[lang],
    href: lang === 'es' ? '/es/ballot' : '/ballot',
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

// What an item's page says it is when a link to it is shared: the verdict as
// a sentence, so a yes or no reads "I'm voting No" rather than a bare "No".
const VOTING: Record<'yes' | 'no', Record<Lang, string>> = {
  yes: { en: 'I’m voting Yes', es: 'Voto Sí' },
  no: { en: 'I’m voting No', es: 'Voto No' },
}

/**
 * The title of an item's own page, e.g. "2K: I'm voting No" or "RTD B:
 * Undecided". Only a plain yes or no becomes a sentence; a custom label
 * ("Retain them.") or a pick stands as the verdict, and its final period is
 * dropped so it doesn't end a title.
 */
export function itemPageTitle(item: BallotItem, lang: Lang): string {
  const code = itemCode(item, lang)
  const override = lang === 'es' ? item.stanceLabel_es : item.stanceLabel
  if (!override && (item.stance === 'yes' || item.stance === 'no')) {
    return `${code}: ${VOTING[item.stance][lang]}`
  }
  return `${code}: ${stanceLabel(item, lang).replace(/\.$/, '')}`
}

/** An item page's `<title>` and meta description. */
export function itemPageMeta(
  item: BallotItem,
  lang: Lang,
): { title: string; description: string } {
  const site = lang === 'es' ? 'Gabriel por Denver' : 'Gabriel for Denver'
  const title = localized(item, 'title', lang) ?? item.title
  return {
    title: `${itemPageTitle(item, lang)} | ${site}`,
    description: `${title}. ${verdictHeading(lang)}: ${stanceLabel(item, lang)}.`,
  }
}

/** Where an item sits on the ballot, e.g. "7 of 25". */
export function positionLabel(
  position: number,
  total: number,
  lang: Lang,
): string {
  return lang === 'es' ? `${position} de ${total}` : `${position} of ${total}`
}

type OgGuide = Pick<BallotGuide, 'heading' | 'heading_es' | 'electionDate'>

/** The hand-lettered line on an item's preview image: the guide and the day. */
export function ogCaption(guide: OgGuide, lang: Lang): string {
  const heading = lang === 'es' ? guide.heading_es : guide.heading
  return `${stripMarkdown(heading)} · ${formatBallotDate(guide.electionDate, lang)}`
}

/** The same line on the guide's own preview image. */
export function ogGuideCaption(guide: OgGuide, lang: Lang): string {
  return `${verdictHeading(lang)} · ${formatBallotDate(guide.electionDate, lang)}`
}
