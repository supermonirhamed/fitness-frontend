import { describe, expect, it } from 'vitest'
import { calculateVat } from '@/lib/vat'

describe('VAT preview', () => {
  it('matches the API on exclusive and inclusive prices', () => {
    expect(calculateVat(10000, 15, false)).toEqual({ net: 10000, vat: 1500, gross: 11500 })
    expect(calculateVat(11500, 15, true)).toEqual({ net: 10000, vat: 1500, gross: 11500 })
    expect(calculateVat(1010, 15, false).vat).toBe(152)
    expect(calculateVat(5000, null, true)).toEqual({ net: 5000, vat: 0, gross: 5000 })
  })
})
