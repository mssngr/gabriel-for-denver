import { marked } from 'marked'

/** Events have no required end time, so exports assume they run this long. */
const DEFAULT_DURATION_HOURS = 2

export interface CalendarEvent {
  title: string
  description: string
  location: string
  address?: string
  startTime: Date
  endTime?: Date
}

/** An event's end time, falling back to a fixed duration when none is set. */
export function eventEndTime({ startTime, endTime }: CalendarEvent) {
  if (endTime) return endTime
  return new Date(startTime.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000)
}

/** A "add to Google Calendar" link with the event prefilled. */
export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcStamp(event.startTime)}/${utcStamp(eventEndTime(event))}`,
    details: plainText(event.description),
    location: venue(event),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** An RFC 5545 calendar file, for Apple Calendar, Outlook and friends. */
export function toIcs(event: CalendarEvent, uid: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gabriel for Denver//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(event.startTime)}`,
    `DTEND:${utcStamp(eventEndTime(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(plainText(event.description))}`,
    `LOCATION:${escapeText(venue(event))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // RFC 5545 wants CRLF endings and lines folded at 75 octets.
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** Turns a content-collection id into a URL-safe slug, e.g. for /events/*.ics */
export function eventSlug(id: string) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const venue = ({ location, address }: CalendarEvent) =>
  [location, address].filter(Boolean).join(', ')

/** A UTC timestamp in the basic ISO format calendars expect, e.g. 20260808T230000Z */
const utcStamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '')

/** Markdown rendered down to the plain text a calendar entry can display. */
function plainText(markdown: string) {
  const html = marked.parse(markdown, { async: false })
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, match => {
      const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
      }
      return entities[match] ?? match
    })
    .replace(/\s+/g, ' ')
    .trim()
}

const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/[;,]/g, match => `\\${match}`)
    .replace(/\r?\n/g, '\\n')

/**
 * Folds a long line onto continuation lines, which must start with a space.
 * Measured in octets per RFC 5545, and split on whole code points so accents
 * and emoji survive the fold.
 */
function fold(line: string) {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > 75) {
      parts.push(current)
      current = ' '
      octets = 1
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join('\r\n')
}
