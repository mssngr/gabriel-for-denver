// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above these imports, so the mocks it references must
// come from vi.hoisted() rather than a plain module-scope const.
const { fakeStripe, fakeElements, createDonationIntentMock } = vi.hoisted(
  () => {
    const fakePaymentElement = { mount: vi.fn() }
    const fakeElements = {
      update: vi.fn(),
      submit: vi.fn().mockResolvedValue({ error: undefined }),
      create: vi.fn(() => fakePaymentElement),
    }
    const fakeStripe = {
      elements: vi.fn(() => fakeElements),
      confirmPayment: vi
        .fn()
        .mockResolvedValue({ paymentIntent: { status: 'succeeded' } }),
    }
    const createDonationIntentMock = vi
      .fn()
      .mockResolvedValue({ clientSecret: 'secret_123' })
    return { fakeStripe, fakeElements, createDonationIntentMock }
  },
)

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(fakeStripe),
}))

vi.mock('./api', () => ({
  createDonationIntent: createDonationIntentMock,
}))

const { initDonationCheckout } = await import('./checkout')

// Mirrors the markup produced by index.astro + amount-step / info-step /
// payment-step.astro. Structure (ids, names, data-attributes) must stay in
// sync with those templates; classes don't matter here.
const FORM_HTML = `
  <form id="donation-form" data-publishable-key="pk_test_123" novalidate>
    <ul id="donation-steps">
      <li class="step step-secondary">Amount</li>
      <li class="step">Your info</li>
      <li class="step">Payment</li>
    </ul>

    <section data-step="0" class="flex">
      <button type="button" data-preset="5">$5</button>
      <button type="button" data-preset="50">$50</button>
      <button type="button" data-preset="415">$415</button>
      <input name="amount" type="number" min="5" max="415" step="1" required />
      <button type="button" data-next>Continue</button>
    </section>

    <section data-step="1" class="hidden">
      <input name="firstName" required />
      <input name="lastName" required />
      <input name="email" type="email" required />
      <input
        name="phone"
        type="tel"
        minlength="14"
        maxlength="14"
        pattern="\\(\\d{3}\\) \\d{3}-\\d{4}"
        required
      />
      <input name="addressLine1" required />
      <input name="addressLine2" />
      <input name="city" required />
      <select name="state" required>
        <option value="" disabled selected>State</option>
        <option value="CO">Colorado</option>
      </select>
      <input name="zip" minlength="5" maxlength="5" pattern="\\d{5}" required />
      <input name="employer" required />
      <input name="occupation" required />
      <button type="button" data-back>Back</button>
      <button type="button" data-next>Continue</button>
    </section>

    <section data-step="2" class="hidden">
      <p><span id="donation-summary-amount"></span></p>
      <p data-fee-row><span id="donation-summary-fee"></span></p>
      <p><span id="donation-summary-total"></span></p>
      <label data-cover-fees-row>
        <input type="checkbox" name="coverFees" id="donation-cover-fees" checked />
      </label>
      <div id="payment-element"></div>
      <button type="button" data-back>Back</button>
      <button id="donation-submit" type="submit">Contribute</button>
    </section>

    <div id="donation-result"></div>
  </form>
`

