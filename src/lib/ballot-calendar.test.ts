import { describe, expect, it } from 'vitest'
import type { BallotDates } from './ballot'
import {
  ballotPhase,
  electionDayLabel,
  formatBallotDate,
  howToVote,
  onlineRegistrationOpen,
  VOTE_STATES,
  voteState,
} from './ballot-calendar'

// The real 2026 calendar: mail by Sat Oct 24, register online by Mon Oct 26,
// Election Day Tue Nov 3. The content collection hands these over the way
// `z.coerce.date()` parses a bare YAML date — midnight UTC.
const DATES: BallotDates = {
  mailByDate: new Date('2026-10-24T00:00:00Z'),
  registerOnlineByDate: new Date('2026-10-26T00:00:00Z'),
  electionDate: new Date('2026-11-03T00:00:00Z'),
}

const at = (iso: string) => new Date(iso)

describe('ballotPhase', () => {
  // Denver is on MDT (UTC−6) for the mail cutoff, so its midnight at the end
  // of Oct 24 is 06:00 UTC on the 25th.
  it('stays early through the last minute of the mail-by date in Denver', () => {
    expect(ballotPhase(at('2026-10-25T05:59:00Z'), DATES)).toBe('early')
  })

  it('turns late at the first Denver minute after the mail-by date', () => {
    expect(ballotPhase(at('2026-10-25T06:00:00Z'), DATES)).toBe('late')
  })

  // DST ends Sun Nov 1, so Election Day is on MST (UTC−7). Treating it as
  // MDT would start Election Day an hour early, at 11pm on Nov 2.
  it('is still late at 11:59pm the night before Election Day, after the DST change', () => {
    expect(ballotPhase(at('2026-11-03T06:59:00Z'), DATES)).toBe('late')
  })

  it('is Election Day from the first Denver minute of Nov 3', () => {
    expect(ballotPhase(at('2026-11-03T07:00:00Z'), DATES)).toBe('eday')
  })

  it('is still Election Day at 6:59pm, while drop boxes are open', () => {
    expect(ballotPhase(at('2026-11-04T01:59:00Z'), DATES)).toBe('eday')
  })

  it('is over from 7:00pm on Election Day, when the polls close', () => {
    expect(ballotPhase(at('2026-11-04T02:00:00Z'), DATES)).toBe('over')
  })

  it('stays over on every day after the election', () => {
    expect(ballotPhase(at('2026-11-20T18:00:00Z'), DATES)).toBe('over')
  })

  it('is early weeks before the mail-by date', () => {
    expect(ballotPhase(at('2026-10-05T15:00:00Z'), DATES)).toBe('early')
  })

  // A UTC reading of the mail-by date would flip at 6pm Denver time on Oct 24
  // and tell people it's too late to mail six hours before it is.
  it('reads the mail-by date as a Denver day, not a UTC one', () => {
    expect(ballotPhase(at('2026-10-25T01:00:00Z'), DATES)).toBe('early')
  })
})

describe('onlineRegistrationOpen', () => {
  it('is open through the last minute of the registration date in Denver', () => {
    expect(onlineRegistrationOpen(at('2026-10-27T05:59:00Z'), DATES)).toBe(true)
  })

  it('closes at the first Denver minute after the registration date', () => {
    expect(onlineRegistrationOpen(at('2026-10-27T06:00:00Z'), DATES)).toBe(
      false,
    )
  })
})

describe('voteState', () => {
  // Oct 25 and 26 are past the mail cutoff with online registration still
  // open: the one stretch where the two dates disagree.
  it('combines a late phase with registration still open', () => {
    expect(voteState(at('2026-10-25T18:00:00Z'), DATES)).toBe('late:open')
  })

  it('combines a late phase with registration closed', () => {
    expect(voteState(at('2026-10-28T18:00:00Z'), DATES)).toBe('late:closed')
  })

  it('reads early:open before both dates', () => {
    expect(voteState(at('2026-10-22T18:00:00Z'), DATES)).toBe('early:open')
  })

  // On and after Election Day registration has no separate step to show.
  it('drops registration on Election Day and after', () => {
    expect(voteState(at('2026-11-03T18:00:00Z'), DATES)).toBe('eday')
    expect(voteState(at('2026-11-05T18:00:00Z'), DATES)).toBe('over')
  })

  it('lists every state it can return, so the page can render each one', () => {
    const seen = [
      '2026-10-22T18:00:00Z',
      '2026-10-25T18:00:00Z',
      '2026-10-28T18:00:00Z',
      '2026-11-03T18:00:00Z',
      '2026-11-05T18:00:00Z',
    ].map(iso => voteState(at(iso), DATES))
    for (const state of seen) expect(VOTE_STATES).toContain(state)
  })
})

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

  // Q6: the state's site is .gov; the deck linked a .com.
  it('links GoVoteColorado on its .gov domain', () => {
    const { steps } = howToVote('early:open', DATES, 'en')
    expect(steps[0].body).toContain('https://www.govotecolorado.gov')
    expect(steps[0].body).not.toContain('.com')
  })
})

describe('formatBallotDate', () => {
  it('formats a stored date as a short Denver calendar date', () => {
    expect(formatBallotDate(DATES.mailByDate, 'en')).toBe('Oct 24')
    expect(formatBallotDate(DATES.mailByDate, 'es')).toBe('24 de octubre')
  })

  // A bare YAML date is midnight UTC, which is the evening before in Denver.
  // Formatting it in Denver time would print Oct 23.
  it('never shifts a date back a day by reading it in Denver time', () => {
    expect(formatBallotDate(new Date('2026-11-03T00:00:00Z'), 'en')).toBe(
      'Nov 3',
    )
  })
})

describe('electionDayLabel', () => {
  it('names the weekday in each language', () => {
    expect(electionDayLabel(DATES.electionDate, 'en')).toBe('Tue, Nov 3')
    expect(electionDayLabel(DATES.electionDate, 'es')).toBe(
      'martes 3 de noviembre',
    )
  })
})
