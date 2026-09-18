import { describe, expect, it } from 'vitest'
import { resolveIcon } from './icons'

const registry = { MapPinHouse: 'MapPinHouse component', Apple: 'Apple component' }

describe('resolveIcon', () => {
  it('finds the icon an editor named', () => {
    expect(resolveIcon('Apple', registry)).toBe('Apple component')
  })

  // The reason this function exists: the CMS field is free text, and the
  // header renders one icon per guide on every page of the site, so a typo
  // used to take the whole build down rather than one page.
  it('gives back nothing for a name that is not an icon', () => {
    expect(resolveIcon('AppleTree', registry)).toBeNull()
  })

  it('gives back nothing when a guide has no icon at all', () => {
    expect(resolveIcon(undefined, registry)).toBeNull()
    expect(resolveIcon('', registry)).toBeNull()
  })

  // `registry[name]` would hand back Object.prototype's own members, which
  // render as neither an icon nor an error.
  it.each(['constructor', 'toString', '__proto__'])(
    'gives back nothing for %s, inherited rather than an icon',
    name => {
      expect(resolveIcon(name, registry)).toBeNull()
    },
  )
})
