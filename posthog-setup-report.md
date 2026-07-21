# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Gabriel for Denver campaign site. A reusable `posthog.astro` component was created and wired into both the English (`default.astro`) and Spanish (`espanol.astro`) layouts so every page on the site is covered. Six events across six files track the core campaign conversion funnel (contact form submission → completion), issue page engagement, language switching, and issue card click-throughs.

| Event | Description | File |
|---|---|---|
| `contact_form_submitted` | User submits the Get Involved contact form on the home page | `src/pages/index.astro` |
| `contact_form_completed` | Thank-you page loads after a successful form submission | `src/pages/thank-you.astro` |
| `issue_viewed` | User views an individual issue detail page (with `issue_slug`, `issue_title` properties) | `src/pages/issues/[id].astro` |
| `language_switched` | User clicks Español in the English header (`to: 'es'`) | `src/components/header.astro` |
| `language_switched` | User clicks English in the Spanish header (`to: 'en'`) | `src/components/header-es.astro` |
| `issue_read_more_clicked` | User clicks Read More on an issue card (with `issue_slug`, `issue_title` properties) | `src/components/what-will-i-tackle.astro` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://us.posthog.com/project/522267/dashboard/1882608)
- [Contact form conversion funnel (wizard)](https://us.posthog.com/project/522267/insights/GgOw9QIu)
- [Contact form completions over time (wizard)](https://us.posthog.com/project/522267/insights/QbDT9m20)
- [Issues viewed by topic (wizard)](https://us.posthog.com/project/522267/insights/QeD2AXiW)
- [Language switches over time (wizard)](https://us.posthog.com/project/522267/insights/RhJ3DB62)
- [Issue Read More clicks by topic (wizard)](https://us.posthog.com/project/522267/insights/Ja7sPy65)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` to `.env.example` and any onboarding/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
