import { describe, expect, it } from 'vitest'
import { smsCount } from '@/lib/sms'

describe('smsCount', () => {
  it('counts GSM-7 texts in 160-character parts, 153 when split', () => {
    expect(smsCount('a'.repeat(160))).toEqual({ encoding: 'GSM-7', characters: 160, segments: 1 })
    expect(smsCount('a'.repeat(161)).segments).toBe(2)
    expect(smsCount('a'.repeat(159) + '€').characters).toBe(161)
  })
  it('sends Arabic as UCS-2 in 70-character parts, 67 when split', () => {
    expect(smsCount('ب'.repeat(70))).toEqual({ encoding: 'UCS-2', characters: 70, segments: 1 })
    expect(smsCount('ب'.repeat(71)).segments).toBe(2)
    expect(smsCount('ب'.repeat(135)).segments).toBe(3)
  })
})
