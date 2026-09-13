import { describe, expect, it } from 'vitest'
import {
  assertGuideRefs,
  assertTranslated,
  assertUniqueSlugs,
  bandTheme,
  GUIDE_TRANSLATABLE_FIELDS,
  type Entry,
  type Guide,
  guideSchema,
  localized,
  type Plank,
  PLANK_TRANSLATABLE_FIELDS,
  plankSchema,
  planksForGuide,
  resolveHero,
  selectPublished,
} from './platform'

function makeGuide({
  id,
  ...overrides
}: Partial<Guide> & { id?: string } = {}): Entry<Guide> {
  const data: Guide = {
    title: 'Housing Crisis',
    title_es: 'Crisis de Vivienda',
    slug: 'housing-crisis',
    stance: 'Housing is a **human right,** not a commodity.',
    stance_es: 'La vivienda es un **derecho humano,** no una mercancía.',
    lucideIcon: 'MapPinHouse',
    order: 2,
    status: 'published',
    ...overrides,
  }
  return { id: id ?? data.slug, data }
}

function makePlank({
  id,
  ...overrides
}: Partial<Plank> & { id?: string } = {}): Entry<Plank> {
  const data: Plank = {
    guide: 'housing-crisis',
    slug: 'legalize-multi-unit',
    order: 1,
    status: 'published',
    commitment:
      "Legalize apartments, condos and townhomes on at least half of Denver's residential land.",
    commitment_es:
      'Legalizar apartamentos, condominios y casas adosadas en al menos la mitad del suelo residencial de Denver.',
    why: 'Exclusionary zoning has racist origins. It still sets your rent.',
    why_es:
      'La zonificación excluyente tiene orígenes racistas. Todavía fija tu alquiler.',
    ...overrides,
  }
  return { id: id ?? data.slug, data }
}

describe('bandTheme', () => {
  it('cycles ink, sky, ink, gold across the first four bands', () => {
    const themes = [0, 1, 2, 3].map(index => bandTheme(index))
    expect(themes).toEqual(['ink', 'sky', 'ink', 'gold'])
  })

  // Regression test for the bug this replaces: the band colour on
  // src/pages/issues/[id].astro is a ternary chain that runs out at index 2,
  // so a fourth section renders on bare white. A modulo cannot run out.
  it('keeps cycling past the end of the rotation', () => {
    expect(bandTheme(4)).toBe('ink')
    expect(bandTheme(7)).toBe('gold')
    expect(bandTheme(40)).toBe('ink')
  })

  it('lets a plank override the rotation', () => {
    expect(bandTheme(0, 'paper')).toBe('paper')
  })

  // A negative index is not a real case, but `%` on a negative number is
  // negative in JS, which would index off the front of the array and return
  // undefined — the exact failure mode being designed out above.
  it('stays inside the rotation for a negative index', () => {
    expect(bandTheme(-1)).toBe('gold')
  })
})

describe('localized', () => {
  it('reads the Spanish twin on the Spanish site', () => {
    expect(localized(makePlank().data, 'why', 'es')).toContain('orígenes')
  })

  it('falls back to English when a draft has no Spanish yet', () => {
    const plank = makePlank({ status: 'draft', why_es: undefined }).data
    expect(localized(plank, 'why', 'es')).toBe(
      'Exclusionary zoning has racist origins. It still sets your rent.',
    )
  })

  it('returns undefined when neither language has the field', () => {
    expect(localized(makePlank().data, 'kicker', 'en')).toBeUndefined()
  })
})

