import { describe, expect, it } from 'vitest'
import { actionKey, fieldChanges, isoDay } from '../audit'

describe('fieldChanges', () => {
  it('pairs before and after per field', () => {
    expect(fieldChanges({ status: 'Active' }, { status: 'Deactivated' })).toEqual([
      { field: 'status', before: 'Active', after: 'Deactivated' },
    ])
    expect(fieldChanges(null, { name: 'Night shift' })).toEqual([
      { field: 'name', before: undefined, after: 'Night shift' },
    ])
  })

  it('shows lists as added and removed items', () => {
    const [change] = fieldChanges(
      { permissions: ['a.view', 'b.view'] },
      { permissions: ['b.view', 'c.view'] },
    )
    expect(change?.added).toEqual(['c.view'])
    expect(change?.removed).toEqual(['a.view'])
  })
})

describe('helpers', () => {
  it('builds translation keys and API days', () => {
    expect(actionKey('settings.security.updated')).toBe('settings_security_updated')
    expect(isoDay(new Date(2026, 9, 8))).toBe('2026-10-08')
  })
})
