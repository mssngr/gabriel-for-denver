import { describe, expect, it } from 'vitest'
import type { BallotDates } from './ballot'
import {
  ballotPhase,
  electionDayLabel,
  formatBallotDate,
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

  // An editor could set the registration date before the mail-by date. Then
  // there are days still early for mailing with registration already closed.
  it('reads early:closed when registration closes before the mail cutoff', () => {
    const dates = {
      ...DATES,
      registerOnlineByDate: new Date('2026-10-20T00:00:00Z'),
    }
    expect(voteState(at('2026-10-22T18:00:00Z'), dates)).toBe('early:closed')
  })

  // The page renders one strip per entry in VOTE_STATES and hides the rest,
  // so a state listed there that can't happen is dead markup, and one that
  // can happen but isn't listed would leave the strip blank on that day.
  it('reaches exactly the states VOTE_STATES lists, over a sweep of days', () => {
    const earlyClose = {
      ...DATES,
      registerOnlineByDate: new Date('2026-10-20T00:00:00Z'),
    }
    const reached = new Set<string>()
    for (const dates of [DATES, earlyClose]) {
      for (let day = 1; day <= 30; day++) {
        for (const hour of [0, 12, 23]) {
          const now = new Date(Date.UTC(2026, 9, 15 + day, hour))
          reached.add(voteState(now, dates))
        }
      }
    }
    expect([...reached].sort()).toEqual([...VOTE_STATES].sort())
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
