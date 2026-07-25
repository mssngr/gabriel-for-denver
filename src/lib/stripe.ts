import Stripe from 'stripe'

export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY)

// Every contribution's draft invoice auto-finalizes (and charges) at this
// moment: August 6, 2026, 6:00 AM in Denver (MDT, UTC-6).
export const CHARGE_AT = Math.floor(
  Date.parse('2026-08-06T06:00:00-06:00') / 1000,
)

export const MIN_AMOUNT_CENTS = 5_00
export const MAX_AMOUNT_CENTS = 415_00
