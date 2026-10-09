import { describe, expect, it } from 'vitest'
import { activityKey, durationParts, translatedErrors } from '@/lib/catalog'

describe('catalog helpers', () => {
  it('maps translated field errors', () => {
    const errors = { 'name.ar': ['Arabic needed'], name: ['Invalid'] }
    expect(translatedErrors(errors, 'name')).toEqual({
      ar: 'Arabic needed',
      en: undefined,
      any: 'Invalid',
    })
  })

  it('splits durations and makes activity keys', () => {
    expect(durationParts(90)).toEqual({ h: 1, m: 30 })
    expect(activityKey('Open Access')).toBe('OpenAccess')
  })
})
