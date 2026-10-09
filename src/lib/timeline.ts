// Timeline maths for the facility availability view (US-01.11). Everything is in the branch's
// timezone: a "day" is a Y-m-d at the branch, a position is minutes since that day's midnight.
import type { AvailabilityDay, FacilityReservation, TimeRange } from '@/api/tenant'

export const DAY_MINUTES = 24 * 60
export const SLOT_MINUTES = 30

/** The branch-local date and minute of an instant. */
export function zoned(iso: string, timeZone: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** Y-m-d plus n days (calendar arithmetic, no timezone involved). */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + n))
  return date.toISOString().slice(0, 10)
}

export const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()

/** The first day of the week containing ymd (0 = weeks start on Sunday). */
export function startOfWeek(ymd: string, weekStart: number): string {
  return addDays(ymd, -((weekday(ymd) - weekStart + 7) % 7))
}

export const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}
export const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export interface Segment {
  reservation: FacilityReservation
  date: string
  /** Where the bar is drawn (buffers included) and the actual start/end, clipped to the day. */
  from: number
  to: number
  start: number
  end: number
}

/** A reservation cut into one segment per day it touches. */
export function segmentsOf(r: FacilityReservation, days: string[], timeZone: string): Segment[] {
  const at = (iso: string) => zoned(iso, timeZone)
  const position = (iso: string, date: string) => {
    const z = at(iso)
    if (z.date < date) return 0
    if (z.date > date) return DAY_MINUTES
    return z.minutes
  }
  return days
    .map((date) => ({
      reservation: r,
      date,
      from: position(r.blocked_from, date),
      to: position(r.blocked_until, date),
      start: position(r.starts_at, date),
      end: position(r.ends_at, date),
    }))
    .filter((s) => s.to > s.from)
}

/** Open ranges of a day in minutes; null hours mean "not set": open all day. */
export function openRanges(day: AvailabilityDay): { from: number; to: number }[] {
  if (day.hours === null) return [{ from: 0, to: DAY_MINUTES }]
  return day.hours.map((r: TimeRange) => ({ from: minutesOf(r.start), to: minutesOf(r.end) }))
}

/**
 * Whole hours to show: at least 06–22, widened to the opening hours and anything booked. When
 * the weekly hours are not set (open all day), the whole day.
 */
export function visibleHours(
  days: AvailabilityDay[],
  segments: Segment[],
): { from: number; to: number } {
  if (days.some((d) => d.hours === null)) return { from: 0, to: DAY_MINUTES }
  const edges = [...days.flatMap(openRanges), ...segments.map((s) => ({ from: s.from, to: s.to }))]
  const from = Math.min(6 * 60, ...edges.map((e) => Math.floor(e.from / 60) * 60))
  const to = Math.max(22 * 60, ...edges.map((e) => Math.ceil(e.to / 60) * 60))
  return { from, to }
}

/** Whether [from, to) on that day is open and not taken. */
export function isFree(
  day: AvailabilityDay,
  from: number,
  to: number,
  segments: Segment[],
): boolean {
  const open = openRanges(day).some((r) => r.from <= from && to <= r.to)
  const taken = segments.some((s) => s.date === day.date && s.from < to && s.to > from)
  return open && !taken
}
