// SPIKE (S1): the Netlify deploy log isn't readable from outside the
// dashboard, so this records what the build saw where the preview can serve
// it: the runtime, which resvg binding loaded, and timings for a batch the
// size of PR 3's (25 items × 2 languages + 2 guide images = 52).
import { createRequire } from 'node:module'
import type { APIRoute } from 'astro'
import { renderSpike } from '../../../lib/og-spike'

export const GET: APIRoute = async () => {
  const require = createRequire(import.meta.url)
  const binding = (name: string) => {
    try {
      return require.resolve(name)
    } catch {
      return null
    }
  }
  const timings: number[] = []
  const t0 = performance.now()
  for (let i = 0; i < 52; i++) {
    const start = performance.now()
    await renderSpike(i % 2 ? 'es' : 'en')
    timings.push(Math.round(performance.now() - start))
  }
  const total = Math.round(performance.now() - t0)
  const report = {
    builtAt: new Date().toISOString(),
    netlify: process.env.NETLIFY ?? null,
    context: process.env.CONTEXT ?? null,
    buildId: process.env.BUILD_ID ?? null,
    node: process.version,
    bun: process.versions.bun ?? null,
    npmUserAgent: process.env.npm_config_user_agent ?? null,
    platform: `${process.platform}-${process.arch}`,
    glibc:
      (process.report?.getReport() as { header?: { glibcVersionRuntime?: string } })
        ?.header?.glibcVersionRuntime ?? null,
    cpus: (await import('node:os')).cpus().length,
    bindings: {
      gnu: binding('@resvg/resvg-js-linux-x64-gnu'),
      musl: binding('@resvg/resvg-js-linux-x64-musl'),
    },
    renders: timings.length,
    totalMs: total,
    firstMs: timings[0],
    medianMs: [...timings].sort((a, b) => a - b)[Math.floor(timings.length / 2)],
    maxMs: Math.max(...timings),
  }
  console.log('[og-spike] report', JSON.stringify(report))
  return new Response(JSON.stringify(report, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
}
