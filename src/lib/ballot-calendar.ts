import type { BallotDates, Lang } from './ballot'

/**
 * The ballot guide's calendar: which phase the election is in, and how its
 * dates read. Kept apart from ballot.ts, and free of Zod, because
 * ballot-behavior.astro bundles it for the browser to correct the phase a page
 * was built in. What each state says is in ballot-steps.ts.
 *
 * The page is built once a day at most, so it renders every state below and
 * the browser shows the one that's true now.
 */

export type BallotPhase = 'early' | 'late' | 'eday' | 'over'

/** Polls and drop boxes close at 7:00pm Denver time on Election Day. */
const POLLS_CLOSE_MINUTES = 19 * 60

const DENVER_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * What a Denver wall clock reads at `now`: the day as `YYYY-MM-DD` and the
 * minutes since midnight. Comparing days as strings sidesteps converting a
 * stored date to an instant, which is where a DST change would bite.
 */
function denverClock(now: Date): { day: string; minutes: number } {
  const parts: Record<string, string> = {}
  for (const part of DENVER_CLOCK.formatToParts(now)) {
    parts[part.type] = part.value
  }
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** A stored date's calendar day. It's midnight UTC, so UTC is its own day. */
function calendarDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Where the election is at `now`: before the mail-by cutoff, after it,
 * Election Day until polls close, then over. The mail-by date is the last day
 * mailing is still advised, so "late" starts at the next Denver midnight.
 */
export function ballotPhase(now: Date, dates: BallotDates): BallotPhase {
  const { day, minutes } = denverClock(now)
  if (day <= calendarDay(dates.mailByDate)) return 'early'
  const election = calendarDay(dates.electionDate)
  if (day < election) return 'late'
  if (day === election && minutes < POLLS_CLOSE_MINUTES) return 'eday'
  return 'over'
}

/** Whether GoVoteColorado still takes registrations in time to mail a ballot. */
export function onlineRegistrationOpen(now: Date, dates: BallotDates): boolean {
  return denverClock(now).day <= calendarDay(dates.registerOnlineByDate)
}

/**
 * Every how-to-vote state the page can be in. Before Election Day the phase
 * and online registration move independently: Oct 25–26 are past the mail
 * cutoff with registration still open.
 */
export const VOTE_STATES = [
  'early:open',
  'early:closed',
  'late:open',
  'late:closed',
  'eday',
  'over',
] as const
export type VoteState = (typeof VOTE_STATES)[number]

export function voteState(now: Date, dates: BallotDates): VoteState {
  const phase = ballotPhase(now, dates)
  if (phase === 'eday' || phase === 'over') return phase
  return `${phase}:${onlineRegistrationOpen(now, dates) ? 'open' : 'closed'}`
}

const MONTHS: Record<Lang, readonly string[]> = {
  en: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
}

const WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ],
}

/**
 * A stored date as a reader sees it: "Oct 24" or "24 de octubre". Read in
 * UTC, which is the stored date's own day; Denver time would print the day
 * before. Month names are spelled out here rather than left to `Intl`, whose
 * Spanish abbreviations differ between runtimes.
 */
export function formatBallotDate(date: Date, lang: Lang): string {
  const month = MONTHS[lang][date.getUTCMonth()]
  const day = date.getUTCDate()
  return lang === 'es' ? `${day} de ${month}` : `${month} ${day}`
}

/** The hero's Election Day pill: "Tue, Nov 3" or "martes 3 de noviembre". */
export function electionDayLabel(date: Date, lang: Lang): string {
  const weekday = WEEKDAYS[lang][date.getUTCDay()]
  const formatted = formatBallotDate(date, lang)
  return lang === 'es' ? `${weekday} ${formatted}` : `${weekday}, ${formatted}`
}
