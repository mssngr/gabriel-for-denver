// @ts-check
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
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
})
