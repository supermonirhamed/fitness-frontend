import { describe, expect, it } from 'vitest'
import { dayError, fromInput, splitByDate, todayIn, toInput, weekOrder } from '@/lib/businessHours'

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

describe('holiday lists', () => {
  it('splits upcoming and past by the branch day', () => {
    const items = [
      { start_date: '2026-10-01', end_date: '2026-10-02' },
      { start_date: '2026-12-01', end_date: '2026-12-01' },
      { start_date: '2026-10-08', end_date: '2026-10-10' },
      { start_date: '2026-09-01', end_date: '2026-09-01' },
    ]
    const { upcoming, past } = splitByDate(items, '2026-10-09')
    expect(upcoming.map((i) => i.start_date)).toEqual(['2026-10-08', '2026-12-01'])
    expect(past.map((i) => i.start_date)).toEqual(['2026-10-01', '2026-09-01'])
  })

  it("knows today's date in the branch timezone", () => {
    const lateUtc = new Date('2026-10-09T22:30:00Z')
    expect(todayIn('Asia/Riyadh', lateUtc)).toBe('2026-10-10')
    expect(todayIn('UTC', lateUtc)).toBe('2026-10-09')
  })
})
