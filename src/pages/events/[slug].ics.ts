import { getCollection } from 'astro:content'
import type { APIRoute, GetStaticPaths } from 'astro'
import { eventSlug, toIcs } from '../../lib/calendar'

export const getStaticPaths: GetStaticPaths = async () => {
  const events = await getCollection('events')
  return events.map(event => ({
    params: { slug: eventSlug(event.id) },
    props: { event: event.data, uid: eventSlug(event.id) },
  }))
}

export const GET: APIRoute = ({ props }) => {
  const { event, uid } = props as {
    event: Parameters<typeof toIcs>[0]
    uid: string
  }
  return new Response(toIcs(event, `${uid}@gabrielfordenver.com`), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  })
}
