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
  itemPageMeta,
  itemPageTitle,
  ogCaption,
  ogGuideCaption,
  positionLabel,
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

const OG_GUIDE = {
  heading: 'Know your **ballot**',
  heading_es: 'Conoce tu **boleta**',
  electionDate: DATES.electionDate,
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

describe('itemPageTitle', () => {
  it('says how I am voting on a yes or no', () => {
    expect(itemPageTitle(makeItem({ stance: 'no' }), 'en')).toBe(
      '2K: I’m voting No',
    )
    expect(itemPageTitle(makeItem({ code: '4A', stance: 'yes' }), 'es')).toBe(
      '4A: Voto Sí',
    )
  })

  it('votes no in Spanish with the same words as the default label', () => {
    expect(itemPageTitle(makeItem({ stance: 'no' }), 'es')).toBe('2K: Voto No')
  })

  it('names an undecided race by its verdict alone', () => {
    const item = makeItem({ code: 'RTD B', stance: 'none' })
    expect(itemPageTitle(item, 'en')).toBe('RTD B: Undecided')
    expect(itemPageTitle(item, 'es')).toBe('RTD B: Indeciso')
  })

  // "I'm voting Retain them." would read as a typo; the label is the verdict.
  it('uses a custom verdict label as is, without its final period', () => {
    const item = makeItem({
      code: '25 judges',
      code_es: '25 jueces',
      stance: 'yes',
      stanceLabel: 'Retain them.',
      stanceLabel_es: 'Retenerlos.',
    })
    expect(itemPageTitle(item, 'en')).toBe('25 judges: Retain them')
    expect(itemPageTitle(item, 'es')).toBe('25 jueces: Retenerlos')
  })

  it('names a pick by its label', () => {
    const item = makeItem({
      code: 'At-large B',
      stance: 'pick',
      stanceLabel: 'Gabriel Konkle',
    })
    expect(itemPageTitle(item, 'en')).toBe('At-large B: Gabriel Konkle')
  })
})

describe('itemPageMeta', () => {
  it('titles the page with the site name, in the reader’s language', () => {
    const item = makeItem({ stance: 'no' })
    expect(itemPageMeta(item, 'en').title).toBe(
      '2K: I’m voting No | Gabriel for Denver',
    )
    expect(itemPageMeta(item, 'es').title).toBe(
      '2K: Voto No | Gabriel por Denver',
    )
  })

  // The judges' label is "Retain them." and a sentence shouldn't end "..".
  it('does not double the period after a custom verdict label', () => {
    const item = makeItem({
      stance: 'yes',
      stanceLabel: 'Retain them.',
      stanceLabel_es: 'Retenerlos.',
      title_es: 'Tribunales',
    })
    expect(itemPageMeta(item, 'en').description).toBe(
      'Franchise Agreement with Xcel Energy. How I’m voting: Retain them.',
    )
    expect(itemPageMeta(item, 'es').description).toBe(
      'Tribunales. Así voy a votar: Retenerlos.',
    )
  })

  it('describes the measure and the vote', () => {
    const item = makeItem({
      title_es: 'Acuerdo de franquicia con Xcel Energy',
    })
    expect(itemPageMeta(item, 'en').description).toBe(
      'Franchise Agreement with Xcel Energy. How I’m voting: No.',
    )
    expect(itemPageMeta(item, 'es').description).toBe(
      'Acuerdo de franquicia con Xcel Energy. Así voy a votar: No.',
    )
  })
})

describe('positionLabel', () => {
  it('counts where an item sits on the ballot', () => {
    expect(positionLabel(7, 25, 'en')).toBe('7 of 25')
    expect(positionLabel(7, 25, 'es')).toBe('7 de 25')
  })
})

describe('ogCaption and ogGuideCaption', () => {
  const guide = OG_GUIDE

  // The caption comes from the guide's own heading and date, so editing
  // either in the CMS changes the next build's images with it.
  it('captions an item image with the guide’s name and Election Day', () => {
    expect(ogCaption(guide, 'en')).toBe('Know your ballot · Nov 3')
    expect(ogCaption(guide, 'es')).toBe('Conoce tu boleta · 3 de noviembre')
  })

  it('captions the guide image with how I am voting', () => {
    expect(ogGuideCaption(guide, 'en')).toBe('How I’m voting · Nov 3')
    expect(ogGuideCaption(guide, 'es')).toBe('Así voy a votar · 3 de noviembre')
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
        positionLabel(1, 25, lang),
        ogCaption(OG_GUIDE, lang),
        ogGuideCaption(OG_GUIDE, lang),
      )
      for (const section of BALLOT_SECTIONS) {
        labels.push(
          sectionLabel(section, lang),
          sectionShortLabel(section, lang),
          sectionNote(section, lang),
        )
      }
      for (const stance of BALLOT_STANCES) {
        const item = makeItem({ stance })
        const meta = itemPageMeta(item, lang)
        labels.push(
          reasonLabel(stance, lang),
          stanceLabel(item, lang),
          itemPageTitle(item, lang),
          meta.title,
          meta.description,
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
