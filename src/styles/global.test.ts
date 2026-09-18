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
