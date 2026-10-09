import { describe, expect, it } from 'vitest'
import type { AvailabilityDay, FacilityReservation } from '@/api/tenant'
import { addDays, isFree, segmentsOf, startOfWeek, visibleHours, zoned } from '@/lib/timeline'

const reservation = (over: Partial<FacilityReservation>): FacilityReservation => ({
  id: 1,
  kind: 'session',
  title: 'Aqua fit',
  facility_id: 1,
  facility: 'Pool',
  starts_at: '2030-01-06T06:00:00+00:00',
  ends_at: '2030-01-06T07:00:00+00:00',
  blocked_from: '2030-01-06T05:45:00+00:00',
  blocked_until: '2030-01-06T07:30:00+00:00',
  coach: null,
  ...over,
})
const day = (date: string, hours: AvailabilityDay['hours']): AvailabilityDay => ({
  date,
  hours,
  override: null,
})

describe('timeline', () => {
  it('places instants in the branch timezone', () => {
    expect(zoned('2030-01-06T06:00:00+00:00', 'Asia/Riyadh')).toEqual({
      date: '2030-01-06',
      minutes: 540,
    })
    expect(zoned('2030-01-06T22:30:00+00:00', 'Asia/Riyadh')).toEqual({
      date: '2030-01-07',
      minutes: 90,
    })
  })

  it('does calendar arithmetic', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01')
    expect(startOfWeek('2030-01-09', 0)).toBe('2030-01-06') // Wednesday → Sunday
    expect(startOfWeek('2030-01-09', 6)).toBe('2030-01-05') // weeks starting Saturday
  })

  it('cuts a reservation into days, buffers included', () => {
    const [s] = segmentsOf(reservation({}), ['2030-01-06'], 'Asia/Riyadh')
    expect(s).toMatchObject({ from: 525, start: 540, end: 600, to: 630 })

    const overnight = reservation({
      starts_at: '2030-01-06T19:00:00+00:00', // 22:00 local
      ends_at: '2030-01-07T05:00:00+00:00', // 08:00 next day
      blocked_from: '2030-01-06T19:00:00+00:00',
      blocked_until: '2030-01-07T05:00:00+00:00',
    })
    const parts = segmentsOf(overnight, ['2030-01-06', '2030-01-07', '2030-01-08'], 'Asia/Riyadh')
    expect(parts.map((p) => [p.date, p.from, p.to])).toEqual([
      ['2030-01-06', 1320, 1440],
      ['2030-01-07', 0, 480],
    ])
  })

  it('knows free slots: open and not taken', () => {
    const segments = segmentsOf(reservation({}), ['2030-01-06'], 'Asia/Riyadh')
    const sunday = day('2030-01-06', [{ start: '06:00', end: '22:00' }])
    expect(isFree(sunday, 600, 630, segments)).toBe(false) // cleanup buffer until 10:30
    expect(isFree(sunday, 630, 660, segments)).toBe(true)
    expect(isFree(sunday, 300, 330, segments)).toBe(false) // before opening
    expect(isFree(day('2030-01-08', []), 600, 630, [])).toBe(false) // closed
    expect(isFree(day('2030-01-08', null), 60, 90, [])).toBe(true) // hours not set
  })

  it('shows the hours around opening times and bookings', () => {
    const hours = visibleHours([day('2030-01-06', [{ start: '06:30', end: '23:00' }])], [])
    expect(hours).toEqual({ from: 360, to: 1380 })
    expect(visibleHours([day('2030-01-06', [])], [])).toEqual({ from: 360, to: 1320 })
    expect(visibleHours([day('2030-01-06', null)], [])).toEqual({ from: 0, to: 1440 })
  })
})
