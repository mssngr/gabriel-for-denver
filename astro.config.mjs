// @ts-check
import netlify from '@astrojs/netlify'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://gabrielfordenver.com',
  integrations: [
    sitemap({
      filter: page => {
        const { pathname } = new URL(page)
        return (
          !/\/(admin|thank-you|404)\/?$/.test(pathname) &&
          !/(^|\/)posts(\/|$)/.test(pathname)
        )
      },
    }),
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
    '/get-involved/donate': '/donate',
    '/get-involved/donate/thank-you': '/donate/thank-you',
    '/es/get-involved/donate': '/es/donate',
    '/es/get-involved/donate/thank-you': '/es/donate/thank-you',
  },
  adapter: netlify(),
})
