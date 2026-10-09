import type { ActivityType, Translated } from '@/api/tenant'

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
