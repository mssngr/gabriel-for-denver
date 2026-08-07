import type { APIRoute } from 'astro'
import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS, stripe } from '../../../lib/stripe'

export const prerender = false

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const field = (name: string) =>
    typeof body[name] === 'string' ? (body[name] as string).trim() : ''

  const fullName = field('fullName')
  const email = field('email')
  const phone = field('phone')
  const addressLine1 = field('addressLine1')
  const addressLine2 = field('addressLine2')
  const city = field('city')
  const state = field('state')
  const zip = field('zip')
  const employer = field('employer')
  const occupation = field('occupation')

  const required = {
    fullName,
    email,
    phone,
    addressLine1,
    city,
    state,
    zip,
    employer,
    occupation,
  }
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) {
    return json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      400,
    )
  }

  const amountCents = Math.round(Number(body.amountDollars) * 100)
  if (
    !Number.isFinite(amountCents) ||
    amountCents < MIN_AMOUNT_CENTS ||
    amountCents > MAX_AMOUNT_CENTS
  ) {
    return json(
      { error: 'Contribution amount must be between $5 and $415.' },
      400,
    )
  }

  try {
    const customer = await stripe.customers.create({
      name: fullName,
      email,
      phone,
      address: {
        line1: addressLine1,
        line2: addressLine2 || undefined,
        city,
        state,
        postal_code: zip,
        country: 'US',
      },
      metadata: { employer, occupation },
    })

    const paymentIntent = await stripe.paymentIntents.create({
      customer: customer.id,
      amount: amountCents,
      currency: 'usd',
      payment_method_types: ['card'],
      description: 'Campaign contribution — Gabriel for Denver',
    })

    return json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('Failed to create donation payment intent', error)
    return json(
      {
        error:
          'Something went wrong setting up your contribution. Please try again.',
      },
      500,
    )
  }
}
