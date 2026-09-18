import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { includeInSitemap, readDraftGuideSlugs } from './sitemap'

function guidesDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'guides-'))
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body)
  }
  return dir
}

describe('readDraftGuideSlugs', () => {
  it('lists the drafts and leaves the published ones out', () => {
    const dir = guidesDir({
      'a.yml': 'slug: housing-for-all\nstatus: published\n',
      'b.yml': 'slug: transit\nstatus: draft\n',
    })
    expect(readDraftGuideSlugs(dir)).toEqual(['transit'])
  })

  // The schema defaults `status` to draft, so a file without one is a draft.
  // Reading it as published would put an unfinished page in front of Google.
  it('treats a guide with no status as a draft', () => {
    const dir = guidesDir({ 'a.yml': 'slug: transit\ntitle: Transit\n' })
    expect(readDraftGuideSlugs(dir)).toEqual(['transit'])
  })

  it('reads a quoted slug', () => {
    const dir = guidesDir({ 'a.yml': "slug: 'transit'\nstatus: draft\n" })
    expect(readDraftGuideSlugs(dir)).toEqual(['transit'])
  })

  it('ignores anything that is not a guide file', () => {
    const dir = guidesDir({
      'a.yml': 'slug: transit\nstatus: draft\n',
      'README.md': 'slug: not-a-guide\n',
    })
    expect(readDraftGuideSlugs(dir)).toEqual(['transit'])
  })

  // The CMS writes `status: published` on a line of its own; anything that
  // doesn't match exactly should fail towards hiding the page, not exposing it.
  it('treats an unreadable status as a draft', () => {
    const dir = guidesDir({ 'a.yml': 'slug: transit\nstatus: publishedish\n' })
    expect(readDraftGuideSlugs(dir)).toEqual(['transit'])
  })

  it('has nothing to say about a directory of published guides', () => {
    const dir = guidesDir({ 'a.yml': 'slug: transit\nstatus: published\n' })
    expect(readDraftGuideSlugs(dir)).toEqual([])
  })
})

describe('includeInSitemap', () => {
  const drafts = ['transit']

  it('keeps the pages a reader is meant to find', () => {
    for (const page of [
      'https://gabrielfordenver.com/',
      'https://gabrielfordenver.com/platform/',
      'https://gabrielfordenver.com/platform/housing-for-all/',
      'https://gabrielfordenver.com/es/platform/',
      'https://gabrielfordenver.com/es/platform/housing-for-all/',
      'https://gabrielfordenver.com/why-me/',
    ]) {
      expect(includeInSitemap(page, drafts)).toBe(true)
    }
  })

  it('leaves out the pages that were never for readers', () => {
    for (const page of [
      'https://gabrielfordenver.com/admin/',
      'https://gabrielfordenver.com/thank-you/',
      'https://gabrielfordenver.com/404/',
      'https://gabrielfordenver.com/posts/',
      'https://gabrielfordenver.com/posts/some-update/',
    ]) {
      expect(includeInSitemap(page, drafts)).toBe(false)
    }
  })

  // The whole point of this change: a draft guide builds a page so the
  // campaign can read it on the real domain, and that page carries `noindex`.
  // Listing it in the sitemap would invite the crawl that noindex then refuses.
  it('leaves out a draft guide in both languages', () => {
    expect(
      includeInSitemap('https://gabrielfordenver.com/platform/transit/', drafts),
    ).toBe(false)
    expect(
      includeInSitemap(
        'https://gabrielfordenver.com/es/platform/transit/',
        drafts,
      ),
    ).toBe(false)
  })

  it('matches a draft slug whole, not as a prefix', () => {
    expect(
      includeInSitemap(
        'https://gabrielfordenver.com/platform/transit-funding/',
        drafts,
      ),
    ).toBe(true)
  })

  it('leaves the index in when every guide is still a draft', () => {
    expect(
      includeInSitemap('https://gabrielfordenver.com/platform/', drafts),
    ).toBe(true)
  })
})
