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

describe('bg-base utility', () => {
  // `bg-base` is used directly in guide-card.astro and sheet.astro to give
  // those cards a solid background. `--color-base` used to be defined only
  // inside the daisyui theme plugin block, which Tailwind's build never
  // reads as a theme token — so `bg-base` silently compiled to nothing and
  // the cards rendered with no background at all.
  it('compiles to an opaque white background rather than a no-op class', async () => {
    const output = await buildUtilityCss('bg-base')

    expect(output).toMatch(/\.bg-base\s*\{\s*background-color:\s*#fff/)
  })
})
