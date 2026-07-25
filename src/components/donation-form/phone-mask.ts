// Masks a phone input progressively as the user types:
// 7205551234 -> (720) 555-1234
export function attachPhoneMask(input: HTMLInputElement) {
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 10)
    if (digits.length > 6) {
      input.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length > 3) {
      input.value = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length > 0) {
      input.value = `(${digits}`
    } else {
      input.value = ''
    }
  })
}
