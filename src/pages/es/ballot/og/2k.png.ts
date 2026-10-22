// SPIKE (S1): the Spanish image, to check accented glyphs render.
import type { APIRoute } from 'astro'
import { renderSpike } from '../../../../lib/og-spike'

export const GET: APIRoute = async () => {
  const { png } = await renderSpike('es')
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  })
}
