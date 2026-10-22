import { describe, expect, it } from 'vitest'
import {
  BALLOT_SECTIONS,
  BALLOT_STANCES,
  type BallotDates,
  type BallotItem,
} from './ballot'
import { VOTE_STATES } from './ballot-calendar'
import {
  BALLOT_COPY,
  ballotPageMeta,
  ballotSummary,
  closingLinks,
  homeCallout,
  reasonLabel,
  sectionLabel,
  sectionNote,
  sectionShortLabel,
  stanceLabel,
  verdictHeading,
} from './ballot-copy'
import { howToVote } from './ballot-steps'

// Only the fields these labels read; the rest of an item is irrelevant here.
function makeItem(overrides: Partial<BallotItem> = {}): BallotItem {
  return {
    slug: '2k',
    code: '2K',
    title: 'Franchise Agreement with Xcel Energy',
    section: 'local',
    order: 4,
    stance: 'no',
    what: '',
    why: '',
    status: 'published',
    ...overrides,
  }
}

// The real 2026 calendar: mail by Sat Oct 24, register online by Mon Oct 26,
// Election Day Tue Nov 3. The content collection hands these over the way
// `z.coerce.date()` parses a bare YAML date — midnight UTC.
const DATES: BallotDates = {
  mailByDate: new Date('2026-10-24T00:00:00Z'),
  registerOnlineByDate: new Date('2026-10-26T00:00:00Z'),
  electionDate: new Date('2026-11-03T00:00:00Z'),
}

describe('section labels', () => {
  it('names every section in both languages', () => {
    for (const section of BALLOT_SECTIONS) {
      for (const lang of ['en', 'es'] as const) {
        expect(sectionLabel(section, lang)).toBeTruthy()
        expect(sectionShortLabel(section, lang)).toBeTruthy()
        expect(sectionNote(section, lang)).toBeTruthy()
      }
    }
  })

  // Q5: the deck's "25 judges, 1 recommendation." is the one label changed.
  it('words the judges subtitle as how I am voting', () => {
    expect(sectionNote('judges', 'en')).toBe(
      '25 judges. Here’s how I’m voting.',
    )
    expect(sectionNote('judges', 'es')).toBe('25 jueces. Así voy a votar.')
  })

  it('names the local section the way the ballot does', () => {
    expect(sectionLabel('local', 'en')).toBe('Denver City & County')
  })
})

describe('stanceLabel', () => {
  it('defaults to Yes, No and Undecided in English', () => {
    expect(stanceLabel(makeItem({ stance: 'yes' }), 'en')).toBe('Yes')
    expect(stanceLabel(makeItem({ stance: 'no' }), 'en')).toBe('No')
    expect(stanceLabel(makeItem({ stance: 'none' }), 'en')).toBe('Undecided')
  })

  it('defaults to Sí, No and Indeciso in Spanish', () => {
    expect(stanceLabel(makeItem({ stance: 'yes' }), 'es')).toBe('Sí')
    expect(stanceLabel(makeItem({ stance: 'no' }), 'es')).toBe('No')
    expect(stanceLabel(makeItem({ stance: 'none' }), 'es')).toBe('Indeciso')
  })

  it('lets an override win when present', () => {
    const item = makeItem({
      stance: 'yes',
      stanceLabel: 'Retain them.',
      stanceLabel_es: 'Retenerlos.',
    })
    expect(stanceLabel(item, 'en')).toBe('Retain them.')
    expect(stanceLabel(item, 'es')).toBe('Retenerlos.')
  })

  // Self-falling-back, like a guide's metaDescription: an English override
  // never shows on the Spanish page, where the Spanish default is better.
  it('falls back to the Spanish default, not the English override', () => {
    const item = makeItem({ stance: 'yes', stanceLabel: 'Retain them.' })
    expect(stanceLabel(item, 'es')).toBe('Sí')
  })

  it('gives a named pick a default of its own', () => {
    expect(stanceLabel(makeItem({ stance: 'pick' }), 'en')).toBe('My pick')
    expect(stanceLabel(makeItem({ stance: 'pick' }), 'es')).toBe('Mi elección')
  })
})

describe('verdictHeading', () => {
  it('reads "How I\'m voting" in English and "Así voy a votar" in Spanish', () => {
    expect(verdictHeading('en')).toBe('How I’m voting')
    expect(verdictHeading('es')).toBe('Así voy a votar')
  })
})

