// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachCardTracking,
  cardClickProps,
  cardSurface,
  type CardLink,
} from './card-tracking'

describe('cardSurface', () => {
  it.each([
    ['/', 'home'],
    ['/es', 'home'],
    ['/issues', 'issues'],
    ['/es/issues', 'issues'],
    ['/platform', 'platform'],
    ['/es/platform', 'platform'],
    ['/why-me', 'why-me'],
    ['/es/why-me', 'why-me'],
  ] as const)('reads %s as %s', (pathname, surface) => {
    expect(cardSurface(pathname)).toBe(surface)
  })

  // A card only ever links from one of the eight routes above, so a trailing
  // slash is the one variation worth normalizing — anything genuinely
  // unrelated (a guide's own page, a typo) should send nothing rather than
  // guess.
  it('trims a trailing slash before matching', () => {
    expect(cardSurface('/platform/')).toBe('platform')
  })

  it('reports no surface for a path no card renders on', () => {
    expect(cardSurface('/platform/affordable-housing')).toBeNull()
    expect(cardSurface('/donate')).toBeNull()
  })
})

describe('cardClickProps', () => {
  it('builds the event payload for a click on the card itself', () => {
    const link: CardLink = { target: 'card', guideSlug: 'affordable-housing' }
    expect(cardClickProps(link, 'en')).toEqual({
      lang: 'en',
      guide_slug: 'affordable-housing',
      target: 'card',
    })
  })

  // Only a row click points at a specific plank, so only a row click's
  // payload carries plank_slug at all — not just left undefined, absent.
  it('adds plank_slug only for a click on an action row', () => {
    const link: CardLink = {
      target: 'action',
      guideSlug: 'affordable-housing',
      plankSlug: 'co-living',
    }
    const props = cardClickProps(link, 'en')
    expect(props).toEqual({
      lang: 'en',
      guide_slug: 'affordable-housing',
      target: 'action',
      plank_slug: 'co-living',
    })
  })

  it('does not carry a plank_slug key at all for a card click', () => {
    const link: CardLink = { target: 'card', guideSlug: 'affordable-housing' }
    expect('plank_slug' in cardClickProps(link, 'en')).toBe(false)
  })

  it('reports the Spanish language on the Spanish page', () => {
    const link: CardLink = { target: 'card', guideSlug: 'affordable-housing' }
    expect(cardClickProps(link, 'es').lang).toBe('es')
  })
})

describe('attachCardTracking', () => {
  // Mirrors a guide card: one [data-card-tracking] container naming the
  // guide, a heading link targeting the card itself, and one action row
  // targeting a plank.
  const CARD = `
    <article data-card-tracking data-guide-slug="affordable-housing">
      <a id="title-link" data-card-target="card" href="/platform/affordable-housing">Affordable Housing</a>
      <ul>
        <li>
          <a id="row-link" data-card-target="action" data-plank-slug="co-living" href="/platform/affordable-housing#plank-co-living">Legalize co-living</a>
        </li>
      </ul>
    </article>
    <button id="outside">Not a card</button>`

  beforeEach(() => {
    document.body.innerHTML = CARD
  })

  it('reports a click on the card link with the card target', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/platform', 'en', capture)
    document
      .getElementById('title-link')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).toHaveBeenCalledWith({
      surface: 'platform',
      lang: 'en',
      guide_slug: 'affordable-housing',
      target: 'card',
    })
  })

  it('reports a click on a row with the action target and its plank', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/platform', 'en', capture)
    document
      .getElementById('row-link')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).toHaveBeenCalledWith({
      surface: 'platform',
      lang: 'en',
      guide_slug: 'affordable-housing',
      target: 'action',
      plank_slug: 'co-living',
    })
  })

  // The whole point of delegating from `document`: nothing outside a tracked
  // link should ever fire the event, not even another clickable element on
  // the same page.
  it('sends nothing for a click outside any tracked card link', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/platform', 'en', capture)
    document
      .getElementById('outside')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).not.toHaveBeenCalled()
  })

  // A middle-click or ctrl-click opens the card in a new tab without firing
  // a plain `click` event — `auxclick` is what fires instead, and a card
  // that worked in a new tab is still a card that worked (Q10).
  it('counts a middle-click on a card link', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/platform', 'en', capture)
    document
      .getElementById('title-link')
      ?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(capture).toHaveBeenCalledTimes(1)
  })

  // /why-me is one of the eight routes guide_card_clicked covers (Q10).
  it('reports the why-me surface', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/why-me', 'en', capture)
    document
      .getElementById('title-link')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'why-me' }),
    )
  })

  // A route with no cards on it — cardSurface(pathname) is null — should
  // never wire up an event at all, not even a silently-empty one.
  it('sends nothing when the page is not one of the tracked surfaces', () => {
    const capture = vi.fn()
    attachCardTracking(document, '/donate', 'en', capture)
    document
      .getElementById('title-link')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(capture).not.toHaveBeenCalled()
  })
})
