import { describe, expect, it } from 'vitest'
import { passwordProblems } from '../password'

describe('passwordProblems', () => {
  it('accepts 8+ characters that are confirmed', () => {
    expect(passwordProblems('strong-pass', 'strong-pass')).toEqual({})
  })

  it('flags short, overlong and unconfirmed passwords', () => {
    expect(passwordProblems('short1', 'short1')).toEqual({ password: 'tooShort' })
    expect(passwordProblems('x'.repeat(201), 'x'.repeat(201))).toEqual({ password: 'tooLong' })
    expect(passwordProblems('strong-pass', 'strong-pas')).toEqual({ confirmation: 'mismatch' })
  })
})
