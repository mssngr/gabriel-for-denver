import {
  type BallotGuide,
  type BallotItem,
  guidePath,
  itemCode,
} from './ballot'
import {
  ogCaption,
  ogGuideCaption,
  stanceLabel,
  verdictHeading,
} from './ballot-copy'
import { type Lang, localized } from './platform'
import { stripMarkdown } from './seo'

/**
 * The 1200×630 preview image for a shared link: the element tree satori turns
 * into an SVG (ballot-og-render.ts does that, and needs the fonts). Kept as
 * plain data so what the image says can be unit tested without rendering it.
 *
 * The layout is design.html's "Shared links" section. Sizes are in pixels of
 * the finished image.
 */

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/** The site's palette, as src/styles/global.css names it. */
export const OG_COLORS = {
  primary: '#1900a8',
  accent: '#ffc800',
  neutral: '#d5e0ff',
  tertiary: '#0e005c',
  pale: '#eef1fb',
  white: '#ffffff',
} as const

export type OgChild = OgNode | string
export type OgNode = {
  type: string
  props: {
    style?: Record<string, string | number>
    children?: OgChild | OgChild[]
    [attribute: string]: unknown
  }
}

type OgGuide = Pick<BallotGuide, 'heading' | 'heading_es' | 'electionDate'>

function h(
  type: string,
  props: Omit<OgNode['props'], 'children'>,
  ...children: OgChild[]
): OgNode {
  return {
    type,
    props: {
      ...props,
      children: children.length === 1 ? children[0] : children,
    },
  }
}

const column = { display: 'flex', flexDirection: 'column' } as const

// satori sizes boxes by their content, so a width plus padding overflows its
// parent and gets squeezed. Border-box makes the numbers below the real ones.
const box = { boxSizing: 'border-box' } as const

// Column widths: the left column's text sits inside its padding.
const TEXT_WIDTH = 610
const VERDICT_WIDTH = 350

// Average advance of League Spartan as a fraction of the font size. Wide on
// purpose: an estimate that errs large steps a title down early, where one
// that errs small lets it spill.
const TITLE_EM = 0.54
const CAPS_EM = 0.68
const TITLE_SIZES = [52, 48, 44, 40, 36]
const TITLE_LINES = 3

/** How many lines `text` takes at `size`, wrapping greedily on spaces. */
function estimateLines(text: string, size: number, width: number): number {
  let lines = 1
  let used = 0
  for (const word of text.split(' ')) {
    const wordWidth = word.length * size * TITLE_EM
    const spaceWidth = size * TITLE_EM
    if (used > 0 && used + spaceWidth + wordWidth > width) {
      lines += 1
      used = wordWidth
    } else {
      used += (used > 0 ? spaceWidth : 0) + wordWidth
    }
  }
  return lines
}

/**
 * The largest title size that keeps it to three lines. Past the smallest
 * size the title is clamped with an ellipsis instead of shrinking forever.
 */
export function titleFontSize(title: string): number {
  const fitting = TITLE_SIZES.find(
    size => estimateLines(title, size, TEXT_WIDTH) <= TITLE_LINES,
  )
  return fitting ?? TITLE_SIZES[TITLE_SIZES.length - 1]
}

const CODE_MAX = 156
const CODE_MIN = 72

/** The code on one line: huge for "2K", smaller for "25 judges". */
export function codeFontSize(code: string): number {
  const fitting = Math.floor(TEXT_WIDTH / (code.length * CAPS_EM))
  return Math.min(CODE_MAX, Math.max(CODE_MIN, fitting))
}

const VERDICT_MAX = 144
const VERDICT_MIN = 48
const MARK_GAP = 18
// A mark is drawn at three quarters of the word's size.
const MARK_RATIO = 0.75
const SHORT_VERDICT = 4

export type VerdictLayout = {
  fontSize: number
  markSize: number
  /** Mark beside the word, rather than stacked over it. */
  inline: boolean
}

/**
 * Sizes the verdict panel's word and mark. A short yes or no sits beside its
 * mark at full size ("Yes" is wider than "No", so it steps down to fit). A
 * longer label — "Retain them.", "The Democrats" — can't share a row with
 * the mark: it wraps, sized by its longest word, with the mark stacked over
 * it when there is one.
 */
