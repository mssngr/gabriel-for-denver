import { describe, expect, it } from 'vitest'
import {
  canCoverFees,
  MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  totalWithFeesCents,
} from './fees'

describe('contribution limits', () => {
  it('sets the $5 floor and $415 ceiling', () => {
    expect(MIN_AMOUNT_CENTS).toBe(500)
    expect(MAX_AMOUNT_CENTS).toBe(41500)
  })
})

describe('totalWithFeesCents', () => {
  it('grosses up a $50 contribution to $51.81', () => {
    expect(totalWithFeesCents(5000)).toBe(5181)
  })

  it('grosses up the $5 minimum to $5.46', () => {
    expect(totalWithFeesCents(500)).toBe(546)
  })

  it('grosses up the $415 maximum to $427.71', () => {
    expect(totalWithFeesCents(41500)).toBe(42771)
  })

  it('never charges less than the contribution plus Stripe’s $0.30 fixed fee', () => {
    expect(totalWithFeesCents(0)).toBe(31)
  })

  it('rounds the grossed-up total up to the next cent', () => {
    // $402.66 and $402.67 land on either side of a fractional-cent boundary;
    // both must round up, not down, so the campaign is never shorted.
    expect(totalWithFeesCents(40266)).toBe(41500)
    expect(totalWithFeesCents(40267)).toBe(41501)
  })
})

describe('canCoverFees', () => {
  it('allows covering fees on a typical small contribution', () => {
    expect(canCoverFees(500)).toBe(true)
    expect(canCoverFees(5000)).toBe(true)
  })

  it('allows covering fees right up to the point the total would hit $415', () => {
    expect(canCoverFees(40266)).toBe(true)
  })

  it('disallows covering fees the moment the total would exceed $415', () => {
    expect(canCoverFees(40267)).toBe(false)
  })

  it('disallows covering fees on a max ($415) contribution', () => {
    expect(canCoverFees(MAX_AMOUNT_CENTS)).toBe(false)
  })
})
