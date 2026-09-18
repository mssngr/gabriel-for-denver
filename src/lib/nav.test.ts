import { describe, expect, it } from 'vitest'
import { isCurrentSection } from './nav'

describe('isCurrentSection', () => {
  it('marks the page you are on', () => {
    expect(isCurrentSection('/platform/food-security', '/platform/food-security')).toBe(true)
  })

  it('ignores a trailing slash on either side', () => {
    expect(isCurrentSection('/platform/food-security/', '/platform/food-security')).toBe(true)
  })

  it('marks a section you are somewhere inside', () => {
    expect(isCurrentSection('/get-involved/events/some-event', '/get-involved')).toBe(true)
  })

  // The bug this is written against: `includes()` lights up both nav items
  // when one guide's slug is the start of another's.
  it('does not mark a sibling whose slug it merely starts', () => {
    expect(isCurrentSection('/platform/food-security-funding', '/platform/food-security')).toBe(false)
  })

  it('does not mark the English page from the Spanish one, or the reverse', () => {
    expect(isCurrentSection('/es/platform/food-security', '/platform/food-security')).toBe(false)
    expect(isCurrentSection('/platform/food-security', '/es/platform/food-security')).toBe(false)
  })

  it('is false for an unrelated page', () => {
    expect(isCurrentSection('/why-me', '/platform')).toBe(false)
  })
})
