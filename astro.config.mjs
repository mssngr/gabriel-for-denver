// @ts-check
import { appendFile } from 'node:fs/promises'
import netlify from '@astrojs/netlify'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'
import { shouldNoindex } from './src/lib/deploy-context'
import { issueRedirects } from './src/lib/redirects'
import { includeInSitemap, readDraftGuideSlugs } from './src/lib/sitemap'

// Read once at config time: `astro:content` isn't available here, and the
// filter below runs per page.
const draftGuideSlugs = readDraftGuideSlugs()

// Keeps the `content` branch deploy out of search results; `shouldNoindex`
// carries the reasoning and the cases. CONTEXT is set by Netlify on every build.
const noindexNonProduction = () => ({
  name: 'noindex-non-production',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const context = process.env.CONTEXT
      if (!shouldNoindex(context)) return
      await appendFile(
        new URL('_headers', dir),
        '/*\n  X-Robots-Tag: noindex\n',
      )
      logger.info(`noindex _headers rule added for CONTEXT=${context}`)
    },
  },
})

// https://astro.build/config
export default defineConfig({
  site: 'https://gabrielfordenver.com',
  integrations: [
    sitemap({ filter: page => includeInSitemap(page, draftGuideSlugs) }),
    noindexNonProduction(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Vite's defaults plus .astro, so a folder with an index.astro can be
      // imported by its bare path (e.g. `components/donation-form`)
      extensions: [
        '.mjs',
        '.js',
        '.mts',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.astro',
      ],
    },
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'League Spartan',
      cssVariable: '--font-league-spartan',
      weights: ['300', '400', '500', '600', '700'],
    },
    {
      provider: fontProviders.google(),
      name: 'Edu SA Hand',
      cssVariable: '--font-edu-sa-hand',
    },
  ],
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'en',
  },
  redirects: {
    // The platform replaced /issues. These take priority over the pages that
    // still build from src/pages/issues/, which PR 4 removes.
    ...issueRedirects(),
    '/get-involved/donate': '/donate',
    '/get-involved/donate/thank-you': '/donate/thank-you',
    '/es/get-involved/donate': '/es/donate',
    '/es/get-involved/donate/thank-you': '/es/donate/thank-you',
  },
  adapter: netlify(),
})
