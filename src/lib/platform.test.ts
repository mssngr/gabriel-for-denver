import { describe, expect, it } from 'vitest'
import {
  assertGuideRefs,
  assertTranslated,
  assertUniqueSlugs,
  bandTheme,
  guideMetaDescription,
  GUIDE_TRANSLATABLE_FIELDS,
  type Entry,
  type Guide,
  guideSchema,
  localized,
  type Plank,
  PLANK_TRANSLATABLE_FIELDS,
  plankSchema,
  plankAnchor,
  relatedGuides,
  planksForGuide,
  planksForPage,
  resolveHero,
  selectPublished,
  showsPlankRail,
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
      'stance',
      'title',
    ])
  })

  // metaDescription falls back to stripMarkdown(stance) per language, so
  // overriding only the Spanish snippet — because the generated one reads
  // badly — is a legitimate edit. Gating it would fail the whole site's build
  // over a harmless one, which is the failure mode this schema avoids by
  // design.
  it('lets a guide override the meta description in one language only', () => {
    const guide = makeGuide({ metaDescription_es: 'Vivienda para Denver.' })
    expect(() =>
      assertTranslated('guides', [guide], GUIDE_TRANSLATABLE_FIELDS),
    ).not.toThrow()
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

describe('plankAnchor', () => {
  it('namespaces the anchor so it cannot collide with a section heading', () => {
    expect(plankAnchor('legalize-multi-unit')).toBe('plank-legalize-multi-unit')
  })

  // `slug` is a free-text CMS field, so an editor can type something that is
  // not URL-safe. The anchor is a permalink; it has to survive that.
  it('normalizes a slug an editor typed loosely', () => {
    expect(plankAnchor('Legalize Multi Unit!')).toBe(
      'plank-legalize-multi-unit',
    )
  })
})

describe('guideMetaDescription', () => {
  it('prefers an explicit override', () => {
    const guide = makeGuide({ metaDescription: 'Housing for Denver.' }).data
    expect(guideMetaDescription(guide, 'en')).toBe('Housing for Denver.')
  })

  it('falls back to the stance with its markdown stripped', () => {
    expect(guideMetaDescription(makeGuide().data, 'en')).toBe(
      'Housing is a human right, not a commodity.',
    )
  })

  it('reads the Spanish override on the Spanish page', () => {
    const guide = makeGuide({
      metaDescription_es: 'Vivienda para Denver.',
    }).data
    expect(guideMetaDescription(guide, 'es')).toBe('Vivienda para Denver.')
  })

  // The reason metaDescription is exempt from the translation gate. Each
  // language falls back on its own, so an English-only override must NOT leak
  // onto the Spanish page — which is exactly what `localized` would do here.
  it('falls back to the Spanish stance rather than an English override', () => {
    const guide = makeGuide({ metaDescription: 'Housing for Denver.' }).data
    expect(guideMetaDescription(guide, 'es')).toBe(
      'La vivienda es un derecho humano, no una mercancía.',
    )
  })
})

describe('planksForPage', () => {
  const published = makePlank({ id: 'live', slug: 'live', order: 1 })
  const draft = makePlank({ id: 'wip', slug: 'wip', order: 2, status: 'draft' })

  // A published guide's page is public, so a plank still being written must
  // not appear on it just because its guide went live first.
  it('shows only published planks on a published guide', () => {
    const page = planksForPage([published, draft], makeGuide().data)
    expect(page.map(plank => plank.data.slug)).toEqual(['live'])
  })

  // A draft guide's page is already unlisted and noindexed, and previewing
  // unfinished planks is the only reason it gets built at all — hiding them
  // there would make the preview useless.
  it('shows drafts too on a draft guide, which is what the preview is for', () => {
    const guide = makeGuide({ status: 'draft' }).data
    const page = planksForPage([published, draft], guide)
    expect(page.map(plank => plank.data.slug)).toEqual(['live', 'wip'])
  })

  it('ignores planks belonging to another guide', () => {
    const other = makePlank({ id: 'x', slug: 'x', guide: 'big-tech' })
    const page = planksForPage([published, other], makeGuide().data)
    expect(page.map(plank => plank.data.slug)).toEqual(['live'])
  })
})

describe('relatedGuides', () => {
  const housing = makeGuide()
  const draft = makeGuide({ id: 'homelessness', slug: 'homelessness', status: 'draft' })
  const live = makeGuide({ id: 'affordability', slug: 'affordability' })
  const all = [housing, draft, live]

  // The same leak planksForPage prevents, one level up: a public page must not
  // hand a reader a link into an unlisted, noindexed draft.
  it('drops draft guides from a published guide’s cross-links', () => {
    const guide = makeGuide({ related: ['homelessness', 'affordability'] }).data
    expect(relatedGuides(all, guide).map(entry => entry.data.slug)).toEqual([
      'affordability',
    ])
  })

  it('keeps drafts when the linking guide is itself a draft preview', () => {
    const guide = makeGuide({
      status: 'draft',
      related: ['homelessness', 'affordability'],
    }).data
    expect(relatedGuides(all, guide).map(entry => entry.data.slug)).toEqual([
      'homelessness',
      'affordability',
    ])
  })

  it('ignores a related slug that matches no guide', () => {
    const guide = makeGuide({ related: ['nope'] }).data
    expect(relatedGuides(all, guide)).toEqual([])
  })

  it('returns nothing when a guide names no related guides', () => {
    expect(relatedGuides(all, makeGuide().data)).toEqual([])
  })
})

describe('showsPlankRail', () => {
  // The rail and the bands' left gutter that clears it both follow this one
  // rule, so they can't disagree the way the rail and the content padding did
  // when the rail first shipped over the text.
  it('shows no rail for a guide with a single plank, since there is nothing to move between', () => {
    expect(showsPlankRail(1)).toBe(false)
  })

  it('shows the rail as soon as there are two planks to move between', () => {
    expect(showsPlankRail(2)).toBe(true)
  })

  it('shows no rail for a guide with no planks yet', () => {
    expect(showsPlankRail(0)).toBe(false)
  })
})
