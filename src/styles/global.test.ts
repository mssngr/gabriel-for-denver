import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { compile } from '@tailwindcss/node'
import { describe, expect, it } from 'vitest'

const GLOBAL_CSS_PATH = path.resolve(import.meta.dirname, 'global.css')

async function buildUtilityCss(className: string) {
  const css = await readFile(GLOBAL_CSS_PATH, 'utf8')
  const compiler = await compile(css, {
    base: path.dirname(GLOBAL_CSS_PATH),
    onDependency: () => {},
  })
  return compiler.build([className])
}

describe('text-base utility', () => {
  // A `--color-base` theme token previously registered here to fix
  // guide-card.astro's transparent background (see the card-background fix)
  // collided with Tailwind's own `--text-base` font-size scale: both target
  // the `text-base` class name, and the color token won, silently turning
  // every `text-base` usage site-wide into invisible white-on-white text
  // instead of its intended 1rem font size.
  it('still sets a font size, not a text color', async () => {
    const output = await buildUtilityCss('text-base')
    const rule = output.match(/\.text-base\s*\{[^}]*\}/)?.[0]

    expect(rule).toMatch(/font-size:/)
    expect(rule).not.toMatch(/color:/)
  })
})

/**
 * `.card-link` is plain CSS written directly into this file (a `@layer
 * components` family, like `.band`), not a Tailwind-generated utility, so
 * these read the source text itself rather than going through the Tailwind
 * compiler the way the utility test above has to.
 */
describe('.card-link hover and motion', () => {
  // Finds the `{ ... }` that follows `css[openerIndex]`, matching nested
  // braces so a block containing its own rules (a @media block full of
  // selectors) comes back whole rather than truncated at the first `}`.
  function extractBlock(css: string, openerIndex: number): string {
    const start = css.indexOf('{', openerIndex)
    let depth = 0
    for (let i = start; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') {
        depth--
        if (depth === 0) return css.slice(start + 1, i)
      }
    }
    throw new Error(`unbalanced braces from index ${openerIndex}`)
  }

  // A touch device never fires a real `:hover`, so the lift has to live
  // inside the same `@media (hover: hover)` gate Tailwind's own `hover:`
  // variant already used, or a touch device could get stuck mid-lift with
  // no pointer leaving to undo it.
  it('gates the card lift behind @media (hover: hover)', async () => {
    const css = await readFile(GLOBAL_CSS_PATH, 'utf8')
    const mediaIndex = css.indexOf('@media (hover: hover)')
    expect(mediaIndex).toBeGreaterThan(-1)
    const block = extractBlock(css, mediaIndex)
    expect(block).toContain('.card-link:hover')
    expect(block).toMatch(/transform:\s*translateY\(-0\.25rem\)/)
  })

  // Reduced-motion users still get the colour and shadow changes — only the
  // movement itself is switched off.
  it('removes the card-link transform under prefers-reduced-motion', async () => {
    const css = await readFile(GLOBAL_CSS_PATH, 'utf8')
    const mediaIndex = css.lastIndexOf(
      '@media (prefers-reduced-motion: reduce)',
    )
    expect(mediaIndex).toBeGreaterThan(-1)
    const block = extractBlock(css, mediaIndex)
    expect(block).toContain('.card-link')
    expect(block).toMatch(/transform:\s*none\s*!important/)
  })
})
