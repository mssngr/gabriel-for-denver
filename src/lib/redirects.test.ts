import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ISSUE_TO_PLATFORM, issueRedirects } from './redirects'

/**
 * Read straight from the content directories rather than through the module
 * under test: the point of these tests is that the hand-written map still
 * matches the content on disk, which a shared reader would hide.
 */
function slugsIn(dir: string): string[] {
  return readdirSync(dir)
    .filter(file => file.endsWith('.yml'))
    .map(file => {
      const match = readFileSync(`${dir}/${file}`, 'utf8').match(
        /^slug:\s*['"]?([^'"\n]+)['"]?\s*$/m,
      )
      if (!match) throw new Error(`${dir}/${file} has no slug`)
      return match[1].trim()
    })
}

const issueSlugs = slugsIn('src/content/issues')
const guideSlugs = slugsIn('src/content/guides')

describe('ISSUE_TO_PLATFORM', () => {
  // The failure this guards against is a silent 404 on a URL that has been
  // shared for a year: an issue with no entry here keeps building its own
  // page until PR 4 deletes the route, and then simply 404s.
  it.each(issueSlugs)('sends /issues/%s somewhere', slug => {
    expect(ISSUE_TO_PLATFORM[slug]).toBeDefined()
  })

  it('points every issue at the platform index or a real guide', () => {
    for (const target of Object.values(ISSUE_TO_PLATFORM)) {
      if (target === '/platform') continue
      const slug = target.replace('/platform/', '')
      expect(guideSlugs).toContain(slug)
    }
  })

  it('has no entry for an issue that no longer exists', () => {
    expect(Object.keys(ISSUE_TO_PLATFORM).sort()).toEqual([...issueSlugs].sort())
  })
})

describe('issueRedirects', () => {
  const redirects = issueRedirects()

  it('redirects the issues index to the platform index', () => {
    expect(redirects['/issues']).toBe('/platform')
    expect(redirects['/es/issues']).toBe('/es/platform')
  })

  it('gives every issue an English and a Spanish redirect', () => {
    for (const [slug, target] of Object.entries(ISSUE_TO_PLATFORM)) {
      expect(redirects[`/issues/${slug}`]).toBe(target)
      expect(redirects[`/es/issues/${slug}`]).toBe(`/es${target}`)
    }
  })

  // A Spanish URL landing on the English page is the quiet version of this
  // going wrong: still a 200, still the wrong language.
  it('keeps every Spanish redirect inside the Spanish site', () => {
    for (const [from, to] of Object.entries(redirects)) {
      if (from.startsWith('/es/')) expect(to.startsWith('/es/')).toBe(true)
    }
  })

  it('covers both languages and nothing else', () => {
    expect(Object.keys(redirects)).toHaveLength(
      (issueSlugs.length + 1) * 2, // every issue, plus the index, per language
    )
  })
})
