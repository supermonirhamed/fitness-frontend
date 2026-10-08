import type { BookingPolicy, BookingPolicyOverrides, Penalty } from '@/api/tenant'

/** The overridable settings (US-01.02), grouped as on screen. A penalty carries its fee. */
export const POLICY_GROUPS = {
  booking: ['booking_opens_days', 'booking_closes_minutes'],
  cancellation: ['cancellation_window_hours', 'late_cancel_penalty'],
  noShow: ['no_show_penalty'],
  waitlist: ['waitlist_mode', 'waitlist_closes_minutes'],
} as const

export type PolicyField = (typeof POLICY_GROUPS)[keyof typeof POLICY_GROUPS][number]

export const FEE_OF = {
  late_cancel_penalty: 'late_cancel_fee',
  no_show_penalty: 'no_show_fee',
} as const

export const POLICY_FIELDS: PolicyField[] = Object.values(POLICY_GROUPS).flat()

export const isPenalty = (field: string): field is keyof typeof FEE_OF => field in FEE_OF

/** Every setting null (inherit), then the ones a level overrides. */
export function toOverrides(set: Partial<BookingPolicy> = {}): BookingPolicyOverrides {
  return {
    booking_opens_days: set.booking_opens_days ?? null,
    booking_closes_minutes: set.booking_closes_minutes ?? null,
    cancellation_window_hours: set.cancellation_window_hours ?? null,
    late_cancel_penalty: set.late_cancel_penalty ?? null,
    late_cancel_fee: set.late_cancel_fee ?? null,
    no_show_penalty: set.no_show_penalty ?? null,
    no_show_fee: set.no_show_fee ?? null,
    waitlist_closes_minutes: set.waitlist_closes_minutes ?? null,
    waitlist_mode: set.waitlist_mode ?? null,
  }
}

/** Starts or stops overriding a setting: it starts from the inherited value (and fee). */
export function setOverride(
  overrides: BookingPolicyOverrides,
  field: PolicyField,
  on: boolean,
  inherited: BookingPolicy,
): BookingPolicyOverrides {
  const next = { ...overrides, [field]: on ? inherited[field] : null }
  if (isPenalty(field)) next[FEE_OF[field]] = on ? inherited[FEE_OF[field]] : null
  return next
}

/** A penalty change clears the fee unless it is (still) a fixed fee. */
export function feeAfterPenaltyChange(penalty: Penalty | null, fee: number | null): number | null {
  return penalty === 'fixed_fee' ? fee : null
}
