import { describe, expect, it } from 'vitest'
import { shouldNoindex } from './deploy-context'

describe('shouldNoindex', () => {
  it('keeps production indexable', () => {
    // The consequence of getting this one backwards is the whole campaign site
    // falling out of search results, so it is worth asserting directly.
    expect(shouldNoindex('production')).toBe(false)
  })

  it('hides a branch deploy', () => {
    // `content` is branch-deployed on every CMS save; without this it competes
    // with the real site as duplicate content.
    expect(shouldNoindex('branch-deploy')).toBe(true)
  })

  it('hides a deploy preview', () => {
    expect(shouldNoindex('deploy-preview')).toBe(true)
  })

  it('hides Netlify’s local dev context', () => {
    expect(shouldNoindex('dev')).toBe(true)
  })

  it('leaves a local build alone when CONTEXT is unset', () => {
    // Off Netlify there is nothing to serve the header, and writing one would
    // only show up as an unexplained diff in `dist`.
    expect(shouldNoindex(undefined)).toBe(false)
  })

  it('leaves a local build alone when CONTEXT is empty', () => {
    // Netlify sets the variable to an empty string in some contexts, which is
    // absence rather than a context named "".
    expect(shouldNoindex('')).toBe(false)
  })
})
