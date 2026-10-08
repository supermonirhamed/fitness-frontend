import { useI18n } from 'vue-i18n'
import { useOrganization } from '@/stores/organization'
import { formatDate, formatTime, type DatePattern, type TimeFormat } from '@/lib/datetime'

type Moment = Date | string | number

/**
 * Dates, times and money as the organization configured them (US-00.14). Pass a location's
 * timezone for location data; org-wide screens use the organization's. `showZone` when the
 * screen mixes locations in different zones.
 */
export function useFormat() {
  const { locale, n } = useI18n()
  const org = useOrganization()

  const settings = () => ({
    pattern: (org.organization?.date_format ?? 'dd/MM/yyyy') as DatePattern,
    clock: (org.organization?.time_format ?? '12h') as TimeFormat,
    zone: org.organization?.timezone,
  })

  function date(value: Moment, timeZone?: string): string {
    const s = settings()
    return formatDate(new Date(value), s.pattern, timeZone ?? s.zone, locale.value)
  }

  function time(value: Moment, timeZone?: string, showZone = false): string {
    const s = settings()
    return formatTime(new Date(value), s.clock, timeZone ?? s.zone, locale.value, showZone)
  }

  function dateTime(value: Moment, timeZone?: string, showZone = false): string {
    return `${date(value, timeZone)} ${time(value, timeZone, showZone)}`
  }

  /** Money in the organization's currency. */
  const money = (amount: number) => n(amount, 'currency')

  return { date, time, dateTime, money }
}
