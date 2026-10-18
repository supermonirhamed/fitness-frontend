// Academy helpers (EP-10): plain dates, age group rules and term windows.

/** A Y-m-d date as a local Date (date pickers), or null. */
export function fromYmd(ymd: string | null | undefined): Date | null {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** A Y-m-d date shown in the organization's format, without shifting it to a time zone. */
export function showDay(format: { date: (iso: string, zone?: string) => string }, ymd: string) {
  return format.date(`${ymd}T00:00:00Z`, 'UTC')
}

/** Adds days to a Y-m-d date. */
export function addDays(ymd: string, days: number): string {
  const d = fromYmd(ymd)!
  d.setDate(d.getDate() + days)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
    .join('-')
}

/** Days between two Y-m-d dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromYmd(to)!.getTime() - fromYmd(from)!.getTime()) / 86_400_000)
}

/** Where a term's enrollment stands today. */
export function enrollmentState(term: {
  enrollment_opens_on: string
  enrollment_closes_on: string
}): 'upcoming' | 'open' | 'closed' {
  const today = new Date()
  const ymd = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
    .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
    .join('-')
  if (ymd < term.enrollment_opens_on) return 'upcoming'
  return ymd > term.enrollment_closes_on ? 'closed' : 'open'
}
