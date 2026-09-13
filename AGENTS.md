## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

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

The site is hosted on Netlify and deploys from `main`.

Sveltia CMS (`public/admin/config.yml`) uses a GitHub backend on `backend.branch: main`
with no editorial workflow, so **every CMS save is a direct commit to `main` and a
production deploy** — there is no pull request between an editor and production.

Content is validated by Zod schemas in `src/content.config.ts`. A single entry that
fails validation fails the *whole build*, not just its own page, so the site silently
stops updating until it is fixed.

The signal for that is Netlify's **Deploy failed** notification (Site configuration →
Notifications → Deploy notifications), which emails gabriel@gabrielfordenver.com. If
content changes stop appearing on the live site, check the Netlify deploy log first.
