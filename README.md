# Gabriel for Denver

The campaign site for Gabriel Konkle, candidate for Denver City Council At-Large.
Built with Astro, deployed on Netlify, and edited through Sveltia CMS at `/admin`.

Conventions this repo expects — commands, test style, how content and the CMS fit
together — are in [AGENTS.md](AGENTS.md). Design proposals live in
[`docs/proposals/`](docs/proposals/).

## 🚀 Project Structure

```text
/
├── public/
│   └── admin/config.yml    Sveltia CMS configuration
├── src/
│   ├── assets/             images and issue illustrations, optimized by Astro
│   ├── components/         .astro components, many as index.astro + es.astro pairs
│   ├── content/            YAML content collections, one directory per collection
│   ├── layouts/            default.astro (English) and espanol.astro (Spanish)
│   ├── lib/                plain .ts modules — where testable logic lives
│   ├── pages/              routes; src/pages/es mirrors the English tree
│   ├── styles/global.css   Tailwind and the daisyUI theme
│   └── content.config.ts   Zod schema for every collection
├── docs/proposals/         design proposals, written as .html
├── astro.config.mjs
└── vitest.config.ts
```

Two things about this layout are worth knowing before you go looking for them.

**Spanish is not a routing feature.** There is no i18n dictionary and no locale
routing. Every translatable field is duplicated in its collection with an `_es`
suffix, and `src/pages/es/` is a hand-maintained mirror of the English route
tree. Components that differ only by their hardcoded strings ship as an
`index.astro`/`es.astro` pair in the same folder.

**`src/lib/` exists so there is something to test.** Vitest only picks up
`src/**/*.test.ts` and runs in a node environment, where `.astro` files and
Astro's virtual modules (`astro:content`) don't resolve. Logic that needs test
coverage is extracted into a plain `.ts` module first, which is why `fees.ts`,
`instagram.ts` and `seo.ts` exist as separate files rather than living inside
the components that use them.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command              | Action                                                  |
| :------------------- | :------------------------------------------------------ |
| `bun install`        | Install dependencies                                     |
| `bun run dev`        | Start the dev server at `localhost:4321`                 |
| `bun run build`      | Build the production site to `./dist/`                   |
| `bun run test`       | Run the test suite once                                  |
| `bun run test:watch` | Run the tests in watch mode                              |
| `bun run lint`       | Lint with Biome                                          |
| `bun run format`     | Format with Biome, plus Prettier for `.astro` files      |
| `bun astro ...`      | Run Astro CLI commands, e.g. `astro add`, `astro check`  |

> Use `bun run <script>`, not `bun <script>`. `bun test` and `bun build` are
> Bun's own built-in test runner and bundler — they shadow the package scripts
> of the same name and quietly do something else. `bun test` reports failures
> in tests that pass under Vitest; `bun build` just asks for an entrypoint.

There is no `preview` command worth documenting: `astro preview` exists as a
script, but the Netlify adapter doesn't support it. Preview a build on a
Netlify deploy preview instead.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
