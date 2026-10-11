import type { FacilityType } from '@/api/tenant'

/** PrimeIcons for each facility type (US-01.08). */
export const FACILITY_ICONS: Record<FacilityType, string> = {
  Room: 'pi-box',
  Studio: 'pi-objects-column',
  Field: 'pi-flag',
  Pool: 'pi-wave-pulse',
  'Gym Area': 'pi-bolt',
  Court: 'pi-stop',
  Other: 'pi-map-marker',
}

/** i18n key segment of a type ('Gym Area' → 'GymArea'). */
export const typeKey = (type: FacilityType) => type.replace(/\s/g, '')

/**
 * Sub-area rows named after the facility type's usual parts, e.g. "Lane 1…6" for a pool,
 * splitting the capacity evenly (rounded down, at least 1).
 */
export function splitInto(count: number, prefix: string, capacity: number) {
  const each = Math.max(1, Math.floor(capacity / count))
  return Array.from({ length: count }, (_, i) => ({
    id: null,
    name: `${prefix} ${i + 1}`,
    capacity: each,
  }))
}
