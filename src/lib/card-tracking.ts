import type { Lang } from './platform'

/**
 * `guide_card_clicked`'s reporting shape and the small pure functions that
 * build it. Kept free of the DOM's own event types where possible so the
 * payload logic is covered by ordinary unit tests, the way `sheet.ts` keeps
 * the inert-marking logic separate from `sheet-behavior.astro`'s listeners.
 */

/** Where a guide card renders — the eight routes `guide_card_clicked` covers. */
export type CardSurface = 'home' | 'issues' | 'platform' | 'why-me'

/** What was actually clicked inside a card: the card itself, or one action row. */
export type CardClickTarget = 'card' | 'action'

export interface CardClickProps {
  surface: CardSurface
  lang: Lang
  guide_slug: string
  target: CardClickTarget
  plank_slug?: string
}

const SURFACE_BY_PATH: Record<string, CardSurface> = {
  '/': 'home',
  '/es': 'home',
  '/issues': 'issues',
  '/es/issues': 'issues',
  '/platform': 'platform',
  '/es/platform': 'platform',
  '/why-me': 'why-me',
  '/es/why-me': 'why-me',
}

/**
 * Which surface a card was clicked on, read from the page's own URL rather
 * than threaded through as a prop — `GuideCard` renders on three different
 * routes (`/platform`, `/`, `/issues`, each in two languages) by way of
 * `what-will-i-tackle`, so no single prop on the component could name the
 * surface without touching every call site. `null` for any other path,
 * which tells the caller not to wire up an event at all — a route no card
 * ships on yet shouldn't report one just because it happens to load this
 * script.
 */
export function cardSurface(pathname: string): CardSurface | null {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return SURFACE_BY_PATH[trimmed] ?? null
}

/** What card-tracking.astro's data attributes describe about one clicked link. */
export interface CardLink {
  target: CardClickTarget
  guideSlug: string
  plankSlug?: string
}

/**
 * The event payload for one click, everything but the surface — that's
 * resolved once per page from the URL, not rebuilt per click.
 *
 * `plank_slug` is only ever present, not merely undefined, for an action
 * click: PostHog properties are typically inspected by whether a key
 * exists at all, so a card click's payload should have nothing at all to
 * find under that name.
 */
export function cardClickProps(
  link: CardLink,
  lang: Lang,
): Omit<CardClickProps, 'surface'> {
  return {
    lang,
    guide_slug: link.guideSlug,
    target: link.target,
    ...(link.plankSlug ? { plank_slug: link.plankSlug } : {}),
  }
}

const TRACKED_LINK = '[data-card-target]'
const TRACKED_CARD = '[data-card-tracking]'

/**
 * The tracked link an event's target sits inside, or `null` when the click
 * landed somewhere else on the page — outside any card, or on a card before
 * it reaches one of its own `[data-card-target]` elements.
 */
function trackedLink(target: EventTarget | null): CardLink | null {
  if (!(target instanceof Element)) return null
  const linkEl = target.closest<HTMLElement>(TRACKED_LINK)
  if (!linkEl) return null
  const container = linkEl.closest<HTMLElement>(TRACKED_CARD)
  const guideSlug = container?.dataset.guideSlug
  if (!guideSlug) return null
  return {
    target: linkEl.dataset.cardTarget as CardClickTarget,
    guideSlug,
    plankSlug: linkEl.dataset.plankSlug,
  }
}

/**
 * Wires one delegated click listener for every tracked card link under
 * `root` — delegated once per page rather than once per card, the way
 * `sheet-behavior.astro` listens once for every plank's close button rather
 * than attaching a handler per panel.
 *
 * Listens for `auxclick` alongside `click` so a middle-click or ctrl-click
 * that opens a card in a new tab still counts — a card that worked in a new
 * tab is still a card that worked (Q10).
 *
 * Resolves the surface once, from `pathname`, rather than on every click: a
 * page this never renders a card on (`cardSurface` returns `null`) attaches
 * nothing at all, so it can never report an event with no real surface.
 */
export function attachCardTracking(
  root: Document,
  pathname: string,
  lang: Lang,
  capture: (props: CardClickProps) => void,
): void {
  const surface = cardSurface(pathname)
  if (!surface) return
  const onClick = (event: Event) => {
    const link = trackedLink(event.target)
    if (!link) return
    capture({ surface, ...cardClickProps(link, lang) })
  }
  root.addEventListener('click', onClick)
  root.addEventListener('auxclick', onClick)
}
