import { describe, expect, it } from 'vitest'
import type { BallotDates } from './ballot'
import { VOTE_STATES } from './ballot-calendar'
import { howToVote } from './ballot-steps'

// The real 2026 calendar: mail by Sat Oct 24, register online by Mon Oct 26,
// Election Day Tue Nov 3. The content collection hands these over the way
// `z.coerce.date()` parses a bare YAML date — midnight UTC.
const DATES: BallotDates = {
  mailByDate: new Date('2026-10-24T00:00:00Z'),
  registerOnlineByDate: new Date('2026-10-26T00:00:00Z'),
  electionDate: new Date('2026-11-03T00:00:00Z'),
}

describe('howToVote', () => {
  it('tells people to mail by the mail-by date before the cutoff', () => {
    const { banner, steps } = howToVote('early:open', DATES, 'en')
    expect(banner).toBeNull()
    expect(steps.map(step => step.title)).toEqual([
      'Register to vote',
      'Get your ballot',
      'Turn it in',
    ])
    expect(steps[0].body).toContain('through Oct 26')
    expect(steps[2].body).toContain('Mail it by **Oct 24**')
  })

  it('flips the last step to a drop box once it is too late to mail', () => {
    const { steps } = howToVote('late:open', DATES, 'en')
    expect(steps[2]).toMatchObject({ title: 'Too late to mail', changed: true })
    expect(steps[2].body).toContain('by 7pm Nov 3')
    expect(steps[0].done).toBe(false)
  })

  it('marks online registration done once it has closed', () => {
    const { steps } = howToVote('late:closed', DATES, 'en')
    expect(steps[0].done).toBe(true)
    expect(steps[0].body).toContain('Online registration has closed')
  })

  it('leads with a banner on Election Day', () => {
    const { banner, steps } = howToVote('eday', DATES, 'en')
    expect(banner).toContain('Today is Election Day')
    expect(steps).toHaveLength(3)
  })

  it('drops the steps once the election is over', () => {
    const { banner, steps } = howToVote('over', DATES, 'en')
    expect(banner).toBe(
      'The Nov 3 election is over. Thank you for voting. This guide stays up as a record.',
    )
    expect(steps).toEqual([])
  })

  it('fills the dates in Spanish', () => {
    const { steps } = howToVote('early:open', DATES, 'es')
    expect(steps[0].body).toContain('hasta el 26 de octubre')
    expect(steps[2].body).toContain('**24 de octubre**')
  })

  it('says it is too late to mail in Spanish, with the 7pm deadline', () => {
    const { steps } = howToVote('late:open', DATES, 'es')
    expect(steps[2]).toMatchObject({
      title: 'Ya es tarde para enviarla por correo',
      changed: true,
    })
    expect(steps[2].body).toContain('antes de las 7 p. m. del 3 de noviembre')
  })

  it('marks Spanish online registration done once it has closed', () => {
    const { steps } = howToVote('late:closed', DATES, 'es')
    expect(steps[0].done).toBe(true)
    expect(steps[0].body).toContain('La inscripción en línea ya cerró')
    expect(steps[0].body).toContain('hasta el 3 de noviembre')
  })

  it('leads with the Spanish Election Day banner', () => {
    const { banner, steps } = howToVote('eday', DATES, 'es')
    expect(banner).toContain('Hoy es el día de las elecciones')
    expect(steps.map(step => step.title)).toEqual([
      'Regístrate y vota hoy',
      '¿Tienes tu boleta?',
      'Confirma que se contó',
    ])
  })

  it('drops the Spanish steps once the election is over', () => {
    const { banner, steps } = howToVote('over', DATES, 'es')
    expect(banner).toBe(
      'La elección del 3 de noviembre ya terminó. Gracias por votar. Esta guía se queda publicada como registro.',
    )
    expect(steps).toEqual([])
  })

  // The two languages share one decision about which steps show when, so
  // their shapes can't drift even though their wording is separate.
  it('gives both languages the same steps and flags in every state', () => {
    const shape = (lang: 'en' | 'es') =>
      VOTE_STATES.map(state => {
        const { banner, steps } = howToVote(state, DATES, lang)
        return {
          banner: banner !== null,
          steps: steps.map(({ changed, done }) => ({ changed, done })),
        }
      })
    expect(shape('es')).toEqual(shape('en'))
  })

  // Q6: the state's site is .gov; the deck linked a .com.
  it('links GoVoteColorado on its .gov domain', () => {
    const { steps } = howToVote('early:open', DATES, 'en')
    expect(steps[0].body).toContain('https://www.govotecolorado.gov')
    expect(steps[0].body).not.toContain('.com')
  })
})
