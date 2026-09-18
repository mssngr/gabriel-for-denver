## Commands

Always `bun run <script>`, never `bun <script>`. `bun test` and `bun build` are
Bun's own built-in test runner and bundler; they shadow the package scripts of
the same name and silently do something else. `bun test` in particular reports
failures in tests that pass under Vitest, which is a confusing way to lose
twenty minutes.

| Command | Action |
| :------ | :----- |
| `bun run test` | Run the suite once |
| `bun run build` | Astro build — run it before opening a PR; it catches content-schema errors nothing else does |
| `bun run lint` | Biome. Currently exits non-zero on pre-existing SVG accessibility errors — check your own files are clean rather than the exit code |
| `bun run format` | Biome, plus Prettier for `.astro`. Scope it to the files you touched; running it bare reformats the repo |

There is no working `preview`: the script exists but the Netlify adapter refuses
the command.

## CI

The suite itself lives in `.github/actions/suite` — `bun run test` then
`bun run build` — so that everything which needs to ask "does this tree pass?"
asks it the same way.

`.github/workflows/test.yml` runs it on every PR into `main` and every push to
`content`. Its job is named **test**, and that is a **required status check on
`main`**. That name is load-bearing, and it fails *closed*: rename the job
without updating the ruleset and every push to `main` is rejected for a check
that can never report — the daily publish included. It does not quietly stop
protecting the branch, it stops the branch working.

Requiring it has three consequences worth knowing before you push:

- **`main` no longer accepts a direct push** unless that exact commit already
  has a passing `test` status. Ordinary code changes go through a PR.
- **`content` pushes are checked for this reason.** publish-content.yml
  fast-forwards `main` to a `content` commit, and GitHub lets a direct push
  through only when the commit being pushed already carries a passing check.
  Drop that trigger and the daily publish stops working.
- **sync-content.yml runs the suite itself and reports the result.** GitHub
  starts no workflow run for a push made with `GITHUB_TOKEN`, so the merge
  commits that workflow creates are invisible to `test.yml` — and a commit
  with no `test` status can never be fast-forwarded onto `main`. Nothing would
  ever come along to check it later, so that would stall publishing for good
  rather than briefly. It posts the status through the statuses API, which
  satisfies the same required check a check run does.

The side benefit is that a CMS entry failing its Zod schema now fails CI on
`content` at save time, rather than only surfacing as a stalled publish.

## Development

`astro` isn't on `PATH`, so run it through Bun. When starting the dev server, use background mode:

```
bunx astro dev --background
```

Manage the background server with `bunx astro dev stop`, `bunx astro dev status`, and `bunx astro dev logs`.

## Tests

Vitest, `src/**/*.test.ts`, node environment. **There is no way to test an
`.astro` component**, so logic that needs coverage gets extracted into a plain
`src/lib/*.ts` module first and the component stays a thin template. A module
that imports `astro:content` cannot be unit tested at all — that virtual module
doesn't resolve outside the Astro build, which is why `src/lib/events.ts` has no
tests. Keep pure logic in files free of that import and let the pages do the
loading.

Match the existing style rather than inventing one — read `src/lib/fees.test.ts`
and `src/lib/instagram.test.ts` first:

- Flat `describe` blocks, never nested. Name them for the function under test,
  or for the behaviour when a group spans several.
- `it` titles are lowercase third-person sentences naming a concrete outcome —
  `it('grosses up a $50 contribution to $51.81')`. Never "should".
- Comment *why* a case matters, especially boundaries and regressions. Test
  every limit on both sides of the line.
- Build test data with a plain function taking `Partial<T>` overrides. Prefer
  dependency injection over `vi.mock` where the source allows it.

## Content and the CMS

The Deploys section below is the constraint that matters most here: a schema
that can reject an editor's entry is a schema that can stop the whole site from
building, and because saves are batched, a bad entry can sit unnoticed until the
daily publish fails. So:

- **Prefer permissive Zod schemas.** Validate at the point of entry instead —
  Sveltia's `select`, `pattern` and `required` options catch a bad value in the
  editor, where the person who typed it can fix it. Reserve build-time
  assertions for cross-entry invariants a form genuinely cannot check.
- **`src/content.config.ts` and `public/admin/config.yml` ship together.** A
  schema change without the matching CMS change produces content nobody can
  edit; a CMS change without the schema change produces a saved entry that
  breaks the build. Every optional Zod field needs `required: false` in the CMS,
  or it becomes mandatory in the form.
- Content is YAML with markdown inside string fields, parsed at render with
  `marked.parse()`. `slug` is always an explicit field, not derived from the
  filename.

## Spanish

Every translatable field is duplicated with an `_es` suffix in the same file.
There is no dictionary and no locale routing; `src/pages/es/` is a hand-written
mirror. Components that differ only in hardcoded strings ship as an
`index.astro`/`es.astro` pair.

That duplication has already caused real drift — the Spanish issue page is
missing its analytics entirely, and its index anchor is `#retos` while every
back-link points at `#what-will-i-tackle`. **For new components, take a `lang`
prop instead of writing a second file.** When you do touch an existing pair,
change both halves.

Analytics follow one shape: `window.posthog?.capture()`, always optional-chained,
always in an `is:inline` script, snake_case event and property names, and a
matching entry added to `.posthog-events.json`. That file is hand-maintained and
its `file` paths are already stale in places; don't trust them as a map.

(`src/components/platform/sheet-behavior.astro` is a deliberate exception to
the `is:inline` rule: it needs to import from `src/lib/sheet.ts` so that logic
is covered by unit tests, which an inline script can't do.)

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Deploys

The site is hosted on Netlify and deploys from `main`. Netlify bills **15 credits
per production deploy** and meters no build minutes, so the cost of a deploy is
the deploy itself — moving the build elsewhere would save nothing, and the only
lever that matters is deploying less often.

So CMS saves are batched rather than published one at a time. Sveltia
(`public/admin/config.yml`) commits to **`content`**, not `main`:

- `content` gets a Netlify **branch deploy**, which costs 0 credits. That is the
  preview URL for proofreading an edit immediately after saving it.
- `.github/workflows/publish-content.yml` fast-forwards `main` to `content` once
  a day (12:17 UTC), turning a day of saves into one paid production deploy. It
  also has a **Run workflow** button for publishing sooner. It will not publish
  a commit whose tests have not passed — see CI above.
- `.github/workflows/sync-content.yml` brings `content` up to date whenever code
  lands on `main`, so the preview reflects current code and `main` stays an
  ancestor of `content` — which is what keeps publishing a fast-forward rather
  than a merge into production.

There is still no editorial workflow and no pull request between an editor and
production; the gap is now time, not review.

Content is validated by Zod schemas in `src/content.config.ts`. A single entry that
fails validation fails the *whole build*, not just its own page, so the site silently
stops updating until it is fixed. Batching makes catching this *earlier* cheaper and
*later* more costly: the `content` branch deploy fails as soon as the bad entry is
saved, but if nobody looks, the daily publish is what stalls.

The signal for that is Netlify's **Deploy failed** notification, which emails whoever
is configured under Site configuration → Notifications → Deploy notifications. That
is a dashboard setting rather than code, so nothing in this repo enforces it or can
tell you whether it is on — confirm it is before relying on it, because an
unannounced failed build is otherwise completely silent. Note it must cover branch
deploys, not just production, or a broken `content` build is invisible until publish.

If content changes stop appearing on the live site, check whether the daily
**Publish content** workflow ran, then the Netlify deploy log.
