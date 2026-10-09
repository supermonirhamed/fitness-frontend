import { describe, expect, it } from 'vitest'
import { splitInto, typeKey } from '@/lib/facilities'

describe('facility helpers', () => {
  it('splits a facility into numbered sub-areas sharing the capacity', () => {
    expect(splitInto(3, 'Lane', 32)).toEqual([
      { id: null, name: 'Lane 1', capacity: 10 },
      { id: null, name: 'Lane 2', capacity: 10 },
      { id: null, name: 'Lane 3', capacity: 10 },
    ])
    expect(splitInto(4, 'Half', 2).every((r) => r.capacity === 1)).toBe(true)
  })

  it('makes i18n keys from type names', () => {
    expect(typeKey('Gym Area')).toBe('GymArea')
    expect(typeKey('Pool')).toBe('Pool')
  })
})
