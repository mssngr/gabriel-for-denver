/**
 * The sizing behind ballot-og.ts's images: how big a title, code, verdict or
 * chip can be and still fit its box. satori doesn't report overflow, so each
 * size is picked from an estimate of the text's width, and
 * ballot-og-render.test.ts checks the estimates against real renders.
 */

// Column widths: the left column's text sits inside its padding.
const TEXT_WIDTH = 610
const VERDICT_WIDTH = 350

// Average advance of League Spartan as a fraction of the font size. Wide on
// purpose: an estimate that errs large steps a title down early, where one
// that errs small lets it spill.
const TITLE_EM = 0.54
const CAPS_EM = 0.68
const TITLE_SIZES = [52, 48, 44, 40, 36]
export const TITLE_LINES = 3

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
export const MARK_GAP = 18
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
