import { loadStripe, type StripeElementLocale } from '@stripe/stripe-js'
import { canCoverFees, totalWithFeesCents } from '../../lib/fees'
import { createDonationIntent } from './api'
import { attachPhoneMask } from './phone-mask'

// Locale-specific text and routing, supplied by each language's entry
// component (index.astro / es/index.astro)
export type DonationCheckoutConfig = {
  locale: StripeElementLocale
  submitLabel: (totalAmount: number) => string
  processingLabel: string
  genericError: string
  paymentError: string
  thankYouPath: string
}

const formatDollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export async function initDonationCheckout(config: DonationCheckoutConfig) {
  const form = document.getElementById('donation-form') as HTMLFormElement
  const submitButton = document.getElementById(
    'donation-submit',
  ) as HTMLButtonElement
  const result = document.getElementById('donation-result') as HTMLElement
  const stepLabels = [
    ...document.querySelectorAll<HTMLElement>('#donation-steps .step'),
  ]
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')]
  const amountInput = form.querySelector(
    'input[name="amount"]',
  ) as HTMLInputElement
  const presetButtons = [
    ...form.querySelectorAll<HTMLButtonElement>('[data-preset]'),
  ]
  const summaryAmount = document.getElementById(
    'donation-summary-amount',
  ) as HTMLElement
  const summaryFee = document.getElementById('donation-summary-fee') as HTMLElement
  const summaryTotal = document.getElementById(
    'donation-summary-total',
  ) as HTMLElement
  const feeRow = form.querySelector('[data-fee-row]') as HTMLElement
  const coverFeesRow = form.querySelector(
    '[data-cover-fees-row]',
  ) as HTMLElement
  const coverFeesInput = document.getElementById(
    'donation-cover-fees',
  ) as HTMLInputElement

  const stripe = await loadStripe(form.dataset.publishableKey || '')
  if (!stripe) throw new Error('Failed to load Stripe.js')

  const amountCents = () => Math.round(Number(amountInput.value || 5) * 100)
  const chargeCents = () =>
    coverFeesInput.checked && canCoverFees(amountCents())
      ? totalWithFeesCents(amountCents())
      : amountCents()

  const elements = stripe.elements({
    mode: 'payment',
    currency: 'usd',
    amount: chargeCents(),
    paymentMethodTypes: ['card'],
    locale: config.locale,
  })
  const paymentElement = elements.create('payment', {
    // Name, email, and address are collected in the "Your info" step and
    // passed along at confirm time, so the card element skips them
    fields: { billingDetails: 'never' },
    // Link's bank option would produce a non-card payment method that the
    // card-only PaymentIntent rejects, so keep it out of the element
    wallets: { link: 'never' },
  })
  let paymentMounted = false

  const submitLabel = () => config.submitLabel(chargeCents() / 100)

  const updateSummary = () => {
    // Leaves the checkbox's checked state untouched — chargeCents() already
    // ignores it once covering the fee would exceed the cap, so it just
    // quietly resumes applying once the amount drops back below that point.
    coverFeesRow.classList.toggle('hidden', !canCoverFees(amountCents()))

    const fee = chargeCents() - amountCents()
    summaryAmount.textContent = formatDollars(amountCents())
    summaryFee.textContent = formatDollars(fee)
    feeRow.classList.toggle('hidden', fee === 0)
    summaryTotal.textContent = formatDollars(chargeCents())
    submitButton.textContent = submitLabel()
  }

  attachPhoneMask(form.querySelector('input[name="phone"]') as HTMLInputElement)

  const showStep = (index: number) => {
    steps.forEach((step, i) => {
      step.classList.toggle('hidden', i !== index)
      step.classList.toggle('flex', i === index)
    })
    stepLabels.forEach((label, i) => {
      label.classList.toggle('step-secondary', i <= index)
    })
    if (index === 2) {
      elements.update({ amount: chargeCents() })
      if (!paymentMounted) {
        paymentElement.mount('#payment-element')
        paymentMounted = true
      }
      updateSummary()
    }
  }

  coverFeesInput.addEventListener('change', () => {
    elements.update({ amount: chargeCents() })
    updateSummary()
  })

  const stepIsValid = (index: number) => {
    for (const field of steps[index].querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('input, select')) {
      if (!field.reportValidity()) return false
    }
    return true
  }

  const stepOf = (el: HTMLElement) => steps.findIndex(step => step.contains(el))

  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      amountInput.value = button.dataset.preset || ''
      presetButtons.forEach(other => {
        other.classList.toggle('btn-secondary', other === button)
      })
    })
  })
  amountInput.addEventListener('input', () => {
    presetButtons.forEach(button => {
      button.classList.toggle(
        'btn-secondary',
        button.dataset.preset === amountInput.value,
      )
    })
  })

  form.querySelectorAll<HTMLButtonElement>('[data-next]').forEach(button => {
    button.addEventListener('click', () => {
      const index = stepOf(button)
      if (stepIsValid(index)) showStep(index + 1)
    })
  })
  form.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(button => {
    button.addEventListener('click', () => showStep(stepOf(button) - 1))
  })

  const fail = (message?: string) => {
    result.textContent = message || config.genericError
    submitButton.disabled = false
    submitButton.textContent = submitLabel()
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()

    // The earlier steps were validated on the way in, but re-check everything
    // and jump back to the first offending step just in case
    for (let i = 0; i < steps.length; i++) {
      if (!stepIsValid(i)) {
        showStep(i)
        return
      }
    }

    submitButton.disabled = true
    submitButton.textContent = config.processingLabel
    result.textContent = ''

    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >
    const fullName = `${data.firstName} ${data.lastName}`.trim()

    const { error: submitError } = await elements.submit()
    if (submitError) return fail(submitError.message)

    try {
      const intent = await createDonationIntent({
        fullName,
        email: data.email,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        employer: data.employer,
        occupation: data.occupation,
        amountDollars: Number(data.amount),
        coverFees: coverFeesInput.checked,
      })

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}${config.thankYouPath}`,
          payment_method_data: {
            billing_details: {
              name: fullName,
              email: data.email,
              phone: data.phone,
              address: {
                line1: data.addressLine1,
                line2: data.addressLine2 || undefined,
                city: data.city,
                state: data.state,
                postal_code: data.zip,
                country: 'US',
              },
            },
          },
        },
        redirect: 'if_required',
      })
      if (confirmError) return fail(confirmError.message)
      if (paymentIntent?.status !== 'succeeded') return fail(config.paymentError)
    } catch (error) {
      return fail(error instanceof Error ? error.message : undefined)
    }

    window.posthog?.capture('donation_form_submitted')
    window.location.href = config.thankYouPath
  })
}
