// Client for the /api/donate endpoints. Failures throw an Error whose
// message is safe to show the contributor; an empty message means the
// caller should show its own locale-appropriate generic error.
export type DonationSetupPayload = {
  fullName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  employer: string
  occupation: string
  amountDollars: number
}

async function postJson<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || '')
  }
  return data
}

export const createDonationSetup = (payload: DonationSetupPayload) =>
  postJson<{ clientSecret: string; setupIntentId: string }>(
    '/api/donate/setup',
    payload,
  )

export const scheduleDonationInvoice = (setupIntentId: string) =>
  postJson<{ invoiceId: string }>('/api/donate/schedule', { setupIntentId })
