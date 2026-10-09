import { describe, expect, it } from 'vitest'
import { dayError, fromInput, toInput, weekOrder } from '@/lib/businessHours'

describe('business hours helpers', () => {
  it('orders days from the first day of the week', () => {
    expect(weekOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
  })

  it('edits midnight as 00:00 and saves it as 24:00', () => {
    expect(toInput({ start: '14:00', end: '24:00' })).toEqual({ start: '14:00', end: '00:00' })
    expect(fromInput({ start: '14:00', end: '00:00' })).toEqual({ start: '14:00', end: '24:00' })
    expect(fromInput({ start: '06:00', end: '12:00' })).toEqual({ start: '06:00', end: '12:00' })
  })

  it("finds a day's error among range errors", () => {
    const errors = { 'hours.3': ['overlap'], 'hours.1.0.end': ['after start'] }
    expect(dayError(errors, 3)).toBe('overlap')
    expect(dayError(errors, 1)).toBe('after start')
    expect(dayError(errors, 0)).toBeUndefined()
  })
})
