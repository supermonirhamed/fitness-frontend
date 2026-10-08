import { describe, expect, it } from 'vitest'
import { resolveAppContext, tenantDomain } from '../appContext'

describe('resolveAppContext', () => {
  it('treats the central domain as the platform console', () => {
    expect(resolveAppContext('fitness.test')).toEqual({ kind: 'platform' })
    expect(resolveAppContext('localhost')).toEqual({ kind: 'platform' })
  })

  it('resolves an organization from its subdomain', () => {
    expect(resolveAppContext('eliteclub.fitness.test')).toEqual({
      kind: 'tenant',
      slug: 'eliteclub',
    })
  })

  it('ignores nested subdomains', () => {
    expect(resolveAppContext('a.b.fitness.test')).toEqual({ kind: 'platform' })
  })

  it('builds tenant domains', () => {
    expect(tenantDomain('eliteclub')).toBe('eliteclub.fitness.test')
  })
})
