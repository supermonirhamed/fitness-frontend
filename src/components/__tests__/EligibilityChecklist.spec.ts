import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n, setLocale } from '@/i18n'
import EligibilityChecklist from '../bookings/EligibilityChecklist.vue'
import type { BookingEligibility, EligibilityCheck } from '@/api/tenant'

const ORDER: EligibilityCheck[] = [
  'session',
  'window',
  'client',
  'restrictions',
  'capacity',
  'duplicate',
  'overlap',
  'waivers',
  'entitlement',
]

const result = (
  failed: Partial<Record<EligibilityCheck, string>>,
  overridden: EligibilityCheck[] = [],
) =>
  ({
    ok: Object.keys(failed).length === 0,
    reasons: Object.entries(failed)
      .filter(([check]) => !overridden.includes(check as EligibilityCheck))
      .map(([check, message]) => ({ code: check, check, message, params: {}, overridable: false })),
    checks: ORDER.map((check) => ({
      check,
      passed: !(check in failed),
      overridden: overridden.includes(check),
      reasons: check in failed ? [check] : [],
      params: {},
    })),
    can_waitlist: false,
    entitlements: ['pay_at_desk'],
  }) as BookingEligibility

const render = (props: { result: BookingEligibility }) =>
  mount(EligibilityChecklist, { props, global: { plugins: [i18n] } })

describe('EligibilityChecklist', () => {
  it('lists every check in order, with the server reason when one fails (US-04.01)', () => {
    setLocale('en')
    const items = render({
      result: result({ client: 'This client is blocked and can’t book.' }),
    }).findAll('li')

    expect(items).toHaveLength(9)
    expect(items[0]!.text()).toBe('Session open for booking')
    expect(items[2]!.classes()).toContain('is-failed')
    expect(items[2]!.text()).toBe('This client is blocked and can’t book.')
    expect(items[6]!.text()).toBe('No overlapping booking')
  })

  it('keeps an overridden check visible, marked as overridden', () => {
    setLocale('en')
    const capacity = render({
      result: result({ capacity: 'This session is full (2/2).' }, ['capacity']),
    }).findAll('li')[4]!

    expect(capacity.classes()).toContain('is-overridden')
    expect(capacity.text()).toBe('Capacity · overridden')
  })
})
