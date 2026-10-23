import { describe, expect, it } from 'vitest'
import type { BallotItem } from './ballot'
import {
  ballotGuideOgTree,
  ballotOgTree,
  OG_COLORS,
  type OgNode,
  splitHighlight,
} from './ballot-og'
import { GUIDE, HOST, makeItem } from './ballot-og-fixtures'

function itemTree(item: BallotItem, lang: 'en' | 'es' = 'en') {
  return ballotOgTree({
    item,
    lang,
    guide: GUIDE,
    host: HOST,
  })
}

function children(node: OgNode): (OgNode | string)[] {
  const { children } = node.props
  if (children === undefined) return []
  return Array.isArray(children) ? children : [children]
}

function walk(node: OgNode | string, visit: (node: OgNode) => void) {
  if (typeof node === 'string') return
  visit(node)
  for (const child of children(node)) walk(child, visit)
}

function allText(tree: OgNode): string[] {
  const text: string[] = []
  const collect = (node: OgNode) => {
    for (const child of children(node)) {
      if (typeof child === 'string') text.push(child)
    }
  }
  walk(tree, collect)
  return text
}

function findAll(tree: OgNode, matches: (node: OgNode) => boolean): OgNode[] {
  const found: OgNode[] = []
  walk(tree, node => {
    if (matches(node)) found.push(node)
  })
  return found
}

/** The verdict panel: the node whose own text is the "How I'm voting" label. */
function verdictPanel(tree: OgNode, heading: string): OgNode {
  const [label] = findAll(tree, node => children(node).includes(heading))
  const [panel] = findAll(tree, node => children(node).includes(label))
  return panel
}

const MARK_PATHS = { yes: 'M4 12.5l5 5L20 6.5', no: 'M6 6l12 12M18 6L6 18' }

describe('ballotOgTree', () => {
  it('shows the code, the title and the "How I’m voting" label', () => {
    const text = allText(itemTree(makeItem()))
    expect(text).toContain('2K')
    expect(text).toContain('Franchise Agreement with Xcel Energy')
    expect(text).toContain('How I’m voting')
    expect(text).toContain('No')
  })

  it('reads in Spanish from the Spanish fields', () => {
    const item = makeItem({ code: '25 judges', code_es: '25 jueces' })
    const text = allText(itemTree(item, 'es'))
    expect(text).toContain('25 jueces')
    expect(text).toContain('Acuerdo de franquicia con Xcel Energy')
    expect(text).toContain('Así voy a votar')
    expect(text).not.toContain('How I’m voting')
  })

  it('captions the image with the guide and the way back to it', () => {
    const text = allText(itemTree(makeItem()))
    expect(text).toContain('Know your ballot · Nov 3')
    expect(text).toContain('gabrielfordenver.com/ballot')
    expect(allText(itemTree(makeItem(), 'es'))).toContain(
      'gabrielfordenver.com/es/ballot',
    )
  })

  // The colors are the card's: gold for yes, deep indigo for no.
  it('paints a yes panel gold with a check mark', () => {
    const tree = itemTree(makeItem({ stance: 'yes' }))
    const panel = verdictPanel(tree, 'How I’m voting')
    expect(panel.props.style?.background).toBe(OG_COLORS.accent)
    const paths = findAll(panel, node => node.type === 'path')
    expect(paths.map(path => path.props.d)).toEqual([MARK_PATHS.yes])
  })

  it('paints a no panel deep indigo with a cross', () => {
    const tree = itemTree(makeItem({ stance: 'no' }))
    const panel = verdictPanel(tree, 'How I’m voting')
    expect(panel.props.style?.background).toBe(OG_COLORS.tertiary)
    const paths = findAll(panel, node => node.type === 'path')
    expect(paths.map(path => path.props.d)).toEqual([MARK_PATHS.no])
  })

  it('paints a pick in the primary blue and an undecided race pale, both unmarked', () => {
    const pick = verdictPanel(
      itemTree(makeItem({ stance: 'pick' })),
      'How I’m voting',
    )
    const none = verdictPanel(
      itemTree(makeItem({ stance: 'none' })),
      'How I’m voting',
    )
    expect(pick.props.style?.background).toBe(OG_COLORS.primary)
    expect(none.props.style?.background).toBe(OG_COLORS.pale)
    expect(findAll(pick, node => node.type === 'path')).toEqual([])
    expect(findAll(none, node => node.type === 'path')).toEqual([])
  })

  // S1: satori would fetch an emoji over the network, and the fonts have
  // neither glyph. The marks are SVG paths or nothing.
  it('never puts an emoji or check glyph in the text', () => {
    for (const stance of ['yes', 'no', 'pick', 'none'] as const) {
      for (const lang of ['en', 'es'] as const) {
        const text = allText(itemTree(makeItem({ stance }), lang)).join(' ')
        expect(text).not.toMatch(/[\p{Extended_Pictographic}✓✕✗✔✖]/u)
      }
    }
  })

  it('uses the item’s own verdict label when it has one', () => {
    const item = makeItem({ stance: 'yes', stanceLabel: 'Retain them.' })
    expect(allText(itemTree(item))).toContain('Retain them.')
  })
})

