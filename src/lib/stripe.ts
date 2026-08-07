import Stripe from 'stripe'

export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY)

export const MIN_AMOUNT_CENTS = 5_00
export const MAX_AMOUNT_CENTS = 415_00
