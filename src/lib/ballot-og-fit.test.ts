import { describe, expect, it } from 'vitest'
import {
  chipFontSize,
  codeFontSize,
  titleFontSize,
  verdictLayout,
} from './ballot-og-fit'

describe('titleFontSize', () => {
  it('sets a short title at full size', () => {
    expect(titleFontSize('Right to Natural Gas')).toBe(52)
  })

  // The longest title on the ballot, in Spanish: 65 characters.
  it('steps a long title down to keep it to three lines', () => {
    const long =
      'Aumento del impuesto predial (Mill Levy Override) de $44 millones'
    expect(titleFontSize(long)).toBeLessThan(52)
  })

  it('never shrinks as a title gets longer', () => {
    let previous = Number.POSITIVE_INFINITY
    for (let length = 5; length <= 120; length += 5) {
      const size = titleFontSize('word '.repeat(length / 5).trim())
      expect(size).toBeLessThanOrEqual(previous)
      previous = size
    }
  })

  // An editor can type anything. Past the smallest size the image clamps the
  // lines instead of shrinking forever.
  it('stops at a readable floor', () => {
    expect(titleFontSize('long words '.repeat(40))).toBe(36)
  })
})

describe('codeFontSize', () => {
  it('sets a short code as big as the design allows', () => {
    expect(codeFontSize('2K')).toBe(156)
    expect(codeFontSize('137')).toBe(156)
  })

  // "25 judges" at 156px would run 800px across a 610px column.
  it('shrinks a code that is a word so it stays on one line', () => {
    expect(codeFontSize('25 judges')).toBeLessThan(156)
    expect(codeFontSize('At-large B')).toBeLessThan(codeFontSize('25 judges'))
  })

  it('stops at a floor', () => {
    expect(codeFontSize('x'.repeat(40))).toBe(72)
  })
})

describe('verdictLayout', () => {
  it('puts the mark beside a short yes or no at full size', () => {
    expect(verdictLayout('No', true)).toEqual({
      fontSize: 144,
      markSize: 108,
      inline: true,
    })
  })

  // "Yes" is wider than "No"; at 144px it would push past the panel.
  it('steps "Yes" down so the mark and the word fit the panel', () => {
    const yes = verdictLayout('Yes', true)
    expect(yes.inline).toBe(true)
    expect(yes.fontSize).toBeLessThan(144)
    expect(yes.markSize).toBeLessThan(108)
  })

  it('stacks the mark over a long label instead of squeezing it in', () => {
    const layout = verdictLayout('Retain them.', true)
    expect(layout.inline).toBe(false)
    expect(layout.markSize).toBeGreaterThan(0)
  })

  it('sizes an unmarked label by its longest word, which wraps', () => {
    const democrats = verdictLayout('The Democrats', false)
    const konkle = verdictLayout('Gabriel Konkle', false)
    expect(democrats.markSize).toBe(0)
    expect(democrats.fontSize).toBeLessThan(konkle.fontSize)
  })
})

describe('chipFontSize', () => {
  it('keeps the full ballot at one size', () => {
    expect(chipFontSize(25)).toBe(44)
  })

  // The guide's design fits about 30 chips in four rows.
  it('steps down when more items are added', () => {
    expect(chipFontSize(28)).toBe(44)
    expect(chipFontSize(29)).toBeLessThan(44)
    expect(chipFontSize(60)).toBeLessThan(chipFontSize(29))
  })
})
