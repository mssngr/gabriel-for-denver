import type { BallotDates, Lang } from './ballot'

/**
 * The ballot guide's calendar: which phase the election is in, and what the
 * how-to-vote strip says in each. Kept apart from ballot.ts, and free of Zod,
 * because ballot-behavior.astro bundles it for the browser to correct the
 * phase a page was built in.
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

/** The official tools the steps link to (Q6), never a copy of their details. */
export const VOTING_LINKS = {
  register: 'https://www.govotecolorado.gov',
  ballotTrax: 'https://denver.ballottrax.net',
  dropBoxes: 'https://www.denvergov.org/Government/Elections/Where-to-Vote',
} as const

export type VoteStep = {
  title: string
  /** Inline markdown, with the dates already filled in. */
  body: string
  /** Changed since the earlier phase, so it's outlined to catch the eye. */
  changed: boolean
  /** No longer possible, so it's greyed out. */
  done: boolean
}

export type HowToVote = { banner: string | null; steps: VoteStep[] }

const step = (
  title: string,
  body: string,
  flags: Partial<Pick<VoteStep, 'changed' | 'done'>> = {},
): VoteStep => ({ title, body, changed: false, done: false, ...flags })

/**
 * The how-to-vote strip for one state, in one language. The wording lives
 * here with the phase logic rather than in the CMS, so a test can check that
 * each phase says the right thing on the right day.
 */
export function howToVote(
  state: VoteState,
  dates: BallotDates,
  lang: Lang,
): HowToVote {
  const mailBy = formatBallotDate(dates.mailByDate, lang)
  const registerBy = formatBallotDate(dates.registerOnlineByDate, lang)
  const election = formatBallotDate(dates.electionDate, lang)
  const { register, ballotTrax, dropBoxes } = VOTING_LINKS
  const registrationOpen = state.endsWith(':open')

  if (lang === 'es') {
    const registerStep = registrationOpen
      ? step(
          'Regístrate para votar',
          `En línea en [GoVoteColorado.gov](${register}) hasta el ${registerBy}. En persona hasta el día de las elecciones.`,
        )
      : step(
          'Regístrate para votar',
          `La inscripción en línea ya cerró. Regístrate y vota en persona en cualquier Centro de Votación hasta el ${election}.`,
          { done: true },
        )
    switch (state) {
      case 'early:open':
      case 'early:closed':
        return {
          banner: null,
          steps: [
            registerStep,
            step(
              'Recibe tu boleta',
              `Las boletas ya se enviaron. Rastrea la tuya en [BallotTrax](${ballotTrax}).`,
            ),
            step(
              'Entrégala',
              `Envíala por correo a más tardar el **${mailBy}**, o usa cualquier buzón de 24 horas. [Encuentra uno](${dropBoxes}).`,
            ),
          ],
        }
      case 'late:open':
      case 'late:closed':
        return {
          banner: null,
          steps: [
            registerStep,
            step(
              'Recibe tu boleta',
              `¿La perdiste o nunca te llegó? Cualquier Centro de Votación te puede dar una nueva. Rastrea la tuya en [BallotTrax](${ballotTrax}).`,
            ),
            step(
              'Ya es tarde para enviarla por correo',
              `No la envíes por correo ahora. Usa un **buzón de 24 horas** o un Centro de Votación antes de las 7 p. m. del ${election}. [Encuentra uno](${dropBoxes}).`,
              { changed: true },
            ),
          ],
        }
      case 'eday':
        return {
          banner:
            'Hoy es el día de las elecciones. Los buzones y los Centros de Votación cierran a las 7 p. m. ¿Estás en la fila antes de las 7? Todavía puedes votar.',
          steps: [
            step(
              'Regístrate y vota hoy',
              `Cualquier Centro de Votación puede registrarte y darte una boleta. [Encuentra uno](${dropBoxes}).`,
              { changed: true },
            ),
            step(
              '¿Tienes tu boleta?',
              `Déjala en cualquier buzón de 24 horas antes de las 7 p. m. [Encuentra uno](${dropBoxes}).`,
              { changed: true },
            ),
            step(
              'Confirma que se contó',
              `[BallotTrax](${ballotTrax}) te avisa por mensaje de texto cuando aceptan tu boleta.`,
            ),
          ],
        }
      case 'over':
        return {
          banner: `La elección del ${election} ya terminó. Gracias por votar. Esta guía se queda publicada como registro.`,
          steps: [],
        }
    }
  }

  const registerStep = registrationOpen
    ? step(
        'Register to vote',
        `Online at [GoVoteColorado.gov](${register}) through ${registerBy}. In person through Election Day.`,
      )
    : step(
        'Register to vote',
        `Online registration has closed. Register and vote in person at any Vote Center through ${election}.`,
        { done: true },
      )
  switch (state) {
    case 'early:open':
    case 'early:closed':
      return {
        banner: null,
        steps: [
          registerStep,
          step(
            'Get your ballot',
            `Ballots are in the mail. Track yours at [BallotTrax](${ballotTrax}).`,
          ),
          step(
            'Turn it in',
            `Mail it by **${mailBy}**, or use any 24-hour drop box. [Find one](${dropBoxes}).`,
          ),
        ],
      }
    case 'late:open':
    case 'late:closed':
      return {
        banner: null,
        steps: [
          registerStep,
          step(
            'Get your ballot',
            `Lost it or never got it? Any Vote Center can give you a new one. Track yours at [BallotTrax](${ballotTrax}).`,
          ),
          step(
            'Too late to mail',
            `Don’t mail it now. Use a **24-hour drop box** or a Vote Center by 7pm ${election}. [Find one](${dropBoxes}).`,
            { changed: true },
          ),
        ],
      }
    case 'eday':
      return {
        banner:
          'Today is Election Day. Drop boxes and Vote Centers close at 7pm. In line by 7? You can still vote.',
        steps: [
          step(
            'Register & vote today',
            `Any Vote Center can register you and hand you a ballot. [Find one](${dropBoxes}).`,
            { changed: true },
          ),
          step(
            'Have your ballot?',
            `Drop it in any 24-hour drop box before 7pm. [Find one](${dropBoxes}).`,
            { changed: true },
          ),
          step(
            'Check it counted',
            `[BallotTrax](${ballotTrax}) texts you when your ballot is accepted.`,
          ),
        ],
      }
    case 'over':
      return {
        banner: `The ${election} election is over. Thank you for voting. This guide stays up as a record.`,
        steps: [],
      }
  }
}
