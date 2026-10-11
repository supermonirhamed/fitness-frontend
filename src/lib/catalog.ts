import { useI18n } from 'vue-i18n'
import type { ActivityType, Program, Translated } from '@/api/tenant'

/** Category icons to pick from (PrimeIcons). */
export const CATEGORY_ICONS = [
  'pi-heart',
  'pi-bolt',
  'pi-sun',
  'pi-star',
  'pi-flag',
  'pi-users',
  'pi-user',
  'pi-stopwatch',
  'pi-trophy',
  'pi-shield',
  'pi-crown',
  'pi-sparkles',
  'pi-face-smile',
  'pi-globe',
  'pi-calendar',
  'pi-th-large',
] as const

/** Colour swatches for categories and services; any #rrggbb also works. */
export const COLOR_SWATCHES = [
  '#7c3aed',
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#16a34a',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#dc2626',
  '#db2777',
  '#64748b',
  '#0f172a',
] as const

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  Class: 'pi-users',
  Appointment: 'pi-user',
  Event: 'pi-calendar',
  'Open Access': 'pi-sign-in',
}

/** i18n key segment of an activity type ('Open Access' → 'OpenAccess'). */
export const activityKey = (type: ActivityType) => type.replace(/\s/g, '')

export const emptyTranslated = (): Translated => ({ ar: '', en: '' })

/** Errors of a translated field: `name.ar`, `name.en` or `name` itself. */
export function translatedErrors(errors: Record<string, string[]>, field: string) {
  return {
    ar: errors[`${field}.ar`]?.[0],
    en: errors[`${field}.en`]?.[0],
    any: errors[field]?.[0],
  }
}

/** Durations as "1 h 30 min" pieces for display. */
export function durationParts(minutes: number): { h: number; m: number } {
  return { h: Math.floor(minutes / 60), m: minutes % 60 }
}

/** "Term · 1 Sep – 15 Jan" or "Rolling monthly". */
export function programEnrollment(
  p: Program,
  t: (key: string) => string,
  format: { date: (iso: string, zone?: string) => string },
): string {
  const day = (ymd: string) => format.date(`${ymd}T00:00:00Z`, 'UTC')
  return p.enrollment_mode === 'Term' && p.term_start && p.term_end
    ? `${t('programs.modes.Term')} · ${day(p.term_start)} – ${day(p.term_end)}`
    : t('programs.modes.Rolling')
}

/** Appointment slot intervals (US-03.09), as on the backend (Service::SLOT_INTERVALS). */
export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120]

/** Options for the slot interval picker: back to back (the duration), then every N minutes. */
export function useSlotIntervals() {
  const { t } = useI18n()
  return (duration: number | null) => [
    { value: null, label: t('catalog.slotBackToBack', { n: duration ?? 0 }) },
    ...SLOT_INTERVALS.map((n) => ({ value: n, label: t('catalog.slotEvery', { n }) })),
  ]
}