describe('ballotGuideOgTree', () => {
  const items = [
    makeItem({ slug: '2k', code: '2K', stance: 'no' }),
    makeItem({ slug: '4a', code: '4A', stance: 'yes' }),
    makeItem({
      slug: 'partisan',
      code: 'Partisan',
      code_es: 'Partidista',
      stance: 'pick',
    }),
    makeItem({ slug: 'rtd-b', code: 'RTD B', stance: 'none' }),
  ]
  const guideTree = (lang: 'en' | 'es' = 'en') =>
    ballotGuideOgTree({
      items,
      lang,
      guide: GUIDE,
      host: HOST,
    })

  it('lays out every item’s code as a chip, in ballot order', () => {
    const text = allText(guideTree())
    const codes = text.filter(t =>
      ['2K', '4A', 'Partisan', 'RTD B'].includes(t),
    )
    expect(codes).toEqual(['2K', '4A', 'Partisan', 'RTD B'])
  })

  it('uses the Spanish code on the Spanish image', () => {
    expect(allText(guideTree('es'))).toContain('Partidista')
  })

  it('fills a yes chip gold and outlines a no chip', () => {
    const chip = (code: string) =>
      findAll(guideTree(), node => children(node).includes(code))[0]
    expect(chip('4A').props.style?.background).toBe(OG_COLORS.accent)
    expect(chip('2K').props.style?.background).toBeUndefined()
    expect(chip('2K').props.style?.border).toContain('solid')
  })

  it('titles the image with the guide’s heading and captions it', () => {
    const text = allText(guideTree())
    expect(text).toContain('Know your ')
    expect(text).toContain('ballot')
    expect(text).toContain('How I’m voting · Nov 3')
    expect(text).toContain('gabrielfordenver.com/ballot')
  })

  it('draws the highlighted word of the heading in gold', () => {
    const [word] = findAll(guideTree(), node =>
      children(node).includes('ballot'),
    )
    expect(word.props.style?.color).toBe(OG_COLORS.accent)
  })
})

describe('splitHighlight', () => {
  it('separates the **highlighted** words from the rest', () => {
    expect(splitHighlight('Know your **ballot**')).toEqual([
      { text: 'Know your ', highlight: false },
      { text: 'ballot', highlight: true },
    ])
  })

  it('returns the whole heading as plain text when nothing is highlighted', () => {
    expect(splitHighlight('Know your ballot')).toEqual([
      { text: 'Know your ballot', highlight: false },
    ])
  })

  it('keeps text that follows the highlight', () => {
    expect(splitHighlight('The **whole** ballot')).toEqual([
      { text: 'The ', highlight: false },
      { text: 'whole', highlight: true },
      { text: ' ballot', highlight: false },
    ])
  })
})