describe('resolveHero', () => {
  it('leads with the statistic when a plank has one', () => {
    const plank = makePlank({
      statValue: '77%',
      statCaption: "of Denver's residential land bans apartments.",
      statCaption_es: 'del suelo residencial de Denver prohíbe apartamentos.',
    }).data
    expect(resolveHero(plank, 'en')).toEqual({
      kind: 'stat',
      value: '77%',
      caption: "of Denver's residential land bans apartments.",
    })
  })

  it('falls back to the pull-quote when there is no statistic', () => {
    const plank = makePlank({
      pullQuote: 'Rent went up 45%. Paychecks went up 28%.',
    }).data
    expect(resolveHero(plank, 'en')).toEqual({
      kind: 'quote',
      quote: 'Rent went up 45%. Paychecks went up 28%.',
    })
  })

  it('falls back to the commitment itself when there is neither', () => {
    expect(resolveHero(makePlank().data, 'en')).toEqual({
      kind: 'statement',
      text: "Legalize apartments, condos and townhomes on at least half of Denver's residential land.",
    })
  })

  // Deliberately resolved rather than validated: a Sveltia save commits
  // straight to main, so a schema that can reject an editor's entry is a
  // schema that can take the whole site's next build down. Both fields set is
  // a render decision, not an error.
  it('prefers the statistic when a plank carries both a stat and a quote', () => {
    const plank = makePlank({
      statValue: '30%',
      statCaption: 'of new housing, required to be affordable.',
      pullQuote: 'Ten percent is not a policy.',
    }).data
    expect(resolveHero(plank, 'en').kind).toBe('stat')
  })

  it('reads Spanish captions on the Spanish page', () => {
    const plank = makePlank({
      statValue: '77%',
      statCaption: "of Denver's residential land bans apartments.",
      statCaption_es: 'del suelo residencial de Denver prohíbe apartamentos.',
    }).data
    expect(resolveHero(plank, 'es')).toEqual({
      kind: 'stat',
      value: '77%',
      caption: 'del suelo residencial de Denver prohíbe apartamentos.',
    })
  })
})

describe('assertGuideRefs', () => {
  it('accepts planks that point at a real guide', () => {
    expect(() => assertGuideRefs([makeGuide()], [makePlank()])).not.toThrow()
  })

  // The runtime failure this guards against is specific: Sveltia's relation
  // widget fails open, so a guide saved with an empty `slug` makes its planks
  // silently store the guide's *title* instead. The message has to name both
  // sides or that is very hard to diagnose from a red build.
  it('names the orphan and lists the known guides', () => {
    const orphan = makePlank({ guide: 'Housing Crisis' })
    expect(() => assertGuideRefs([makeGuide()], [orphan])).toThrow(
      /legalize-multi-unit -> "Housing Crisis".*housing-crisis/s,
    )
  })

  it('catches a related-guide link that points nowhere', () => {
    const guide = makeGuide({ related: ['homelessness'] })
    expect(() => assertGuideRefs([guide], [])).toThrow(
      /housing-crisis -> "homelessness"/,
    )
  })

  it('reports every orphan at once rather than only the first', () => {
    const planks = [
      makePlank({ id: 'a', slug: 'a', guide: 'nope' }),
      makePlank({ id: 'b', slug: 'b', guide: 'also-nope' }),
    ]
    const run = () => assertGuideRefs([makeGuide()], planks)
    expect(run).toThrow(/a -> "nope"/)
    expect(run).toThrow(/b -> "also-nope"/)
  })
})

describe('assertUniqueSlugs', () => {
  it('accepts a collection whose slugs are all distinct', () => {
    const guides = [
      makeGuide(),
      makeGuide({ id: 'big-tech', slug: 'big-tech' }),
    ]
    expect(() => assertUniqueSlugs('guides', guides)).not.toThrow()
  })

  // Two guides claiming one slug doesn't error anywhere on its own — one of
  // them just silently loses its route, which is a much worse way to find out.
  it('names the slug two entries are fighting over', () => {
    const guides = [
      makeGuide({ id: 'housing' }),
      makeGuide({ id: 'housing-2' }),
    ]
    expect(() => assertUniqueSlugs('guides', guides)).toThrow(
      /housing-crisis.*housing, housing-2/s,
    )
  })
})

