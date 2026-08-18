// Denver's Fair Elections Fund contribution limit; the $5 floor keeps
// charges above Stripe's practical minimum.
export const MIN_AMOUNT_CENTS = 5_00
export const MAX_AMOUNT_CENTS = 415_00

// Stripe's standard U.S. card rate: 2.9% + $0.30 per charge. Used to gross up
// a contribution so that, after Stripe takes its cut, the campaign still
// nets the full amount the donor intended to give. Under Denver campaign
// finance law this fee is an expenditure to the processor, not part of the
// contribution.
const FEE_RATE = 0.029
const FEE_FIXED_CENTS = 30

export function totalWithFeesCents(amountCents: number): number {
  return Math.ceil((amountCents + FEE_FIXED_CENTS) / (1 - FEE_RATE))
}

// Fee coverage isn't offered once grossing up the contribution would push
// the card charge itself past the $415 cap.
export function canCoverFees(amountCents: number): boolean {
  return totalWithFeesCents(amountCents) <= MAX_AMOUNT_CENTS
}
