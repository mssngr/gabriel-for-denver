// SPIKE (S1): not for merging; PR 3 rebuilds this with tests.
import type { APIRoute } from 'astro'
import { renderSpike } from '../../../lib/og-spike'

export const GET: APIRoute = async () => {
  const { png, satoriMs, resvgMs } = await renderSpike('en')
  console.log(
    `[og-spike] 2k: satori ${satoriMs.toFixed(0)}ms, resvg ${resvgMs.toFixed(0)}ms, ${png.length} bytes, ${process.platform}-${process.arch}, node ${process.version}`,
  )
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  })
}