describe('assertTranslated', () => {
  it('accepts a published plank with every Spanish twin filled', () => {
    expect(() =>
      assertTranslated('planks', [makePlank()], PLANK_TRANSLATABLE_FIELDS),
    ).not.toThrow()
  })

  it('rejects a published plank missing a Spanish twin, naming the field', () => {
    const plank = makePlank({ why_es: undefined })
    expect(() =>
      assertTranslated('planks', [plank], PLANK_TRANSLATABLE_FIELDS),
    ).toThrow(/legalize-multi-unit.*why_es/s)
  })

  // The entire point of making `_es` optional in Zod: an English-only entry
  // has to be saveable, or the platform cannot be drafted at all.
  // The gate runs both ways. A kicker_es written before its English base
  // diverges the two sites just as much as the reverse — it just strands the
  // content on /es/ instead, where an English-speaking reviewer won't see it.
  it('rejects a published plank whose Spanish has run ahead of its English', () => {
    const plank = makePlank({ kicker: undefined, kicker_es: 'Zonificación' })
    expect(() =>
      assertTranslated('planks', [plank], PLANK_TRANSLATABLE_FIELDS),
    ).toThrow(/legalize-multi-unit \(kicker\)/)
  })

  // Source labels are usually document titles, which are often right
  // untranslated — so `sources[].label_es` is deliberately outside the gate.
  // Pinned here so a later refactor of translatableFields can't quietly
  // start or stop enforcing it.
  it('leaves a source label untranslated without complaint', () => {
    const plank = makePlank({
      sources: [
        { label: 'Denver zoning analysis, 2024', url: 'https://example.org' },
      ],
    })
    expect(PLANK_TRANSLATABLE_FIELDS).not.toContain('sources')
    expect(() =>
      assertTranslated('planks', [plank], PLANK_TRANSLATABLE_FIELDS),
    ).not.toThrow()
  })

  it('exempts drafts from the translation gate', () => {
    const draft = makePlank({ status: 'draft', why_es: undefined })
    expect(() =>
      assertTranslated('planks', [draft], PLANK_TRANSLATABLE_FIELDS),
    ).not.toThrow()
  })

  it('ignores a field the entry does not use in either language', () => {
    const plank = makePlank({ kicker: undefined, kicker_es: undefined })
    expect(() =>
      assertTranslated('planks', [plank], PLANK_TRANSLATABLE_FIELDS),
    ).not.toThrow()
  })

  it('gates every guide field the schema gives a Spanish twin', () => {
    expect([...GUIDE_TRANSLATABLE_FIELDS].sort()).toEqual([
      'artworkAlt',
      'metaDescription',
      'stance',
      'title',
    ])
  })

  it('gates every plank field the schema gives a Spanish twin', () => {
    expect([...PLANK_TRANSLATABLE_FIELDS].sort()).toEqual([
      'authority',
      'commitment',
      'detail',
      'kicker',
      'pullQuote',
      'statCaption',
      'why',
    ])
  })
})

describe('selectPublished', () => {
  it('lists published guides in order', () => {
    const guides = [
      makeGuide({ id: 'big-tech', slug: 'big-tech', order: 3 }),
      makeGuide({ id: 'affordability', slug: 'affordability', order: 1 }),
    ]
    const selected = selectPublished(guides, [])
    expect(selected.guides.map(guide => guide.data.slug)).toEqual([
      'affordability',
      'big-tech',
    ])
  })

  it('drops draft guides', () => {
    const guides = [makeGuide({ status: 'draft' })]
    expect(selectPublished(guides, []).guides).toEqual([])
  })

  // A guide's status wins over its planks', so nothing can leak onto the live
  // site by way of a plank that was published ahead of the guide it sits in.
  it('drops a published plank whose guide is still a draft', () => {
    const guides = [makeGuide({ status: 'draft' })]
    expect(selectPublished(guides, [makePlank()]).planks).toEqual([])
  })

  it('drops draft planks under a published guide', () => {
    const planks = [
      makePlank(),
      makePlank({ id: 'wip', slug: 'wip', status: 'draft' }),
    ]
    const selected = selectPublished([makeGuide()], planks)
    expect(selected.planks.map(plank => plank.data.slug)).toEqual([
      'legalize-multi-unit',
    ])
  })
})

describe('planksForGuide', () => {
  it('returns only that guide’s planks, in order', () => {
    const planks = [
      makePlank({ id: 'c', slug: 'c', guide: 'big-tech', order: 1 }),
      makePlank({ id: 'b', slug: 'b', order: 2 }),
      makePlank({ id: 'a', slug: 'a', order: 1 }),
    ]
    expect(
      planksForGuide(planks, 'housing-crisis').map(plank => plank.data.slug),
    ).toEqual(['a', 'b'])
  })
})

describe('schemas', () => {
  it('defaults a new guide to draft so nothing publishes by accident', () => {
    const withoutStatus = { ...makeGuide().data, status: undefined }
    expect(guideSchema.parse(withoutStatus).status).toBe('draft')
  })

  it('accepts a plank written entirely in English', () => {
    const plank = makePlank({ commitment_es: undefined, why_es: undefined })
    expect(() => plankSchema.parse(plank.data)).not.toThrow()
  })

  // A source URL is checked by the CMS field's own `pattern`, not by Zod: a
  // Sveltia save is a commit to main, so a strict check here would turn one
  // typo into a failed build for the whole site.
  it('accepts a source URL without second-guessing it', () => {
    const plank = makePlank({
      sources: [
        { label: 'Denver zoning analysis, 2024', url: 'https://example.org' },
      ],
    })
    expect(() => plankSchema.parse(plank.data)).not.toThrow()
  })
})
