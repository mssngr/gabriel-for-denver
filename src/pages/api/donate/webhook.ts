import type { APIRoute } from 'astro'
import type Stripe from 'stripe'
import { scheduleDonationInvoice } from '../../../lib/schedule-donation'
import { stripe } from '../../../lib/stripe'

export const prerender = false

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
        // Transient failure — return 500 so Stripe retries the delivery
        console.error(`Webhook failed for ${received.id}`, error)
        return new Response('Failed to process event', { status: 500 })
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
