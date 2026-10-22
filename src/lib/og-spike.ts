// SPIKE (S1): renders the rough 2K preview image, to learn whether satori + resvg run in
// the Netlify build. Not for merging; PR 3 rebuilds this with tests.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { getEntry } from 'astro:content'
import satori from 'satori'
import { itemCode } from './ballot'
import { stanceLabel, verdictHeading } from './ballot-copy'

const FONTS = join(process.cwd(), 'src/assets/fonts')
const font = (file: string) => readFileSync(join(FONTS, file))

type Node = { type: string; props: Record<string, unknown> }
const h = (
  type: string,
  props: Record<string, unknown>,
  ...children: (Node | string)[]
): Node => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children },
})

// The design's ✕ and ✓, as SVG shapes rather than emoji: satori would fetch
// an emoji image over the network, and League Spartan has neither glyph.
const mark = (stance: string, color: string) =>
  h(
    'svg',
    {
      width: 108,
      height: 108,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      'stroke-width': 3.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    h('path', { d: stance === 'yes' ? 'M4 12.5l5 5L20 6.5' : 'M6 6l12 12M18 6L6 18' }),
  )

export async function renderSpike(lang: 'en' | 'es') {
  const t0 = performance.now()
  const entry = await getEntry('ballotItems', '2k')
  if (!entry) throw new Error('2k missing')
  const item = entry.data
  const yes = item.stance === 'yes'
  const fg = yes ? '#0e005c' : '#ffffff'

  const tree = h(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        background: '#d5e0ff',
        color: '#0e005c',
        fontFamily: 'League Spartan',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 730,
          padding: '72px 60px 48px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
        h(
          'span',
          {
            style: {
              fontSize: 156,
              fontWeight: 900,
              lineHeight: 0.85,
              color: '#1900a8',
              letterSpacing: -3,
            },
          },
          itemCode(item, lang),
        ),
        h(
          'span',
          { style: { fontSize: 50, fontWeight: 800, lineHeight: 1.1 } },
          lang === 'es' ? item.title_es : item.title,
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
        h(
          'span',
          {
            style: {
              fontFamily: 'Edu SA Hand',
              fontSize: 34,
              color: '#1900a8',
            },
          },
          lang === 'es' ? 'Conoce tu boleta · 3 de nov.' : 'Know your ballot · Nov 3',
        ),
        h(
          'span',
          { style: { fontSize: 29, fontWeight: 700 } },
          lang === 'es' ? 'gabrielfordenver.com/es/ballot' : 'gabrielfordenver.com/ballot',
        ),
      ),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          width: 470,
          padding: 60,
          background: yes ? '#ffc800' : '#0e005c',
          color: fg,
        },
      },
      h(
        'span',
        {
          style: {
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: 'uppercase',
            opacity: 0.8,
          },
        },
        verdictHeading(lang),
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 144,
            fontWeight: 900,
            lineHeight: 0.9,
          },
        },
        mark(item.stance, fg),
        stanceLabel(item, lang),
      ),
    ),
  )

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'League Spartan', data: font('league-spartan-latin-700-normal.woff'), weight: 700 },
      { name: 'League Spartan', data: font('league-spartan-latin-800-normal.woff'), weight: 800 },
      { name: 'League Spartan', data: font('league-spartan-latin-900-normal.woff'), weight: 900 },
      { name: 'Edu SA Hand', data: font('edu-sa-hand-latin-400-normal.woff'), weight: 400 },
    ],
  })
  const t1 = performance.now()
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
  const t2 = performance.now()
  return { png, satoriMs: t1 - t0, resvgMs: t2 - t1 }
}