describe('reasonLabel', () => {
  it('heads a decided item "Why"', () => {
    expect(reasonLabel('yes', 'en')).toBe('Why')
    expect(reasonLabel('no', 'en')).toBe('Why')
    expect(reasonLabel('pick', 'en')).toBe('Why')
    expect(reasonLabel('yes', 'es')).toBe('Por qué')
  })

  // An undecided race has no reason to give, just the candidates.
  it('heads an undecided item "On the ballot"', () => {
    expect(reasonLabel('none', 'en')).toBe('On the ballot')
    expect(reasonLabel('none', 'es')).toBe('En la boleta')
  })
})

describe('ballotSummary', () => {
  it('counts decisions and sections', () => {
    expect(ballotSummary(25, 5, 'en')).toBe('25 decisions · 5 sections')
    expect(ballotSummary(25, 5, 'es')).toBe('25 decisiones · 5 secciones')
  })

  it('uses the singular for one of each', () => {
    expect(ballotSummary(1, 1, 'en')).toBe('1 decision · 1 section')
    expect(ballotSummary(1, 1, 'es')).toBe('1 decisión · 1 sección')
  })
})

describe('ballotPageMeta', () => {
  const guide = {
    heading: 'Know your **ballot**',
    heading_es: 'Conoce tu **boleta**',
  }

  it('titles the page from the heading, with its markdown stripped', () => {
    expect(ballotPageMeta(guide, 'en').title).toBe(
      'Know your ballot | Gabriel for Denver',
    )
    expect(ballotPageMeta(guide, 'es').title).toBe(
      'Conoce tu boleta | Gabriel por Denver',
    )
  })

  it('describes the page in each language', () => {
    expect(ballotPageMeta(guide, 'en').description).toMatch(/^How Gabriel/)
    expect(ballotPageMeta(guide, 'es').description).toMatch(/^Cómo va a votar/)
  })
})

describe('closingLinks', () => {
  it('points each language at its own donate and volunteer pages', () => {
    expect(closingLinks('en')).toEqual({
      donate: '/donate',
      volunteer: '/get-involved/volunteer',
    })
    expect(closingLinks('es')).toEqual({
      donate: '/es/donate',
      volunteer: '/es/get-involved/volunteer',
    })
  })
})

describe('homeCallout', () => {
  it('links each language to its own guide', () => {
    expect(homeCallout('en').href).toBe('/ballot')
    expect(homeCallout('es').href).toBe('/es/ballot')
  })

  // Q5 carries over to the home page: the callout says how Gabriel is voting.
  it('frames the guide as how Gabriel is voting', () => {
    expect(homeCallout('en').heading).toBe('How I’m voting, race by race')
    expect(homeCallout('es').heading).toBe(
      'Cómo voy a votar, contienda por contienda',
    )
  })

  it('words every line in both languages', () => {
    for (const lang of ['en', 'es'] as const) {
      const { eyebrow, heading, body, cta } = homeCallout(lang)
      for (const line of [eyebrow, heading, body, cta]) {
        expect(line).toBeTruthy()
      }
    }
  })
})

describe('no "recommend" anywhere on the page', () => {
  // Q5: the page says how Gabriel is voting, never what anyone should do.
  // Covers every label this module can hand a page, in both languages,
  // including the home page's callout pointing at the guide.
  it('keeps every label free of recommend and recomendar', () => {
    const labels: string[] = []
    for (const lang of ['en', 'es'] as const) {
      labels.push(
        ...Object.values(BALLOT_COPY[lang]),
        verdictHeading(lang),
        ...Object.values(homeCallout(lang)),
        ballotPageMeta({ heading: '', heading_es: '' }, lang).description,
      )
      for (const section of BALLOT_SECTIONS) {
        labels.push(
          sectionLabel(section, lang),
          sectionShortLabel(section, lang),
          sectionNote(section, lang),
        )
      }
      for (const stance of BALLOT_STANCES) {
        labels.push(
          reasonLabel(stance, lang),
          stanceLabel(makeItem({ stance }), lang),
        )
      }
      for (const state of VOTE_STATES) {
        const { banner, steps } = howToVote(state, DATES, lang)
        if (banner) labels.push(banner)
        for (const step of steps) labels.push(step.title, step.body)
      }
    }
    expect(labels.length).toBeGreaterThan(100)
    expect(labels.filter(label => /recom/i.test(label))).toEqual([])
  })
})
