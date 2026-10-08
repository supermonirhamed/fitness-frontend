/**
 * Dates and times as the organization configured them (US-00.14): a date pattern, 12/24-hour
 * clock, in a given timezone (the location's, or the organization's for org-wide screens), with
 * Western digits in both languages. Intl does the timezone maths; the pattern only orders parts.
 */
export type DatePattern = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd' | 'dd MMM yyyy'
export type TimeFormat = '12h' | '24h'

function parts(date: Date, locale: string, options: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat(locale, {
    numberingSystem: 'latn',
    ...options,
  }).formatToParts(date)) {
    out[p.type] = p.value
  }
  return out
}

export function formatDate(
  date: Date,
  pattern: DatePattern,
  timeZone: string | undefined,
  locale: string,
): string {
  const p = parts(date, locale, { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const month = pattern.includes('MMM')
    ? parts(date, locale, { timeZone, month: 'short' }).month
    : p.month
  return pattern
    .replace('dd', p.day ?? '')
    .replace(/MMM|MM/, month ?? '')
    .replace('yyyy', p.year ?? '')
}

export function formatTime(
  date: Date,
  clock: TimeFormat,
  timeZone: string | undefined,
  locale: string,
  showZone = false,
): string {
  return new Intl.DateTimeFormat(locale, {
    numberingSystem: 'latn',
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: clock === '12h',
    ...(showZone ? { timeZoneName: 'short' } : {}),
  }).format(date)
}

/** "GMT+3" / "غرينتش+٣"-style short name of a zone at a moment (shown when screens mix zones). */
export function zoneAbbreviation(timeZone: string, locale: string, at = new Date()): string {
  return parts(at, locale, { timeZone, timeZoneName: 'short' }).timeZoneName ?? timeZone
}

/** Whether a list spans more than one timezone, so times need the zone next to them. */
export const mixesZones = (zones: (string | null | undefined)[]) =>
  new Set(zones.filter(Boolean)).size > 1
