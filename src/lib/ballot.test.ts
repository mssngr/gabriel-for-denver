import { describe, expect, it } from 'vitest'
import {
  BALLOT_COPY,
  BALLOT_ITEM_TRANSLATABLE_FIELDS,
  BALLOT_SECTIONS,
  BALLOT_STANCES,
  type BallotDates,
  type BallotItem,
  ballotItemUrl,
  ballotPageMeta,
  ballotSummary,
  chipText,
  closingLinks,
  type Entry,
  itemCode,
  printLine,
  reasonLabel,
  sectionAnchor,
  sectionLabel,
  sectionNote,
  sectionShortLabel,
  slateGroups,
  sortBallot,
  stanceLabel,
  verdictHeading,
} from './ballot'
import { howToVote, VOTE_STATES } from './ballot-calendar'

function makeItem({
  id,
  ...overrides
}: Partial<BallotItem> & { id?: string } = {}): Entry<BallotItem> {
  const data: BallotItem = {
    slug: '2k',
    code: '2K',
    title: 'Franchise Agreement with Xcel Energy',
    title_es: 'Acuerdo de franquicia con Xcel Energy',
    section: 'local',
    order: 4,
    stance: 'no',
    what: '**20 year agreement** to give Xcel public rights-of-way for the city.',
    what_es:
      '**Acuerdo de 20 años** para dar a Xcel derechos de paso públicos en la ciudad.',
    why: 'This locks the status quo for 20 years, wasting our leverage.',
    why_es:
      'Esto fija el statu quo por 20 años y desperdicia nuestra influencia.',
    status: 'published',
    ...overrides,
  }
  return { id: id ?? data.slug, data }
}

// The real 2026 calendar: mail by Sat Oct 24, register online by Mon Oct 26,
// Election Day Tue Nov 3. The content collection hands these over the way
// `z.coerce.date()` parses a bare YAML date — midnight UTC.
const DATES: BallotDates = {
  mailByDate: new Date('2026-10-24T00:00:00Z'),
  registerOnlineByDate: new Date('2026-10-26T00:00:00Z'),
  electionDate: new Date('2026-11-03T00:00:00Z'),
}

describe('sortBallot', () => {
  it('puts sections in printed-ballot order whatever order the entries arrive in', () => {
    const items = [
      makeItem({ slug: '2k', section: 'local', order: 1 }),
      makeItem({ slug: 'nn', section: 'propositions', order: 1 }),
      makeItem({ slug: '81', section: 'amendments', order: 1 }),
      makeItem({ slug: 'judges', section: 'judges', order: 1 }),
      makeItem({ slug: 'partisan', section: 'candidates', order: 1 }),
    ]
    expect(sortBallot(items).map(item => item.data.slug)).toEqual([
      'partisan',
      'judges',
      '81',
      'nn',
      '2k',
    ])
  })

  it('orders items within a section by their order field', () => {
    const items = [
      makeItem({ slug: '2k', order: 4 }),
      makeItem({ slug: '2h', order: 1 }),
    ]
    expect(sortBallot(items).map(item => item.data.slug)).toEqual(['2h', '2k'])
  })

  // An easy CMS slip: two items given the same order. They must still sort
  // the same way on every build.
  it('breaks a tie on order by slug', () => {
    const items = [
      makeItem({ slug: '2j', order: 3 }),
      makeItem({ slug: '2i', order: 3 }),
    ]
    expect(sortBallot(items).map(item => item.data.slug)).toEqual(['2i', '2j'])
  })

  it('does not reorder the array it was given', () => {
    const items = [makeItem({ slug: 'b', order: 2 }), makeItem({ slug: 'a' })]
    sortBallot(items)
    expect(items[0].data.slug).toBe('b')
  })
})

describe('slateGroups', () => {
  it('groups items under their section in ballot order', () => {
    const groups = slateGroups([
      makeItem({ slug: '2k', section: 'local' }),
      makeItem({ slug: '81', section: 'amendments' }),
    ])
    expect(groups.map(group => group.section)).toEqual(['amendments', 'local'])
    expect(groups[1].items.map(item => item.data.slug)).toEqual(['2k'])
  })

  it('drops a section with nothing in it', () => {
    const groups = slateGroups([makeItem({ section: 'judges' })])
    expect(groups.map(group => group.section)).toEqual(['judges'])
  })

  it('returns nothing for an empty ballot', () => {
    expect(slateGroups([])).toEqual([])
  })
})

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

  // The judges item's slug is `judges` too, and both are anchors on one page.
  it('namespaces section anchors so they cannot collide with an item slug', () => {
    expect(sectionAnchor('judges')).toBe('section-judges')
  })
})

