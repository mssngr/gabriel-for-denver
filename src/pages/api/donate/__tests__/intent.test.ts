import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above these imports, so the mocks it references must
// come from vi.hoisted() rather than a plain module-scope const.
const { customersCreate, paymentIntentsCreate } = vi.hoisted(() => ({
  customersCreate: vi.fn(),
  paymentIntentsCreate: vi.fn(),
}))

vi.mock('../../../../lib/stripe', () => ({
  stripe: {
    customers: { create: customersCreate },
    paymentIntents: { create: paymentIntentsCreate },
  },
}))

const { POST } = await import('../intent')

const validDonor = {
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
}

function postIntent(body: unknown) {
  const request = new Request('http://localhost/api/donate/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  // The route only destructures `request` off the context object.
  return POST({ request } as Parameters<typeof POST>[0])
}

beforeEach(() => {
  customersCreate.mockReset()
  paymentIntentsCreate.mockReset()
  customersCreate.mockResolvedValue({ id: 'cus_123' })
  paymentIntentsCreate.mockResolvedValue({ client_secret: 'secret_123' })
})

describe('request body validation', () => {
  it('rejects invalid JSON', async () => {
    const res = await postIntent('not json')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid request body.')
    expect(paymentIntentsCreate).not.toHaveBeenCalled()
  })
})

describe('required donor information', () => {
  it('rejects a completely empty submission, listing every missing field', async () => {
    const res = await postIntent({ amountDollars: 50 })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    for (const field of [
      'fullName',
      'email',
      'phone',
      'addressLine1',
      'city',
      'state',
      'zip',
      'employer',
      'occupation',
    ]) {
      expect(error).toContain(field)
    }
  })

  it.each([
    'fullName',
    'email',
    'phone',
    'addressLine1',
    'city',
    'state',
    'zip',
    'employer',
    'occupation',
  ])('rejects a submission missing %s', async field => {
    const res = await postIntent({
      ...validDonor,
      amountDollars: 50,
      [field]: '',
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain(field)
    expect(paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only value as missing', async () => {
    const res = await postIntent({
      ...validDonor,
      amountDollars: 50,
      employer: '   ',
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('employer')
  })

  it('rejects a non-string value for a required field', async () => {
    const res = await postIntent({
      ...validDonor,
      amountDollars: 50,
      occupation: 12345,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('occupation')
  })

  it('does not require the optional apartment/suite line', async () => {
    const res = await postIntent({
      ...validDonor,
      amountDollars: 50,
      addressLine2: undefined,
    })
    expect(res.status).toBe(200)
  })

  it('passes the collected donor information to Stripe, trimmed', async () => {
    await postIntent({
      ...validDonor,
      amountDollars: 50,
      fullName: '  Ada Lovelace  ',
      addressLine2: 'Unit 4',
    })
    expect(customersCreate).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '(720) 555-1234',
      address: {
        line1: '123 Main St',
        line2: 'Unit 4',
        city: 'Denver',
        state: 'CO',
        postal_code: '80202',
        country: 'US',
      },
      metadata: {
        employer: 'Analytical Engines Inc',
        occupation: 'Mathematician',
      },
    })
  })
})

describe('contribution amount limits', () => {
  it('rejects amounts below the $5 minimum', async () => {
    const res = await postIntent({ ...validDonor, amountDollars: 4.99 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Contribution amount must be between $5 and $415.',
    )
    expect(paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects amounts above the $415 maximum', async () => {
    const res = await postIntent({ ...validDonor, amountDollars: 415.01 })
    expect(res.status).toBe(400)
    expect(paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric amount', async () => {
    const res = await postIntent({ ...validDonor, amountDollars: 'a lot' })
    expect(res.status).toBe(400)
    expect(paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects a missing amount', async () => {
    const res = await postIntent(validDonor)
    expect(res.status).toBe(400)
  })

  it('accepts the $5 minimum exactly', async () => {
    const res = await postIntent({ ...validDonor, amountDollars: 5 })
    expect(res.status).toBe(200)
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500 }),
    )
  })

  it('accepts the $415 maximum exactly', async () => {
    const res = await postIntent({ ...validDonor, amountDollars: 415 })
    expect(res.status).toBe(200)
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 41500 }),
    )
  })
})

describe('fee coverage', () => {
  it('grosses up the charge when coverFees is requested', async () => {
    await postIntent({ ...validDonor, amountDollars: 50, coverFees: true })
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5181,
        metadata: expect.objectContaining({
          contributionCents: '5000',
          feeCents: '181',
          coverFees: 'true',
        }),
      }),
    )
  })

  it('does not gross up the charge when coverFees is not requested', async () => {
    await postIntent({ ...validDonor, amountDollars: 50, coverFees: false })
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        metadata: expect.objectContaining({ coverFees: 'false' }),
      }),
    )
  })

  it('ignores coverFees once it would push the total over $415, even if requested', async () => {
    await postIntent({ ...validDonor, amountDollars: 402.67, coverFees: true })
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 40267,
        metadata: expect.objectContaining({ coverFees: 'false' }),
      }),
    )
  })

  it('allows coverFees right at the boundary where the total lands exactly on $415', async () => {
    await postIntent({ ...validDonor, amountDollars: 402.66, coverFees: true })
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 41500,
        metadata: expect.objectContaining({ coverFees: 'true' }),
      }),
    )
  })

  it('never offers coverFees on the $415 maximum contribution', async () => {
    await postIntent({ ...validDonor, amountDollars: 415, coverFees: true })
    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 41500,
        metadata: expect.objectContaining({ coverFees: 'false' }),
      }),
    )
  })
})

describe('failure handling', () => {
  it('returns a generic 500 if Stripe fails, without leaking the underlying error', async () => {
    customersCreate.mockRejectedValueOnce(new Error('stripe is down'))
    const res = await postIntent({ ...validDonor, amountDollars: 50 })
    expect(res.status).toBe(500)
    const { error } = await res.json()
    expect(error).not.toMatch(/stripe is down/)
  })
})
