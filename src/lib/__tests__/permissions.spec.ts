import { describe, expect, it } from 'vitest'
import {
  allowedPages,
  allowedSettingsPages,
  landingRouteName,
  permissionDiff,
  specialActions,
  STAFF_PAGES,
} from '../permissions'

describe('permissions helpers', () => {
  it('separates special actions from the standard columns', () => {
    expect(specialActions(['view', 'create', 'refund', 'void'])).toEqual(['refund', 'void'])
    expect(specialActions(['view'])).toEqual([])
  })

  it('lists only the settings pages the user may open', () => {
    const can = (granted: string[]) => (p: string) => granted.includes(p)
    expect(allowedSettingsPages(can(['settings.security'])).map((p) => p.key)).toEqual(['security'])
    const everything = ['settings.view', 'settings.security', 'audit.view']
    expect(allowedSettingsPages(can(everything)).map((p) => p.key)).toEqual([
      'organization',
      'regional',
      'booking',
      'memberships',
      'payments',
      'attendance',
      'security',
      'waivers',
      'audit',
    ])
    expect(allowedSettingsPages(can([]))).toEqual([])
  })

  it('lists the staff pages the user may open', () => {
    const can = (granted: string[]) => (p: string) => granted.includes(p)
    expect(allowedPages(STAFF_PAGES, can(['roles.view'])).map((p) => p.key)).toEqual(['roles'])
    expect(allowedPages(STAFF_PAGES, can(['staff.view', 'roles.view'])).map((p) => p.key)).toEqual([
      'users',
      'roles',
    ])
  })
})

describe('permissionDiff', () => {
  const modules = { bookings: ['view', 'create', 'override'], clients: ['view', 'export'] }

  it('lists added and removed permissions in catalog order', () => {
    expect(
      permissionDiff(
        ['clients.export', 'bookings.view'],
        ['bookings.override', 'bookings.view', 'clients.view'],
        modules,
      ),
    ).toEqual({ added: ['bookings.override', 'clients.view'], removed: ['clients.export'] })
  })

  it('is empty when nothing changed', () => {
    expect(permissionDiff(['bookings.view'], ['bookings.view'], modules)).toEqual({
      added: [],
      removed: [],
    })
  })
})

describe('landingRouteName', () => {
  const can = (granted: string[]) => (p: string) => granted.includes(p)
  it('sends reception and coaches to the calendar', () => {
    expect(landingRouteName(['Receptionist'], can(['schedule.view']))).toBe('tenant.calendar')
    expect(landingRouteName(['Coach'], can(['schedule.view']))).toBe('tenant.calendar')
    expect(landingRouteName(['Organization Owner'], can(['schedule.view']))).toBe('tenant.today')
    expect(landingRouteName(['Coach'], can([]))).toBe('tenant.today')
  })
})
