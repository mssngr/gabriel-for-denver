import { describe, expect, it } from 'vitest'
import {
  BALLOT_ITEM_TRANSLATABLE_FIELDS,
  type BallotItem,
  ballotItemUrl,
  chipText,
  type Entry,
  itemCode,
  printLine,
  sectionAnchor,
  slateGroups,
  sortBallot,
} from './ballot'

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

describe('sectionAnchor', () => {
  // The judges item's slug is `judges` too, and both are anchors on one page.
  it('namespaces section anchors so they cannot collide with an item slug', () => {
    expect(sectionAnchor('judges')).toBe('section-judges')
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
