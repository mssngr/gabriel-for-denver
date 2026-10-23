import { describe, expect, it } from 'vitest'
import { ballotGuideOgTree, ballotOgTree } from './ballot-og'
import { GUIDE, HOST, itemInput, makeItem } from './ballot-og-fixtures'
import { ogPng, ogSvg } from './ballot-og-render'

// The widest cases on the real ballot, from src/content/ballot-items. Checked
// against the image's own layout so a long title is stepped down rather than
// spilling off the edge. A longer title added later is clamped, not
// rejected, so this pins the cases that exist rather than every edit.
const LONGEST = [
  makeItem({
    code: '4A',
    stance: 'yes',
    title: '$44 Million Mill Levy Override',
    title_es:
      'Aumento del impuesto predial (Mill Levy Override) de $44 millones',
  }),
  makeItem({
    code: '25 judges',
    code_es: '25 jueces',
    stance: 'yes',
    stanceLabel: 'Retain them.',
    stanceLabel_es: 'Retenerlos.',
    title: 'Supreme, Appeals, District, and County Courts',
    title_es: 'Tribunal Supremo, de Apelaciones, de Distrito y de Condado',
  }),
  makeItem({
    code: 'At-large B',
    code_es: 'Escaño B',
    stance: 'pick',
    stanceLabel: 'Gabriel Konkle',
    stanceLabel_es: 'Gabriel Konkle',
    title: 'Denver City Council, At-Large Seat B',
    title_es: 'Concejo Municipal de Denver, Miembro General Escaño B',
  }),
  makeItem({
    code: 'Partisan',
    code_es: 'Partidista',
    stance: 'pick',
    stanceLabel: 'The Democrats',
    stanceLabel_es: 'Los demócratas',
    title: 'State & Federal Positions',
    title_es: 'Cargos estatales y federales',
  }),
  makeItem({
    code: 'RTD B',
    stance: 'none',
    title: 'RTD Board, District B (some ballots only)',
    title_es: 'Junta de RTD, Distrito B (solo en algunas boletas)',
  }),
  makeItem({ code: '4B', stance: 'yes', title: 'x '.repeat(60).trim() }),
]

type Run = { x: number; y: number; width: number; size: number; text: string }

/** Every text run in the SVG, which `embedFont: false` leaves as `<text>`. */
function textRuns(svg: string): Run[] {
  const runs: Run[] = []
  for (const match of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const attr = (name: string) =>
      Number(match[1].match(new RegExp(`(?:^| )${name}="([^"]*)"`))?.[1])
    runs.push({
      x: attr('x'),
      y: attr('y'),
      width: attr('width'),
      size: attr('font-size'),
      text: match[2],
    })
  }
  return runs
}

const lines = (runs: Run[]) => new Set(runs.map(run => run.y)).size

describe('ogPng', () => {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  // IHDR follows the 8-byte signature: length, "IHDR", then width, height.
  function dimensions(png: Uint8Array) {
    const view = new DataView(png.buffer, png.byteOffset)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }

  it('renders an item as a 1200×630 PNG', async () => {
    const png = await ogPng(ballotOgTree(itemInput(makeItem(), 'en')))
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE)
    expect(dimensions(png)).toEqual({ width: 1200, height: 630 })
  })

  it('renders the guide as a 1200×630 PNG too', async () => {
    const png = await ogPng(
      ballotGuideOgTree({
        items: [makeItem()],
        lang: 'es',
        guide: GUIDE,
        host: HOST,
      }),
    )
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE)
    expect(dimensions(png)).toEqual({ width: 1200, height: 630 })
  })
})

describe('image layout', () => {
  // satori sizes boxes by content unless told otherwise, which made the
  // first guide image 1320×730 and pushed its footer off the bottom.
  it('lays the image out in exactly 1200×630', async () => {
    const svg = await ogSvg(ballotOgTree(itemInput(makeItem(), 'en')), false)
    expect(svg).toContain('<rect x="0" y="0" width="1200" height="630"')
    const guide = await ogSvg(
      ballotGuideOgTree({
        items: [makeItem()],
        lang: 'en',
        guide: GUIDE,
        host: HOST,
      }),
      false,
    )
    expect(guide).toContain('<rect x="0" y="0" width="1200" height="630"')
  })

  for (const lang of ['en', 'es'] as const) {
    for (const item of LONGEST) {
      const label = `${item.code} in ${lang}`

      it(`fits ${label} in its columns, with a one-line code and at most three title lines`, async () => {
        const svg = await ogSvg(ballotOgTree(itemInput(item, lang)), false)
        const runs = textRuns(svg).filter(run => run.text.trim())
        // A space at the end of a wrapped line is allowed to hang past the
        // edge, so spaces are left out.
        for (const run of runs) {
          // Left column text ends by x=670 (730 less its 60px padding), the
          // verdict panel's by x=1140 (1200 less 60).
          const limit = run.x < 730 ? 670 : 1140
          expect(run.x + run.width, run.text).toBeLessThanOrEqual(limit + 1)
        }
        const [code, ...rest] = runs.filter(run => run.x < 730)
        const title = rest.filter(run => run.size === rest[0].size)
        expect(lines([code])).toBe(1)
        expect(lines(title)).toBeLessThanOrEqual(3)
      })
    }
  }

  // A title long enough to defeat the steps is clamped with an ellipsis
  // instead of running into the footer.
  it('clamps a title that is too long even at the smallest size', async () => {
    const long = makeItem({ title: 'word '.repeat(80).trim() })
    const svg = await ogSvg(ballotOgTree(itemInput(long, 'en')), false)
    const title = textRuns(svg).filter(run => run.x < 730 && run.size < 60)
    expect(
      lines(title.filter(run => run.size === title[0].size)),
    ).toBeLessThanOrEqual(3)
  })

  it('keeps every chip of a full guide inside the image', async () => {
    const items = Array.from({ length: 25 }, (_, index) =>
      makeItem({
        slug: `s${index}`,
        code: index % 5 === 0 ? 'At-large B' : `${100 + index}`,
      }),
    )
    const svg = await ogSvg(
      ballotGuideOgTree({ items, lang: 'en', guide: GUIDE, host: HOST }),
      false,
    )
    const runs = textRuns(svg)
    for (const run of runs)
      expect(run.x + run.width, run.text).toBeLessThanOrEqual(1141)
    // The footer's caption sits below the last row of chips.
    const caption = runs.find(run => run.text === 'How')
    const chips = runs.filter(run => run.size === 44)
    expect(Math.max(...chips.map(run => run.y))).toBeLessThan(caption?.y ?? 0)
  })
})
