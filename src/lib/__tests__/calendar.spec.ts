import { describe, expect, it } from 'vitest'
import { addDays, layoutLanes, startOfWeek, toMinutes, weekday, zonedToUtc } from '../calendar'

describe('calendar maths', () => {
  it('moves across months and finds the week start', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01')
    expect(weekday('2030-01-07')).toBe(1) // Monday
    expect(startOfWeek('2030-01-07', 6)).toBe('2030-01-05') // weeks start on Saturday
    expect(startOfWeek('2030-01-05', 6)).toBe('2030-01-05')
  })

  it('converts local times to UTC, also across daylight saving', () => {
    expect(zonedToUtc('2030-01-07', '18:00', 'Asia/Riyadh').toISOString()).toBe(
      '2030-01-07T15:00:00.000Z',
    )
    // London: winter UTC+0, summer UTC+1; 18:00 local stays 18:00 local.
    expect(zonedToUtc('2030-01-07', '18:00', 'Europe/London').toISOString()).toBe(
      '2030-01-07T18:00:00.000Z',
    )
    expect(zonedToUtc('2030-07-07', '18:00', 'Europe/London').toISOString()).toBe(
      '2030-07-07T17:00:00.000Z',
    )
  })

  it('puts overlapping sessions side by side', () => {
    const items = [
      { s: '09:00', e: '10:00' },
      { s: '09:30', e: '10:30' },
      { s: '10:00', e: '11:00' },
      { s: '12:00', e: '13:00' },
    ]
    const laid = layoutLanes(
      items,
      (i) => toMinutes(i.s),
      (i) => toMinutes(i.e),
    )
    expect(laid.map((l) => [l.item.s, l.lane, l.lanes])).toEqual([
      ['09:00', 0, 2],
      ['09:30', 1, 2],
      ['10:00', 0, 2],
      ['12:00', 0, 1],
    ])
  })
})
