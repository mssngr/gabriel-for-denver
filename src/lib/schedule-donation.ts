import type Stripe from 'stripe'
import { CHARGE_AT, MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS, stripe } from './stripe'

type ScheduleResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string }

// Turns a confirmed donation SetupIntent into the scheduled invoice: sets the
// saved card as the customer's default, creates the invoice item for the
// chosen amount, and creates the draft invoice that auto-finalizes at
// CHARGE_AT. Called from both the checkout flow (/api/donate/schedule) and the
// setup_intent.succeeded webhook, so it must be safe to run twice for the same
// SetupIntent: the invoice carries setup_intent_id metadata and an existing
// match is returned as-is, with Stripe idempotency keys backstopping the
// near-simultaneous case.
export async function scheduleDonationInvoice(
  setupIntent: Stripe.SetupIntent,
): Promise<ScheduleResult> {
  const customerId =
    typeof setupIntent.customer === 'string'
      ? setupIntent.customer
      : setupIntent.customer?.id
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id
  // The amount was validated and stored server-side during setup, so it can't
  // be tampered with after the fact
  const amountCents = Number(setupIntent.metadata?.amount_cents)

  if (
    !customerId ||
    !paymentMethodId ||
    !Number.isFinite(amountCents) ||
    amountCents < MIN_AMOUNT_CENTS ||
    amountCents > MAX_AMOUNT_CENTS
  ) {
    return { ok: false, error: 'Invalid setup intent.' }
  }

  const invoices = await stripe.invoices.list({ customer: customerId })
  const existing = invoices.data.find(
    invoice => invoice.metadata?.setup_intent_id === setupIntent.id,
  )
  if (existing?.id) {
    return { ok: true, invoiceId: existing.id }
  }

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  // Billable line item for the contributor's chosen amount
  await stripe.invoiceItems.create(
    {
      customer: customerId,
      amount: amountCents,
      currency: 'usd',
      description: 'Campaign contribution — Gabriel for Denver',
    },
    { idempotencyKey: `donation-item-${setupIntent.id}` },
  )

  // Draft invoice that Stripe finalizes and charges automatically at
  // CHARGE_AT, using the customer's default payment method saved above
  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: 'charge_automatically',
      pending_invoice_items_behavior: 'include',
      auto_advance: true,
      automatically_finalizes_at: CHARGE_AT,
      metadata: { setup_intent_id: setupIntent.id },
    },
    { idempotencyKey: `donation-invoice-${setupIntent.id}` },
  )

  return { ok: true, invoiceId: invoice.id }
}
