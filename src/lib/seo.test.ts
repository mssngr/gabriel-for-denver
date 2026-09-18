import { describe, expect, it } from 'vitest'
import { alternatePath, stripMarkdown } from './seo'

describe('stripMarkdown', () => {
  it('unwraps bold so a stance can be reused as a meta description', () => {
    expect(
      stripMarkdown('Housing is a **human right,** not a commodity.'),
    ).toBe('Housing is a human right, not a commodity.')
  })

  it('unwraps italics and inline code', () => {
    expect(stripMarkdown('This _is_ a `crisis`.')).toBe('This _is_ a crisis.')
  })

  it('keeps a link’s text and drops its target', () => {
    expect(stripMarkdown('See [the report](https://example.org).')).toBe(
      'See the report.',
    )
  })

  // Meta descriptions are a single line; block content arrives with newlines
  // and indentation from YAML, which would otherwise land in the tag verbatim.
  it('collapses newlines and runs of whitespace into single spaces', () => {
    expect(stripMarkdown('Rent rose 45%.\n\n  Income rose 28%.  ')).toBe(
      'Rent rose 45%. Income rose 28%.',
    )
  })
})

describe('alternatePath', () => {
  it('prefixes an English path to reach its Spanish twin', () => {
    expect(alternatePath('/platform/housing-crisis', 'es')).toBe(
      '/es/platform/housing-crisis',
    )
  })

  it('strips the prefix off a Spanish path to reach its English twin', () => {
    expect(alternatePath('/es/platform/housing-crisis', 'en')).toBe(
      '/platform/housing-crisis',
    )
  })

  it('is idempotent when the path is already in the target language', () => {
    expect(alternatePath('/platform', 'en')).toBe('/platform')
    expect(alternatePath('/es/platform', 'es')).toBe('/es/platform')
  })

  // The root is the one path where the naive prefix/strip would produce
  // "/es/" and "" rather than "/es" and "/".
  it('handles the site root in both directions', () => {
    expect(alternatePath('/', 'es')).toBe('/es')
    expect(alternatePath('/es', 'en')).toBe('/')
  })

  // Every page carries both hreflang tags, so a path that doesn't survive the
  // round trip points search engines at a URL that doesn't exist.
  it.each([
    '/',
    '/platform',
    '/platform/affordable-housing',
    '/issues/housing-crisis',
    '/get-involved/volunteer',
  ])('round-trips %s through Spanish and back', path => {
    expect(alternatePath(alternatePath(path, 'es'), 'en')).toBe(path)
  })
})
