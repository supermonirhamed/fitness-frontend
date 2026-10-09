// Same maths as the API's App\Support\Vat (US-01.14), for the receipt preview. Amounts are minor units.
export interface VatLine {
  net: number
  vat: number
  gross: number
}

export function calculateVat(amount: number, rate: number | null, inclusive: boolean): VatLine {
  if (rate === null) return { net: amount, vat: 0, gross: amount }
  const bp = Math.round(rate * 100)
  if (inclusive) {
    const vat = Math.floor((amount * bp * 2 + (10000 + bp)) / (2 * (10000 + bp)))
    return { net: amount - vat, vat, gross: amount }
  }
  const vat = Math.floor((amount * bp * 2 + 10000) / 20000)
  return { net: amount, vat, gross: amount + vat }
}
