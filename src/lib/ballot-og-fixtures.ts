import type { BallotItem } from './ballot'

/** Shared by the image tests: a published item, the guide's heading and date. */
export function makeItem(overrides: Partial<BallotItem> = {}): BallotItem {
  return {
    slug: '2k',
    code: '2K',
    title: 'Franchise Agreement with Xcel Energy',
    title_es: 'Acuerdo de franquicia con Xcel Energy',
    section: 'local',
    order: 4,
    stance: 'no',
    what: '',
    why: '',
    status: 'published',
    ...overrides,
  }
}

export const GUIDE = {
  heading: 'Know your **ballot**',
  heading_es: 'Conoce tu **boleta**',
  electionDate: new Date('2026-11-03T00:00:00Z'),
}

export const HOST = 'gabrielfordenver.com'

export function itemInput(item: BallotItem, lang: 'en' | 'es') {
  return { item, lang, guide: GUIDE, host: HOST }
}
