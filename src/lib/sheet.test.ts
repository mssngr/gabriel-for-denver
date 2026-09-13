// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applySheetInert } from './sheet'

// Mirrors the real page: hero and footer are siblings of <main>, and each
// plank's <details> sits inside its own band section within it.
const PAGE = `
  <div id="hero"></div>
  <main>
    <section id="band-a"><details id="a"><summary></summary></details></section>
    <section id="band-b"><details id="b"><summary></summary></details></section>
  </main>
  <footer id="foot"></footer>`

// jsdom leaves `.inert` undefined until something sets it, where a real
// browser always reports a boolean — so read it as "is it inert", not raw.
const inert = (selector: string) =>
  (document.querySelector(selector) as HTMLElement).inert === true

beforeEach(() => {
  document.body.innerHTML = PAGE
})

describe('applySheetInert', () => {
  it('marks everything outside the open sheet inert, all the way up', () => {
    applySheetInert(document.querySelector('#a'))
    expect({
      hero: inert('#hero'),
      foot: inert('#foot'),
      otherBand: inert('#band-b'),
      ownBand: inert('#band-a'),
    }).toEqual({ hero: true, foot: true, otherBand: true, ownBand: false })
  })

  // The regression this function exists for. Opening B while A is still open
  // used to run two competing "everything except me" passes over overlapping
  // ancestor chains: the result left the hero and footer interactive behind
  // the scrim, and band A permanently inert — which disables its own toggle,
  // since inert cascades to descendants, with nothing left to undo it.
  it('recovers when a second sheet opens before the first has closed', () => {
    applySheetInert(document.querySelector('#a'))
    applySheetInert(document.querySelector('#b'))
    expect({
      hero: inert('#hero'),
      foot: inert('#foot'),
      bandA: inert('#band-a'),
      bandB: inert('#band-b'),
    }).toEqual({ hero: true, foot: true, bandA: true, bandB: false })
  })

  it('releases the whole page once nothing is open', () => {
    applySheetInert(document.querySelector('#a'))
    applySheetInert(null)
    expect({
      hero: inert('#hero'),
      foot: inert('#foot'),
      bandA: inert('#band-a'),
      bandB: inert('#band-b'),
    }).toEqual({ hero: false, foot: false, bandA: false, bandB: false })
  })

  // Only ever undo what this function did, so an `inert` set for some other
  // reason isn't quietly cleared on the way past.
  it('leaves inert it did not set alone', () => {
    const foot = document.querySelector('#foot') as HTMLElement
    foot.inert = true
    applySheetInert(document.querySelector('#a'))
    applySheetInert(null)
    expect(foot.inert).toBe(true)
  })

  it('does nothing when handed an element already detached from the page', () => {
    const orphan = document.createElement('details')
    expect(() => applySheetInert(orphan)).not.toThrow()
    expect(inert('#hero')).toBe(false)
  })
})