describe('stanceLabel', () => {
  it('defaults to Yes, No and Undecided in English', () => {
    expect(stanceLabel(makeItem({ stance: 'yes' }).data, 'en')).toBe('Yes')
    expect(stanceLabel(makeItem({ stance: 'no' }).data, 'en')).toBe('No')
    expect(stanceLabel(makeItem({ stance: 'none' }).data, 'en')).toBe(
      'Undecided',
    )
  })

  it('defaults to Sí, No and Indeciso in Spanish', () => {
    expect(stanceLabel(makeItem({ stance: 'yes' }).data, 'es')).toBe('Sí')
    expect(stanceLabel(makeItem({ stance: 'no' }).data, 'es')).toBe('No')
    expect(stanceLabel(makeItem({ stance: 'none' }).data, 'es')).toBe(
      'Indeciso',
    )
  })

  it('lets an override win when present', () => {
    const item = makeItem({
      stance: 'yes',
      stanceLabel: 'Retain them.',
      stanceLabel_es: 'Retenerlos.',
    }).data
    expect(stanceLabel(item, 'en')).toBe('Retain them.')
    expect(stanceLabel(item, 'es')).toBe('Retenerlos.')
  })

  // Self-falling-back, like a guide's metaDescription: an English override
  // never shows on the Spanish page, where the Spanish default is better.
  it('falls back to the Spanish default, not the English override', () => {
    const item = makeItem({ stance: 'yes', stanceLabel: 'Retain them.' }).data
    expect(stanceLabel(item, 'es')).toBe('Sí')
  })

  it('gives a named pick a default of its own', () => {
    expect(stanceLabel(makeItem({ stance: 'pick' }).data, 'en')).toBe('My pick')
    expect(stanceLabel(makeItem({ stance: 'pick' }).data, 'es')).toBe(
      'Mi elección',
    )
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

describe('itemCode', () => {
  it('uses the printed code in both languages by default', () => {
    expect(itemCode(makeItem().data, 'es')).toBe('2K')
  })

  it('takes a Spanish code when one is given', () => {
    const item = makeItem({ code: '25 judges', code_es: '25 jueces' }).data
    expect(itemCode(item, 'en')).toBe('25 judges')
    expect(itemCode(item, 'es')).toBe('25 jueces')
  })
})

describe('chipText', () => {
  it('defaults to the code', () => {
    expect(chipText(makeItem().data, 'en')).toBe('2K')
  })

  it('uses the chip override in its own language', () => {
    const item = makeItem({ chip: 'Retain them', chip_es: 'Retenerlos' }).data
    expect(chipText(item, 'en')).toBe('Retain them')
    expect(chipText(item, 'es')).toBe('Retenerlos')
  })

  it('falls back to the Spanish code rather than an English chip', () => {
    const item = makeItem({ chip: 'City Council: Konkle', code_es: '2K' }).data
    expect(chipText(item, 'es')).toBe('2K')
  })
})

describe('printLine', () => {
  // Q3: the print sheet carries the deck's words in full, never a summary.
  it('prints the full why with its bold stripped, never shortened', () => {
    const why =
      'Will cost the average home-owner **$72 a year** while providing a base **$1,750 salary increase** for every single DPS employee. This is a no-brainer.'
    expect(printLine(makeItem({ why }).data, 'en')).toBe(
      'Will cost the average home-owner $72 a year while providing a base $1,750 salary increase for every single DPS employee. This is a no-brainer.',
    )
  })

  it('prints the Spanish why on the Spanish sheet', () => {
    expect(printLine(makeItem().data, 'es')).toBe(
      'Esto fija el statu quo por 20 años y desperdicia nuestra influencia.',
    )
  })

  it('keeps a list as bullets on one line', () => {
    const why = '- First point.\n- Second point.'
    expect(printLine(makeItem({ why }).data, 'en')).toBe(
      '• First point. • Second point.',
    )
  })

  // 81's "**** ICE." is stored escaped so markdown doesn't read it as bold.
  it('prints escaped asterisks as the asterisks they stand for', () => {
    const why = '**\\*\\*\\*\\* ICE.** We don’t need to invite Nazis.'
    expect(printLine(makeItem({ why }).data, 'en')).toBe(
      '**** ICE. We don’t need to invite Nazis.',
    )
  })
})

describe('ballotItemUrl', () => {
  it('links to the card on the guide page by its slug', () => {
    expect(ballotItemUrl('https://gabrielfordenver.com/ballot', '2k')).toBe(
      'https://gabrielfordenver.com/ballot#2k',
    )
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

describe('BALLOT_ITEM_TRANSLATABLE_FIELDS', () => {
  it('gates the fields a reader sees as running text', () => {
    expect([...BALLOT_ITEM_TRANSLATABLE_FIELDS].sort()).toEqual([
      'codeLabel',
      'title',
      'what',
      'why',
    ])
  })

  // Each of these already falls back to something sensible per language.
  it('leaves the self-falling-back fields out of the publish gate', () => {
    for (const field of ['code', 'stanceLabel', 'chip']) {
      expect(BALLOT_ITEM_TRANSLATABLE_FIELDS).not.toContain(field)
    }
  })
})

describe('no "recommend" anywhere on the page', () => {
  // Q5: the page says how Gabriel is voting, never what anyone should do.
  // Covers every label this module can hand a page, in both languages.
  it('keeps every label free of recommend and recomendar', () => {
    const labels: string[] = []
    for (const lang of ['en', 'es'] as const) {
      labels.push(
        ...Object.values(BALLOT_COPY[lang]),
        verdictHeading(lang),
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
          stanceLabel(makeItem({ stance }).data, lang),
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
