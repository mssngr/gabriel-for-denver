import type { APIRoute } from 'astro'
import { scheduleDonationInvoice } from '../../../lib/schedule-donation'
import { stripe } from '../../../lib/stripe'

export const prerender = false

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const POST: APIRoute = async ({ request }) => {
  let setupIntentId: unknown
  try {
    ;({ setupIntentId } = await request.json())
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }
  if (typeof setupIntentId !== 'string' || !setupIntentId.startsWith('seti_')) {
    return json({ error: 'Invalid setup intent.' }, 400)
  }

  try {
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
    if (setupIntent.status !== 'succeeded') {
      return json(
        { error: 'Your payment details have not been confirmed yet.' },
        400,
      )
    }

    const result = await scheduleDonationInvoice(setupIntent)
    if (!result.ok) {
      return json({ error: result.error }, 400)
    }
    return json({ invoiceId: result.invoiceId })
  } catch (error) {
    console.error('Failed to schedule donation invoice', error)
    return json(
      {
        error:
          'Something went wrong scheduling your contribution. Please try again.',
      },
      500,
    )
  }
}