export function verdictLayout(label: string, hasMark: boolean): VerdictLayout {
  if (hasMark && label.length <= SHORT_VERDICT) {
    const wordEms = label.length * CAPS_EM
    const fitting = Math.floor(
      (VERDICT_WIDTH - MARK_GAP) / (wordEms + MARK_RATIO),
    )
    const fontSize = Math.min(VERDICT_MAX, fitting)
    return {
      fontSize,
      markSize: Math.round(fontSize * MARK_RATIO),
      inline: true,
    }
  }
  const longestWord = Math.max(...label.split(' ').map(word => word.length))
  const fitting = Math.floor(VERDICT_WIDTH / (longestWord * CAPS_EM))
  const fontSize = Math.min(96, Math.max(VERDICT_MIN, fitting))
  return {
    fontSize,
    markSize: hasMark ? Math.round(fontSize * MARK_RATIO) : 0,
    inline: false,
  }
}

const CHIP_SIZE = 44
const CHIP_ROWS_FIT = 28

/** The guide image's chip text: full size up to about 28, then smaller. */
export function chipFontSize(count: number): number {
  if (count <= CHIP_ROWS_FIT) return CHIP_SIZE
  return count <= 36 ? 34 : 28
}

/**
 * `**word**` in a heading as the accent-colored word it is on the page.
 * Anything without markers comes back as one plain run.
 */
export function splitHighlight(
  text: string,
): { text: string; highlight: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, index) => ({ text: part, highlight: index % 2 === 1 }))
    .filter(run => run.text !== '')
}

// The ✓ and ✕ from design.html, as strokes in a 24-unit box.
const MARK_PATH = {
  yes: 'M4 12.5l5 5L20 6.5',
  no: 'M6 6l12 12M18 6L6 18',
} as const

/**
 * Drawn as SVG, never as text: satori fetches an image for an emoji, and
 * neither font has the glyph.
 */
function mark(stance: 'yes' | 'no', size: number, color: string): OgNode {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      'stroke-width': 3.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    h('path', { d: MARK_PATH[stance] }),
  )
}

const PANEL = {
  yes: { background: OG_COLORS.accent, color: OG_COLORS.tertiary },
  no: { background: OG_COLORS.tertiary, color: OG_COLORS.white },
  pick: { background: OG_COLORS.primary, color: OG_COLORS.white },
  none: { background: OG_COLORS.pale, color: OG_COLORS.tertiary },
} as const

function verdictPanel(item: BallotItem, lang: Lang): OgNode {
  const { background, color } = PANEL[item.stance]
  const label = stanceLabel(item, lang)
  const stance =
    item.stance === 'yes' || item.stance === 'no' ? item.stance : null
  const layout = verdictLayout(label, stance !== null)
  const word = h(
    'span',
    { style: { fontSize: layout.fontSize, fontWeight: 900, lineHeight: 0.95 } },
    label,
  )
  const markNode = stance && mark(stance, layout.markSize, color)
  return h(
    'div',
    {
      style: {
        ...column,
        ...box,
        justifyContent: 'center',
        gap: 14,
        width: 470,
        padding: 60,
        background,
        color,
      },
    },
    h(
      'span',
      {
        style: {
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: 'uppercase',
          opacity: 0.8,
        },
      },
      verdictHeading(lang),
    ),
    layout.inline
      ? h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: MARK_GAP } },
          ...(markNode ? [markNode] : []),
          word,
        )
      : h(
          'div',
          { style: { ...column, gap: 10 } },
          ...(markNode ? [markNode] : []),
          word,
        ),
  )
}

function footer(
  caption: string,
  url: string,
  color: string,
  handColor: string,
) {
  return h(
    'div',
    { style: { ...column, gap: 4 } },
    h(
      'span',
      { style: { fontFamily: 'Edu SA Hand', fontSize: 34, color: handColor } },
      caption,
    ),
    h('span', { style: { fontSize: 29, fontWeight: 700, color } }, url),
  )
}