const config = {
  locale: 'en' as const,
  submitLabel: (amount: number) => `Contribute $${amount.toFixed(2)}`,
  processingLabel: 'Processing...',
  genericError: 'Something went wrong. Please try again.',
  paymentError: 'Your payment could not be processed. Please try again.',
  thankYouPath: '/donate/thank-you',
}

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Missing element: ${selector}`)
  return found
}

function setAmount(dollars: string) {
  el<HTMLInputElement>('input[name="amount"]').value = dollars
}

function fillInfoStep() {
  el<HTMLInputElement>('input[name="firstName"]').value = 'Ada'
  el<HTMLInputElement>('input[name="lastName"]').value = 'Lovelace'
  el<HTMLInputElement>('input[name="email"]').value = 'ada@example.com'
  el<HTMLInputElement>('input[name="phone"]').value = '(720) 555-1234'
  el<HTMLInputElement>('input[name="addressLine1"]').value = '123 Main St'
  el<HTMLInputElement>('input[name="city"]').value = 'Denver'
  el<HTMLSelectElement>('select[name="state"]').value = 'CO'
  el<HTMLInputElement>('input[name="zip"]').value = '80202'
  el<HTMLInputElement>('input[name="employer"]').value =
    'Analytical Engines Inc'
  el<HTMLInputElement>('input[name="occupation"]').value = 'Mathematician'
}

function clickNext(stepIndex: number) {
  document.querySelectorAll<HTMLButtonElement>('[data-next]')[stepIndex].click()
}

function clickBack(stepIndex: number) {
  document.querySelectorAll<HTMLButtonElement>('[data-back]')[stepIndex].click()
}

function isVisible(dataStep: number) {
  return !el(`[data-step="${dataStep}"]`).classList.contains('hidden')
}

beforeEach(async () => {
  vi.clearAllMocks()
  fakeElements.submit.mockResolvedValue({ error: undefined })
  fakeStripe.confirmPayment.mockResolvedValue({
    paymentIntent: { status: 'succeeded' },
  })
  createDonationIntentMock.mockResolvedValue({ clientSecret: 'secret_123' })

  document.body.innerHTML = FORM_HTML
  // jsdom's real Location throws "not implemented: navigation" console
  // noise on assignment; swap in a plain object for the final redirect.
  Object.defineProperty(window, 'location', {
    value: { href: '', origin: 'http://localhost' },
    writable: true,
  })
  await initDonationCheckout(config)
})

describe('fee coverage display', () => {
  it('defaults to checked and shows the grossed-up total for a normal amount', () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    expect(el<HTMLInputElement>('#donation-cover-fees').checked).toBe(true)
    expect(el('[data-cover-fees-row]').classList.contains('hidden')).toBe(false)
    expect(el('#donation-summary-amount').textContent).toBe('$50.00')
    expect(el('#donation-summary-fee').textContent).toBe('$1.81')
    expect(el('#donation-summary-total').textContent).toBe('$51.81')
    expect(el('#donation-submit').textContent).toBe('Contribute $51.81')
  })

  it('hides the cover-fees option once covering it would exceed $415 total', () => {
    setAmount('402.67')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    expect(el('[data-cover-fees-row]').classList.contains('hidden')).toBe(true)
    expect(el('#donation-summary-total').textContent).toBe('$402.67')
    expect(el('#donation-submit').textContent).toBe('Contribute $402.67')
  })

  it('never grosses up a $415 (max) contribution', () => {
    setAmount('415')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    expect(el('[data-cover-fees-row]').classList.contains('hidden')).toBe(true)
    expect(el('#donation-summary-total').textContent).toBe('$415.00')
  })

  it('resumes applying the fee once the amount drops back below the cap after being hidden', () => {
    // Regression test: an earlier version of this logic forced the checkbox
    // itself to `checked = false` while hidden, which then stuck unchecked
    // even after the donor lowered the amount again.
    setAmount('415')
    clickNext(0)
    fillInfoStep()
    clickNext(1)
    expect(el('[data-cover-fees-row]').classList.contains('hidden')).toBe(true)

    clickBack(1) // back to info
    clickBack(0) // back to amount
    setAmount('50')
    clickNext(0)
    clickNext(1)

    expect(el<HTMLInputElement>('#donation-cover-fees').checked).toBe(true)
    expect(el('[data-cover-fees-row]').classList.contains('hidden')).toBe(false)
    expect(el('#donation-summary-total').textContent).toBe('$51.81')
  })

  it('drops the fee immediately when the checkbox is unchecked', () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    const checkbox = el<HTMLInputElement>('#donation-cover-fees')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    expect(el('#donation-summary-total').textContent).toBe('$50.00')
    expect(el('#donation-submit').textContent).toBe('Contribute $50.00')
  })
})

describe('step validation', () => {
  it('blocks leaving the amount step when the amount is below the $5 minimum', () => {
    setAmount('3')
    clickNext(0)
    expect(isVisible(0)).toBe(true)
    expect(isVisible(1)).toBe(false)
  })

  it('blocks leaving the amount step when the amount is above the $415 maximum', () => {
    setAmount('500')
    clickNext(0)
    expect(isVisible(0)).toBe(true)
  })

  it('blocks leaving the info step until every required field is filled', () => {
    setAmount('50')
    clickNext(0)
    // Leave everything blank.
    clickNext(1)
    expect(isVisible(1)).toBe(true)
    expect(isVisible(2)).toBe(false)
  })

  it('blocks leaving the info step when the phone number is malformed', () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    el<HTMLInputElement>('input[name="phone"]').value = '5551234'
    clickNext(1)
    expect(isVisible(1)).toBe(true)
  })
})

describe('submission payload', () => {
  it('sends every piece of collected donor information plus the amount and fee choice', async () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    el<HTMLFormElement>('#donation-form').dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true }),
    )

    await vi.waitFor(() => expect(createDonationIntentMock).toHaveBeenCalled())

    expect(createDonationIntentMock).toHaveBeenCalledWith({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '(720) 555-1234',
      addressLine1: '123 Main St',
      addressLine2: '',
      city: 'Denver',
      state: 'CO',
      zip: '80202',
      employer: 'Analytical Engines Inc',
      occupation: 'Mathematician',
      amountDollars: 50,
      coverFees: true,
    })
  })

  it('sends coverFees: false once it has been unchecked', async () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    const checkbox = el<HTMLInputElement>('#donation-cover-fees')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    el<HTMLFormElement>('#donation-form').dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true }),
    )

    await vi.waitFor(() => expect(createDonationIntentMock).toHaveBeenCalled())
    expect(createDonationIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ coverFees: false, amountDollars: 50 }),
    )
  })

  it('does not call the API if a required field was cleared after the info step was already passed', async () => {
    setAmount('50')
    clickNext(0)
    fillInfoStep()
    clickNext(1)

    // Simulate a field going blank again without re-running step navigation
    // (e.g. browser autofill clearing it) — the submit handler re-validates
    // every step before calling the API.
    el<HTMLInputElement>('input[name="employer"]').value = ''

    el<HTMLFormElement>('#donation-form').dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true }),
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(createDonationIntentMock).not.toHaveBeenCalled()
    expect(isVisible(1)).toBe(true)
  })
})
