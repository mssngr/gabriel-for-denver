import type { BallotDates, Lang } from './ballot'
import { formatBallotDate, type VoteState } from './ballot-calendar'

/**
 * What the how-to-vote strip says in each state of the calendar, in both
 * languages. The phase logic itself is in ballot-calendar.ts, which the
 * browser bundles; this wording is only needed at build time.
 */

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

type StepWording = { title: string; body: string }

/** Every sentence the strip can show, in one language. */
type CalendarWording = {
  registerOpen: StepWording
  registerClosed: StepWording
  getBallot: StepWording
  turnIn: StepWording
  replaceBallot: StepWording
  tooLateToMail: StepWording
  registerToday: StepWording
  dropItOff: StepWording
  checkCounted: StepWording
  electionDayBanner: string
  overBanner: string
}

/** The dates and links each language's wording is filled in with. */
type Fill = { mailBy: string; registerBy: string; election: string }

// One table per language, so the two can't disagree about which sentences
// exist; `howToVote` below decides once, for both, which show when.
const WORDING: Record<Lang, (fill: Fill) => CalendarWording> = {
  en: ({ mailBy, registerBy, election }) => {
    const { register, ballotTrax, dropBoxes } = VOTING_LINKS
    return {
      registerOpen: {
        title: 'Register to vote',
        body: `Online at [GoVoteColorado.gov](${register}) through ${registerBy}. In person through Election Day.`,
      },
      registerClosed: {
        title: 'Register to vote',
        body: `Online registration has closed. Register and vote in person at any Vote Center through ${election}.`,
      },
      getBallot: {
        title: 'Get your ballot',
        body: `Ballots are in the mail. Track yours at [BallotTrax](${ballotTrax}).`,
      },
      turnIn: {
        title: 'Turn it in',
        body: `Mail it by **${mailBy}**, or use any 24-hour drop box. [Find one](${dropBoxes}).`,
      },
      replaceBallot: {
        title: 'Get your ballot',
        body: `Lost it or never got it? Any Vote Center can give you a new one. Track yours at [BallotTrax](${ballotTrax}).`,
      },
      tooLateToMail: {
        title: 'Too late to mail',
        body: `Don’t mail it now. Use a **24-hour drop box** or a Vote Center by 7pm ${election}. [Find one](${dropBoxes}).`,
      },
      registerToday: {
        title: 'Register & vote today',
        body: `Any Vote Center can register you and hand you a ballot. [Find one](${dropBoxes}).`,
      },
      dropItOff: {
        title: 'Have your ballot?',
        body: `Drop it in any 24-hour drop box before 7pm. [Find one](${dropBoxes}).`,
      },
      checkCounted: {
        title: 'Check it counted',
        body: `[BallotTrax](${ballotTrax}) texts you when your ballot is accepted.`,
      },
      electionDayBanner:
        'Today is Election Day. Drop boxes and Vote Centers close at 7pm. In line by 7? You can still vote.',
      overBanner: `The ${election} election is over. Thank you for voting. This guide stays up as a record.`,
    }
  },
  es: ({ mailBy, registerBy, election }) => {
    const { register, ballotTrax, dropBoxes } = VOTING_LINKS
    return {
      registerOpen: {
        title: 'Regístrate para votar',
        body: `En línea en [GoVoteColorado.gov](${register}) hasta el ${registerBy}. En persona hasta el día de las elecciones.`,
      },
      registerClosed: {
        title: 'Regístrate para votar',
        body: `La inscripción en línea ya cerró. Regístrate y vota en persona en cualquier Centro de Votación hasta el ${election}.`,
      },
      getBallot: {
        title: 'Recibe tu boleta',
        body: `Las boletas ya se enviaron. Rastrea la tuya en [BallotTrax](${ballotTrax}).`,
      },
      turnIn: {
        title: 'Entrégala',
        body: `Envíala por correo a más tardar el **${mailBy}**, o usa cualquier buzón de 24 horas. [Encuentra uno](${dropBoxes}).`,
      },
      replaceBallot: {
        title: 'Recibe tu boleta',
        body: `¿La perdiste o nunca te llegó? Cualquier Centro de Votación te puede dar una nueva. Rastrea la tuya en [BallotTrax](${ballotTrax}).`,
      },
      tooLateToMail: {
        title: 'Ya es tarde para enviarla por correo',
        body: `No la envíes por correo ahora. Usa un **buzón de 24 horas** o un Centro de Votación antes de las 7 p. m. del ${election}. [Encuentra uno](${dropBoxes}).`,
      },
      registerToday: {
        title: 'Regístrate y vota hoy',
        body: `Cualquier Centro de Votación puede registrarte y darte una boleta. [Encuentra uno](${dropBoxes}).`,
      },
      dropItOff: {
        title: '¿Tienes tu boleta?',
        body: `Déjala en cualquier buzón de 24 horas antes de las 7 p. m. [Encuentra uno](${dropBoxes}).`,
      },
      checkCounted: {
        title: 'Confirma que se contó',
        body: `[BallotTrax](${ballotTrax}) te avisa por mensaje de texto cuando aceptan tu boleta.`,
      },
      electionDayBanner:
        'Hoy es el día de las elecciones. Los buzones y los Centros de Votación cierran a las 7 p. m. ¿Estás en la fila antes de las 7? Todavía puedes votar.',
      overBanner: `La elección del ${election} ya terminó. Gracias por votar. Esta guía se queda publicada como registro.`,
    }
  },
}

const step = (
  wording: StepWording,
  flags: Partial<Pick<VoteStep, 'changed' | 'done'>> = {},
): VoteStep => ({ ...wording, changed: false, done: false, ...flags })

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
  const wording = WORDING[lang]({
    mailBy: formatBallotDate(dates.mailByDate, lang),
    registerBy: formatBallotDate(dates.registerOnlineByDate, lang),
    election: formatBallotDate(dates.electionDate, lang),
  })
  const register = state.endsWith(':open')
    ? step(wording.registerOpen)
    : step(wording.registerClosed, { done: true })

  switch (state) {
    case 'early:open':
    case 'early:closed':
      return {
        banner: null,
        steps: [register, step(wording.getBallot), step(wording.turnIn)],
      }
    case 'late:open':
    case 'late:closed':
      return {
        banner: null,
        steps: [
          register,
          step(wording.replaceBallot),
          step(wording.tooLateToMail, { changed: true }),
        ],
      }
    case 'eday':
      return {
        banner: wording.electionDayBanner,
        steps: [
          step(wording.registerToday, { changed: true }),
          step(wording.dropItOff, { changed: true }),
          step(wording.checkCounted),
        ],
      }
    case 'over':
      return { banner: wording.overBanner, steps: [] }
  }
}
