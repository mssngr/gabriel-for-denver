import { describe, expect, it } from 'vitest'
import {
  assertGuideRefs,
  assertTranslated,
  assertUniqueSlugs,
  bandTheme,
  guideMetaDescription,
  idFromFilename,
  leadSource,
  GUIDE_TRANSLATABLE_FIELDS,
  type Entry,
  type Guide,
  guideSchema,
  localized,
  nextGuide,
  type Plank,
  PLANK_TRANSLATABLE_FIELDS,
  plankSchema,
  plankAnchor,
  currentPageUrl,
  plankUrl,
  actionCount,
  ctaHeading,
  plankLabel,
  platformSummary,
  relatedGuides,
  planksForGuide,
  planksForPage,
  resolveHero,
  selectPublished,
  showsPlankRail,
  TIMELINES,
  timelineLabel,
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
  it('cycles ink, sky, gold across the first three bands', () => {
    const themes = [0, 1, 2].map(index => bandTheme(index))
    expect(themes).toEqual(['ink', 'sky', 'gold'])
  })

  // The earlier ink, sky, ink, gold rotation meant gold only ever appeared on
  // a fourth plank, so a three-plank guide showed two colours, not three.
  it('gives a three-plank guide all three colours', () => {
    const themes = new Set([0, 1, 2].map(index => bandTheme(index)))
    expect(themes.size).toBe(3)
  })

  // Regression test for the bug this replaces: the band colour on
  // src/pages/issues/[id].astro is a ternary chain that runs out at index 2,
  // so a fourth section renders on bare white. A modulo cannot run out.
  it('keeps cycling past the end of the rotation', () => {
    expect(bandTheme(3)).toBe('ink')
    expect(bandTheme(5)).toBe('gold')
    expect(bandTheme(40)).toBe('sky')
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
      caption: "of Denver's residential land bans apartments.",
      caption_es: 'del suelo residencial de Denver prohíbe apartamentos.',
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
      caption: undefined,
    })
  })

  it('gives the pull-quote its caption too, e.g. who said it', () => {
    const plank = makePlank({
      pullQuote: "You can't get a breath of fresh air without us knowing.",
      caption: 'A Denver Police Officer',
    }).data
    expect(resolveHero(plank, 'en')).toEqual({
      kind: 'quote',
      quote: "You can't get a breath of fresh air without us knowing.",
      caption: 'A Denver Police Officer',
    })
  })

  it('reads the pull-quote caption in Spanish on the Spanish page', () => {
    const plank = makePlank({
      pullQuote: "You can't get a breath of fresh air without us knowing.",
      pullQuote_es: 'No puedes respirar aire fresco sin que lo sepamos.',
      caption: 'A Denver Police Officer',
      caption_es: 'Un oficial de la policía de Denver',
    }).data
    expect(resolveHero(plank, 'es')).toEqual({
      kind: 'quote',
      quote: 'No puedes respirar aire fresco sin que lo sepamos.',
      caption: 'Un oficial de la policía de Denver',
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
      caption: 'of new housing, required to be affordable.',
      pullQuote: 'Ten percent is not a policy.',
    }).data
    expect(resolveHero(plank, 'en').kind).toBe('stat')
  })

  it('reads Spanish captions on the Spanish page', () => {
    const plank = makePlank({
      statValue: '77%',
      caption: "of Denver's residential land bans apartments.",
      caption_es: 'del suelo residencial de Denver prohíbe apartamentos.',
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
    const guide = makeGuide({ related: [{ guide: 'homelessness' }] })
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

describe('idFromFilename', () => {
  // The default id a bare glob() loader assigns reads the `slug` field when
  // present, so two files sharing a slug also share an id — the loader keeps
  // one and silently drops the other before assertUniqueSlugs ever runs.
  // Deriving the id from the filename instead means two files can never
  // collide, whatever their `slug` field says.
  it('strips the extension off a flat filename', () => {
    expect(idFromFilename('legalize-multi-unit.yml')).toBe(
      'legalize-multi-unit',
    )
  })

  it('strips only the last extension, keeping a dot inside the name', () => {
    expect(idFromFilename('my.plank.yml')).toBe('my.plank')
  })

  it('keeps a nested path intact, extension aside', () => {
    expect(idFromFilename('sub/dir/plank.yml')).toBe('sub/dir/plank')
  })

  it('gives two entries with the same slug two different ids', () => {
    expect(idFromFilename('legalize-multi-unit.yml')).not.toBe(
      idFromFilename('dbc0055c2a96.yml'),
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
      'caption',
      'commitment',
      'detail',
      'kicker',
      'pullQuote',
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

  // Giving two planks the same position is an easy slip when editing by hand.
  // Breaking the tie by slug keeps the order the same on every build rather
  // than whatever order the content loader happened to return.
  it('breaks a tie in order by slug, whatever order the planks arrive in', () => {
    const planks = [
      makePlank({ id: 'zoning', slug: 'zoning', order: 1 }),
      makePlank({ id: 'rent', slug: 'rent', order: 1 }),
    ]
    expect(
      planksForGuide(planks, 'housing-crisis').map(plank => plank.data.slug),
    ).toEqual(['rent', 'zoning'])
  })
})

describe('schemas', () => {
  it('defaults a new guide to draft so nothing publishes by accident', () => {
    const withoutStatus = { ...makeGuide().data, status: undefined }
    expect(guideSchema.parse(withoutStatus).status).toBe('draft')
  })

  // The CMS used to store related guides as a plain list of slugs. An editor
  // with the old admin page still open could save that shape after this
  // deploys, and a schema that rejected it would take the whole build down.
  it('still accepts related guides saved as plain slugs', () => {
    const withLegacyRelated = {
      ...makeGuide().data,
      related: ['affordability'],
    }
    expect(guideSchema.parse(withLegacyRelated).related).toEqual([
      { guide: 'affordability' },
    ])
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

describe('currentPageUrl', () => {
  it('combines the path with the configured site into an absolute url', () => {
    expect(
      currentPageUrl(
        '/platform/housing',
        new URL('https://gabrielfordenver.com'),
      ),
    ).toBe('https://gabrielfordenver.com/platform/housing')
  })
})

describe('plankUrl', () => {
  it('appends the plank anchor to the guide page url', () => {
    expect(
      plankUrl('https://gabrielfordenver.com/platform/housing', 'co-living'),
    ).toBe('https://gabrielfordenver.com/platform/housing#plank-co-living')
  })

  it('normalizes a slug an editor typed loosely, same as plankAnchor', () => {
    expect(
      plankUrl('https://gabrielfordenver.com/platform/housing', 'Co Living!'),
    ).toBe('https://gabrielfordenver.com/platform/housing#plank-co-living')
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
  const draft = makeGuide({
    id: 'homelessness',
    slug: 'homelessness',
    status: 'draft',
  })
  const live = makeGuide({ id: 'affordability', slug: 'affordability' })
  const all = [housing, draft, live]
  const slugs = (links: { guide: Entry<Guide> }[]) =>
    links.map(link => link.guide.data.slug)

  // The same leak planksForPage prevents, one level up: a public page must not
  // hand a reader a link into an unlisted, noindexed draft.
  it('drops draft guides from a published guide’s cross-links', () => {
    const guide = makeGuide({
      related: [{ guide: 'homelessness' }, { guide: 'affordability' }],
    }).data
    expect(slugs(relatedGuides(all, guide, 'en'))).toEqual(['affordability'])
  })

  it('keeps drafts when the linking guide is itself a draft preview', () => {
    const guide = makeGuide({
      status: 'draft',
      related: [{ guide: 'homelessness' }, { guide: 'affordability' }],
    }).data
    expect(slugs(relatedGuides(all, guide, 'en'))).toEqual([
      'homelessness',
      'affordability',
    ])
  })

  it('ignores a related slug that matches no guide', () => {
    const guide = makeGuide({ related: [{ guide: 'nope' }] }).data
    expect(relatedGuides(all, guide, 'en')).toEqual([])
  })

  it('returns nothing when a guide names no related guides', () => {
    expect(relatedGuides(all, makeGuide().data, 'en')).toEqual([])
  })

  it('carries the one-line reason for the page’s language', () => {
    const guide = makeGuide({
      related: [
        {
          guide: 'affordability',
          reason: 'rent is the largest line in most Denver budgets',
          reason_es:
            'el alquiler es el mayor gasto en la mayoría de los presupuestos',
        },
      ],
    }).data
    expect(relatedGuides(all, guide, 'en')[0].reason).toBe(
      'rent is the largest line in most Denver budgets',
    )
    expect(relatedGuides(all, guide, 'es')[0].reason).toBe(
      'el alquiler es el mayor gasto en la mayoría de los presupuestos',
    )
  })

  // A reason is a sentence, not a title, so English text on the Spanish page
  // would be a visible slip. Showing the link without a reason reads fine.
  it('leaves the reason off the Spanish page rather than showing English', () => {
    const guide = makeGuide({
      related: [{ guide: 'affordability', reason: 'rent is the largest line' }],
    }).data
    expect(relatedGuides(all, guide, 'es')[0].reason).toBeUndefined()
  })
})

describe('nextGuide', () => {
  const at = (
    slug: string,
    order: number,
    status: Guide['status'] = 'published',
  ) => makeGuide({ id: slug, slug, order, status })

  it('links to the published guide that comes next in order', () => {
    const guides = [
      at('big-tech', 3),
      at('housing-crisis', 2),
      at('affordability', 1),
    ]
    expect(nextGuide(guides, at('housing-crisis', 2).data)?.data.slug).toBe(
      'big-tech',
    )
  })

  it('skips a draft guide sitting in between', () => {
    const guides = [at('homelessness', 3, 'draft'), at('big-tech', 4)]
    expect(nextGuide(guides, at('housing-crisis', 2).data)?.data.slug).toBe(
      'big-tech',
    )
  })

  // No wrap-around: from the last guide, "next" back to the first reads as a
  // loop rather than progress, and the hero already links back to the index.
  // Two guides sharing an `order` used to skip each other entirely, because
  // "next" only looked for a strictly higher order.
  it('moves between guides that share an order, in slug order', () => {
    const guides = [
      at('housing-crisis', 3),
      at('big-tech', 2),
      at('affordability', 2),
    ]
    expect(nextGuide(guides, at('affordability', 2).data)?.data.slug).toBe(
      'big-tech',
    )
    expect(nextGuide(guides, at('big-tech', 2).data)?.data.slug).toBe(
      'housing-crisis',
    )
  })

  it('has no next guide after the last published one', () => {
    const guides = [at('affordability', 1), at('housing-crisis', 2)]
    expect(nextGuide(guides, at('housing-crisis', 2).data)).toBeUndefined()
  })
})

describe('leadSource', () => {
  const source = (overrides = {}) => ({
    label: 'Denver zoning analysis, 2024',
    url: 'https://example.org/zoning',
    ...overrides,
  })

  it('uses a plank’s first source as its band footnote', () => {
    const plank = makePlank({
      sources: [
        source(),
        source({ label: 'Second study', url: 'https://example.org/2' }),
      ],
    }).data
    expect(leadSource(plank, 'en')).toEqual({
      label: 'Denver zoning analysis, 2024',
      url: 'https://example.org/zoning',
    })
  })

  it('gives no footnote to a plank with no sources', () => {
    expect(leadSource(makePlank().data, 'en')).toBeUndefined()
  })

  it('uses the Spanish label on the Spanish page when there is one', () => {
    const plank = makePlank({
      sources: [
        source({ label_es: 'Análisis de zonificación de Denver, 2024' }),
      ],
    }).data
    expect(leadSource(plank, 'es')?.label).toBe(
      'Análisis de zonificación de Denver, 2024',
    )
  })

  // Unlike a related-guide reason, a source label is usually a document's own
  // title, which is often correct untranslated — so it falls back to English.
  it('keeps the original label on the Spanish page when it was not translated', () => {
    const plank = makePlank({ sources: [source()] }).data
    expect(leadSource(plank, 'es')?.label).toBe('Denver zoning analysis, 2024')
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

describe('plankLabel', () => {
  // Built as one string on purpose. Written as two adjacent expressions in the
  // template, Prettier moved them onto separate lines and Astro dropped the
  // space between them, so the live panel read "PLANK01".
  it('numbers the plank and names its sub-topic', () => {
    const plank = makePlank({ kicker: 'Zoning' }).data
    expect(plankLabel(plank, 0, 'en')).toBe('Action 01 · Zoning')
  })

  it('leaves the separator off when a plank has no sub-topic', () => {
    expect(plankLabel(makePlank().data, 2, 'en')).toBe('Action 03')
  })

  it('uses the Spanish word and sub-topic on the Spanish page', () => {
    const plank = makePlank({
      kicker: 'Zoning',
      kicker_es: 'Zonificación',
    }).data
    expect(plankLabel(plank, 0, 'es')).toBe('Acción 01 · Zonificación')
  })

  it('pads single digits and stops padding at ten', () => {
    expect(plankLabel(makePlank().data, 8, 'en')).toBe('Action 09')
    expect(plankLabel(makePlank().data, 9, 'en')).toBe('Action 10')
  })
})

describe('timelineLabel', () => {
  it('reads as words rather than the stored slug', () => {
    expect(timelineLabel('day-one', 'en')).toBe('Day one')
  })

  it('translates the label on the Spanish page', () => {
    expect(timelineLabel('day-one', 'es')).toBe('Primer día')
  })

  // A timeline added to the schema without a proper label would surface on
  // the page as a raw slug again, which is exactly the bug this replaces.
  it.each(TIMELINES)('gives %s a real label in both languages', timeline => {
    for (const lang of ['en', 'es'] as const) {
      const label = timelineLabel(timeline, lang)
      expect(label).not.toBe(timeline)
      expect(label).not.toMatch(/^[a-z]+(-[a-z]+)+$/)
    }
  })
})

describe('actionCount', () => {
  it('counts the actions in words, not just digits', () => {
    expect(actionCount(3, 'en')).toBe('3 actions')
  })

  it('drops the plural for a single action', () => {
    expect(actionCount(1, 'en')).toBe('1 action')
  })

  it('translates the count on the Spanish page', () => {
    expect(actionCount(3, 'es')).toBe('3 acciones')
    expect(actionCount(1, 'es')).toBe('1 acción')
  })
})

describe('platformSummary', () => {
  it('states how many actions span how many issues', () => {
    expect(platformSummary(4, 6, 'en')).toBe('4 actions across 6 issues')
  })

  it('translates the summary on the Spanish page', () => {
    expect(platformSummary(4, 6, 'es')).toBe('4 acciones en 6 temas')
  })

  it('reads as singular when there is one of each', () => {
    expect(platformSummary(1, 1, 'en')).toBe('1 action across 1 issue')
    expect(platformSummary(1, 1, 'es')).toBe('1 acción en 1 tema')
  })

  // Each half has to pluralize off its own count. Matched counts alone can't
  // catch a summary that pluralizes "issues" from the promise total.
  it('pluralizes each half independently', () => {
    expect(platformSummary(1, 6, 'en')).toBe('1 action across 6 issues')
    expect(platformSummary(6, 1, 'en')).toBe('6 actions across 1 issue')
    expect(platformSummary(1, 6, 'es')).toBe('1 acción en 6 temas')
  })

  // The summary sits above the page's title as its eyebrow, so an empty
  // platform is better off with no eyebrow at all than with "0 actions".
  it('has nothing to say before the first action is published', () => {
    expect(platformSummary(0, 6, 'en')).toBeNull()
    expect(platformSummary(0, 0, 'es')).toBeNull()
  })
})

describe('ctaHeading', () => {
  it('asks whether the reader agrees, counting the actions', () => {
    expect(ctaHeading(3, 'en')).toBe('Agree with these 3?')
    expect(ctaHeading(3, 'es')).toBe('¿De acuerdo con estas 3?')
  })

  it('drops the count for a guide with one action', () => {
    expect(ctaHeading(1, 'en')).toBe('Agree with this?')
    expect(ctaHeading(1, 'es')).toBe('¿De acuerdo con esto?')
  })

  // A guide whose actions are still being written used to ask "Agree with
  // these 0?", which reads as a bug. The ask changes rather than disappearing:
  // hiding the section took the donate, volunteer and share buttons with it.
  it('asks something answerable when there are no actions yet', () => {
    expect(ctaHeading(0, 'en')).toBe('Want this fixed too?')
    expect(ctaHeading(0, 'es')).toBe('¿Quieres que esto también se arregle?')
  })
})
