import { describe, expect, it } from 'vitest'
import type { BookingPolicy } from '@/api/tenant'
import { POLICY_FIELDS, feeAfterPenaltyChange, setOverride, toOverrides } from '../bookingPolicy'

const org: BookingPolicy = {
  booking_opens_days: 14,
  booking_closes_minutes: 0,
  cancellation_window_hours: 12,
  late_cancel_penalty: 'fixed_fee',
  late_cancel_fee: 30,
  no_show_penalty: 'consume_credit',
  no_show_fee: null,
  waitlist_closes_minutes: 60,
  waitlist_mode: 'automatic',
}

describe('booking policy helpers', () => {
  it('lists the seven overridable settings', () => {
    expect(POLICY_FIELDS).toHaveLength(7)
  })

  it('fills missing overrides with null (inherit)', () => {
    const overrides = toOverrides({ waitlist_mode: 'manual' })
    expect(overrides.waitlist_mode).toBe('manual')
    expect(overrides.cancellation_window_hours).toBeNull()
    expect(Object.keys(overrides)).toHaveLength(9)
  })

  it('starts an override from the inherited value, fee included, and clears it again', () => {
    const on = setOverride(toOverrides(), 'late_cancel_penalty', true, org)
    expect([on.late_cancel_penalty, on.late_cancel_fee]).toEqual(['fixed_fee', 30])

    const off = setOverride(on, 'late_cancel_penalty', false, org)
    expect([off.late_cancel_penalty, off.late_cancel_fee]).toEqual([null, null])

    expect(setOverride(toOverrides(), 'booking_opens_days', true, org).booking_opens_days).toBe(14)
  })

  it('keeps a fee only for a fixed-fee penalty', () => {
    expect(feeAfterPenaltyChange('fixed_fee', 20)).toBe(20)
    expect(feeAfterPenaltyChange('none', 20)).toBeNull()
  })
})
