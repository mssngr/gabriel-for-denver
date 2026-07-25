import { getCollection } from 'astro:content'

const TIME_ZONE = 'America/Denver'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIME_ZONE,
})

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
})

const clockFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIME_ZONE,
})

/** Formats an event's start time in Denver time, e.g. "8/8/26, 5:00pm" */
export function formatEventTime(startTime: Date) {
  return lowercaseMeridiem(timeFormatter.format(startTime))
}

/**
 * Formats an event's span in Denver time, e.g. "8/8/26, 5:00pm – 8:00pm". Only
 * the start is shown when there's no end time; the date is repeated when the
 * event runs past midnight.
 */
export function formatEventTimeRange(startTime: Date, endTime?: Date) {
  const start = formatEventTime(startTime)
  if (!endTime) return start
  const sameDay =
    dateFormatter.format(startTime) === dateFormatter.format(endTime)
  const end = sameDay
    ? lowercaseMeridiem(clockFormatter.format(endTime))
    : formatEventTime(endTime)
  return `${start} – ${end}`
}

const lowercaseMeridiem = (formatted: string) =>
  formatted.replace(/\s(AM|PM)$/, (_, meridiem: string) =>
    meridiem.toLowerCase(),
  )

/**
 * When an event should stop being listed: midnight Denver time following the
 * day it starts on, so an event doesn't disappear while it's underway.
 */
export function listedUntil(startTime: Date) {
  const [year, month, day] = dateFormatter
    .format(startTime)
    .split('-')
    .map(Number)
  // Denver's UTC offset on the following day, read at UTC noon so the lookup
  // always lands inside that calendar day (DST flips at 2am local).
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 12))
  const offset = denverOffset(nextDay)
  const [nextYear, nextMonth, nextDate] = dateFormatter
    .format(nextDay)
    .split('-')
  return new Date(`${nextYear}-${nextMonth}-${nextDate}T00:00:00${offset}`)
}

/**
 * Events that haven't finished yet, soonest first. Past events are dropped at
 * build time and can never come back, so the pages only need client-side JS to
 * hide events that pass after the build. See `listedUntil`.
 */
export async function getUpcomingEvents() {
  const now = new Date()
  const events = await getCollection('events')
  return events
    .filter(event => listedUntil(event.data.startTime) > now)
    .sort((a, b) => a.data.startTime.getTime() - b.data.startTime.getTime())
}

/** A Google Maps search link for a venue, e.g. its name plus street address. */
export function mapsUrl(...parts: (string | undefined)[]) {
  const query = encodeURIComponent(parts.filter(Boolean).join(', '))
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

/** Denver's UTC offset at `date`, formatted for a date string, e.g. "-06:00" */
function denverOffset(date: Date) {
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value
  return offset?.replace('GMT', '') || 'Z'
}
