# Astro Starter Kit: Basics

```sh
bun create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

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
