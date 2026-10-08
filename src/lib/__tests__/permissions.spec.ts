import { describe, expect, it } from 'vitest'
import { allowedSettingsPages, permissionDiff, specialActions } from '../permissions'

describe('permissions helpers', () => {
  it('separates special actions from the standard columns', () => {
    expect(specialActions(['view', 'create', 'refund', 'void'])).toEqual(['refund', 'void'])
    expect(specialActions(['view'])).toEqual([])
  })

  it('lists only the settings pages the user may open', () => {
    const can = (granted: string[]) => (p: string) => granted.includes(p)
    expect(allowedSettingsPages(can(['roles.view'])).map((p) => p.key)).toEqual(['roles'])
    expect(
      allowedSettingsPages(can(['roles.view', 'settings.security'])).map((p) => p.key),
    ).toEqual(['roles', 'security'])
    const everything = [
      'settings.view',
      'locations.view',
      'staff.view',
      'roles.view',
      'settings.security',
      'audit.view',
    ]
    expect(allowedSettingsPages(can(everything)).map((p) => p.key)).toEqual([
      'organization',
      'regional',
      'booking',
      'locations',
      'users',
      'roles',
      'security',
      'audit',
    ])
    expect(allowedSettingsPages(can([]))).toEqual([])
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
