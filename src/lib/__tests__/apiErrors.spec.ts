import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { linkProblem, signInError } from '../apiErrors'

const fail = (status: number, data: unknown = {}) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  })

describe('signInError', () => {
  it('maps each server answer to a sign-in state', () => {
    expect(signInError(fail(422))).toEqual({ kind: 'invalid' })
    expect(signInError(fail(403, { errors: { email: ['deactivated'] } }))).toEqual({
      kind: 'deactivated',
    })
    expect(signInError(fail(403, { code: 'tenant_suspended' }))).toEqual({ kind: 'suspended' })
    expect(signInError(fail(410, { code: 'two_factor_expired' }))).toEqual({
      kind: 'twoFactorExpired',
    })
    expect(signInError(fail(500))).toEqual({ kind: 'generic' })
    expect(signInError(new Error('offline'))).toEqual({ kind: 'generic' })
  })

  it('reads the throttle wait time', () => {
    const error = fail(429, { errors: { email: ['Too many attempts. Try again in 42 seconds.'] } })
    expect(signInError(error)).toEqual({ kind: 'throttled', seconds: 42 })
  })

  it('reads the wait time of a locked 2FA code step', () => {
    const error = fail(429, { errors: { code: ['Too many attempts. Try again in 17 seconds.'] } })
    expect(signInError(error)).toEqual({ kind: 'throttled', seconds: 17 })
  })
})

describe('linkProblem', () => {
  it('reads why an emailed link cannot be used', () => {
    expect(linkProblem(fail(410, { code: 'link_expired' }))).toBe('expired')
    expect(linkProblem(fail(410, { code: 'link_used' }))).toBe('used')
    expect(linkProblem(fail(410, { code: 'link_invalid' }))).toBe('invalid')
    expect(linkProblem(fail(410))).toBe('invalid')
  })

  it('ignores other failures', () => {
    expect(linkProblem(fail(422))).toBeNull()
    expect(linkProblem(new Error('offline'))).toBeNull()
  })
})