export type OgItemInput = {
  item: BallotItem
  lang: Lang
  guide: OgGuide
  /** The site's host, e.g. `gabrielfordenver.com`, printed in the footer. */
  host: string
}

/** The preview image for one race or measure: its code, title and vote. */
export function ballotOgTree({ item, lang, guide, host }: OgItemInput): OgNode {
  const title = localized(item, 'title', lang) ?? item.title
  const code = itemCode(item, lang)
  return h(
    'div',
    {
      style: {
        ...box,
        display: 'flex',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: OG_COLORS.neutral,
        color: OG_COLORS.tertiary,
        fontFamily: 'League Spartan',
      },
    },
    h(
      'div',
      {
        style: {
          ...column,
          ...box,
          justifyContent: 'space-between',
          width: 730,
          padding: '72px 60px 48px',
        },
      },
      h(
        'div',
        { style: { ...column, gap: 20 } },
        h(
          'span',
          {
            style: {
              fontSize: codeFontSize(code),
              fontWeight: 900,
              lineHeight: 0.9,
              color: OG_COLORS.primary,
              letterSpacing: -3,
            },
          },
          code,
        ),
        h(
          'span',
          {
            style: {
              fontSize: titleFontSize(title),
              fontWeight: 800,
              lineHeight: 1.1,
              // satori only honors lineClamp on a block.
              display: 'block',
              lineClamp: TITLE_LINES + 1,
            },
          },
          title,
        ),
      ),
      footer(
        ogCaption(guide, lang),
        `${host}${guidePath(lang)}`,
        OG_COLORS.tertiary,
        OG_COLORS.primary,
      ),
    ),
    verdictPanel(item, lang),
  )
}

const CHIP = {
  yes: { background: OG_COLORS.accent, color: OG_COLORS.tertiary },
  no: { border: '3px solid rgba(255,255,255,0.7)', color: OG_COLORS.white },
  pick: { background: OG_COLORS.white, color: OG_COLORS.primary },
  none: { border: '3px dashed rgba(255,255,255,0.5)', color: OG_COLORS.white },
} as const

function chip(item: BallotItem, lang: Lang, fontSize: number): OgNode {
  const look = CHIP[item.stance]
  return h(
    'span',
    {
      style: {
        // Every chip has the same 3px border, so filled and outlined ones
        // stand the same height.
        border: '3px solid transparent',
        borderRadius: 12,
        padding: '6px 16px 2px',
        fontSize,
        fontWeight: 800,
        lineHeight: 1.1,
        ...look,
      },
    },
    itemCode(item, lang),
  )
}

export type OgGuideInput = {
  /** In ballot order. */
  items: BallotItem[]
  lang: Lang
  guide: OgGuide
  host: string
}

/** The guide's preview image: the whole slate, one chip per item. */
export function ballotGuideOgTree({
  items,
  lang,
  guide,
  host,
}: OgGuideInput): OgNode {
  const heading = stripMarkdown(
    lang === 'es' ? guide.heading_es : guide.heading,
  )
  const runs = splitHighlight(lang === 'es' ? guide.heading_es : guide.heading)
  const chipSize = chipFontSize(items.length)
  return h(
    'div',
    {
      style: {
        ...column,
        ...box,
        justifyContent: 'space-between',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        padding: '56px 60px 44px',
        background: OG_COLORS.tertiary,
        color: OG_COLORS.white,
        fontFamily: 'League Spartan',
      },
      'aria-label': heading,
    },
    h(
      'div',
      { style: { ...column, gap: 26 } },
      // Inline runs in one text element, so the space before the highlighted
      // word survives (a flex row would trim it).
      h(
        'span',
        { style: { fontSize: 78, fontWeight: 800, lineHeight: 1 } },
        ...runs.map(run =>
          run.highlight
            ? h('span', { style: { color: OG_COLORS.accent } }, run.text)
            : run.text,
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
        ...items.map(item => chip(item, lang, chipSize)),
      ),
    ),
    footer(
      ogGuideCaption(guide, lang),
      `${host}${guidePath(lang)}`,
      OG_COLORS.white,
      OG_COLORS.accent,
    ),
  )
}
