import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates a heading', () => {
    expect(slugify('The Rent is Too Damn High')).toBe('the-rent-is-too-damn-high')
  })

  // Spanish headings are slugified too, and the anchor has to survive being
  // pasted into a URL bar, so accents are folded rather than escaped.
  it('folds accents rather than escaping them', () => {
    expect(slugify('Zonificación Integradora')).toBe('zonificacion-integradora')
    expect(slugify('¿Qué voy a enfrentar?')).toBe('que-voy-a-enfrentar')
  })

  it('collapses punctuation and runs of separators into one hyphen', () => {
    expect(slugify('Big Tech: they’re not — saving us!')).toBe(
      'big-tech-they-re-not-saving-us',
    )
  })

  it('trims the hyphens a leading or trailing symbol would leave behind', () => {
    expect(slugify('  “Affordable” Housing  ')).toBe('affordable-housing')
  })

  it('returns an empty string when there is nothing sluggable left', () => {
    expect(slugify('—')).toBe('')
  })
})
