import { describe, expect, it } from 'vitest'
import { allowedSettingsPages, specialActions } from '../permissions'

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
    expect(allowedSettingsPages(can([]))).toEqual([])
  })
})
