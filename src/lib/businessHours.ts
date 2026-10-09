import type { TimeRange, WeeklyHours } from '@/api/tenant'

export const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

/** Day numbers (0 = Sunday) starting from the organization's first day of the week. */
export function weekOrder(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7)
}

/** A starting point when hours were never set: every day 06:00–22:00. */
export function defaultWeek(): WeeklyHours {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, d) => [String(d), [{ start: '06:00', end: '22:00' }]]),
  )
}

/**
 * Time inputs cannot show 24:00, so midnight as a closing time is edited as 00:00 and saved as
 * 24:00 (the API's "until midnight").
 */
export const toInput = (range: TimeRange): TimeRange => ({
  start: range.start,
  end: range.end === '24:00' ? '00:00' : range.end,
})
export const fromInput = (range: TimeRange): TimeRange => ({
  start: range.start,
  end: range.end === '00:00' ? '24:00' : range.end,
})

/** The validation error for a day (`hours.3` or any of its ranges), if any. */
export function dayError(errors: Record<string, string[]>, day: number): string | undefined {
  const key = Object.keys(errors).find((k) => k === `hours.${day}` || k.startsWith(`hours.${day}.`))
  return key ? errors[key]?.[0] : undefined
}
