import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { OG_HEIGHT, OG_WIDTH, type OgNode } from './ballot-og'

/**
 * Turns ballot-og.ts's element tree into a PNG. Needs the fonts, which are
 * static-weight WOFFs from @fontsource 5.3.0 (satori can't read the variable
 * WOFF2 files Astro serves the site with), committed under src/assets/fonts so
 * the build never fetches them.
 *
 * Read once, at module scope, from the repo root: the build runs from there on
 * Netlify (spike S1), and a render is far cheaper than a read. Endpoints stay
 * prerendered, so none of this reaches a serverless function.
 */

const FONTS = join(process.cwd(), 'src/assets/fonts')
const font = (file: string) => readFileSync(join(FONTS, file))

const fonts = [
  {
    name: 'League Spartan',
    data: font('league-spartan-latin-700-normal.woff'),
    weight: 700 as const,
  },
  {
    name: 'League Spartan',
    data: font('league-spartan-latin-800-normal.woff'),
    weight: 800 as const,
  },
  {
    name: 'League Spartan',
    data: font('league-spartan-latin-900-normal.woff'),
    weight: 900 as const,
  },
  {
    name: 'Edu SA Hand',
    data: font('edu-sa-hand-latin-400-normal.woff'),
    weight: 400 as const,
  },
]

/**
 * `embedFont: false` leaves the text as `<text>` elements instead of outlines,
 * which is how a test can count a title's lines; the build leaves it on.
 */
export function ogSvg(tree: OgNode, embedFont = true): Promise<string> {
  // satori types its input as React nodes; this is the same shape as data.
  return satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
    embedFont,
  })
}

export async function ogPng(tree: OgNode): Promise<Uint8Array> {
  const svg = await ogSvg(tree)
  // satori has already drawn the text as paths, so resvg needs no fonts of
  // its own — and not scanning the machine for them keeps builds the same.
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { loadSystemFonts: false },
  })
  return resvg.render().asPng()
}

/** A built PNG as the endpoint's response. */
export function pngResponse(png: Uint8Array): Response {
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png' },
  })
}
