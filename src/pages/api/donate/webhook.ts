import type { APIRoute } from 'astro'
import type Stripe from 'stripe'
import { scheduleDonationInvoice } from '../../../lib/schedule-donation'
import { IS_LIVE_MODE, stripe } from '../../../lib/stripe'

export const prerender = false

const acknowledged = () =>
  new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

// Errors that can never succeed on retry. Deliberately narrow: anything not
// listed here keeps retrying, because a dropped delivery silently costs a
// contribution, while a pointless retry only costs noise.
const isPermanentStripeError = (error: unknown) => {
  const { type, code } = (error ?? {}) as { type?: string; code?: string }
  return type === 'StripeInvalidRequestError' && code === 'resource_missing'
}

// Safety net for the checkout flow: if a contributor's card is saved but they
// close the tab before /api/donate/schedule runs, this webhook still creates
// their scheduled invoice. Configure the endpoint in the Stripe dashboard to
// send setup_intent.succeeded events here.
export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret,
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  // A test-mode event delivered to a live deployment can never be processed —
  // the live key cannot see the object. Only ever skip in this direction:
  // dropping a stray test event is harmless, dropping a live one is not.
  if (IS_LIVE_MODE && !event.livemode) {
    console.error(`Ignoring test-mode event ${event.id} on a live deployment`)
    return acknowledged()
  }

  if (event.type === 'setup_intent.succeeded') {
    const received = event.data.object
    // Only handle donation setup intents (created by /api/donate/setup);
    // anything else on the account is acknowledged and ignored
    if (received.metadata?.amount_cents) {
      try {
        // Re-fetch rather than trusting the event payload, which can be stale
        // on retried deliveries
        const setupIntent = await stripe.setupIntents.retrieve(received.id)
        if (setupIntent.status === 'succeeded') {
          const result = await scheduleDonationInvoice(setupIntent)
          if (!result.ok) {
            // Permanently unprocessable — acknowledge so Stripe stops retrying
            console.error(
              `Webhook could not schedule invoice for ${received.id}: ${result.error}`,
            )
          }
        }
      } catch (error) {
        // Possibly transient — 500 so Stripe retries the delivery. Retrying is
        // safe because scheduleDonationInvoice is idempotent per setup intent.
        if (!isPermanentStripeError(error)) {
          console.error(`Webhook failed for ${received.id}`, error)
          return new Response('Failed to process event', { status: 500 })
        }
        // The key genuinely cannot see this object, so no retry will ever
        // succeed — acknowledge instead of looping for days
        console.error(`Webhook cannot process ${received.id}`, error)
      }
    }
  }

  return acknowledged()
}
