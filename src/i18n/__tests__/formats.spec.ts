import { describe, expect, it } from 'vitest'
import { applyOrganizationFormats, i18n, resolveLocale } from '..'

describe('resolveLocale', () => {
  it("uses the signed-in user's choice, else the organization's language", () => {
    expect(resolveLocale({ signedIn: true, user: 'en', saved: 'ar', organization: 'ar' })).toBe(
      'en',
    )
    expect(resolveLocale({ signedIn: true, user: null, saved: 'en', organization: 'ar' })).toBe(
      'ar',
    )
  })

  it('uses the last choice in this browser before sign-in, else the organization, else Arabic', () => {
    expect(resolveLocale({ signedIn: false, saved: 'en', organization: 'ar' })).toBe('en')
    expect(resolveLocale({ signedIn: false, saved: null, organization: 'en' })).toBe('en')
    expect(resolveLocale({ signedIn: false })).toBe('ar')
  })
})

describe('organization formats', () => {
  const { d } = i18n.global
  // Intl puts a non-breaking space between the currency and the amount.
  const n = (value: number, key: string, locale: 'ar' | 'en') =>
    i18n.global.n(value, key, locale).replace(/\u00a0/g, ' ')
  const moment = new Date(Date.UTC(2026, 9, 8, 21, 30)) // 21:30 UTC = 00:30 next day in Riyadh

  it("shows times in the organization's timezone", () => {
    applyOrganizationFormats({ timezone: 'Asia/Riyadh', currency: 'SAR' })
    expect(d(moment, 'short', 'en')).toBe('Oct 9, 2026')
    applyOrganizationFormats({ timezone: 'UTC', currency: 'SAR' })
    expect(d(moment, 'short', 'en')).toBe('Oct 8, 2026')
  })

  it("shows money in the organization's currency with Western digits in both languages", () => {
    applyOrganizationFormats({ timezone: 'Asia/Riyadh', currency: 'SAR' })
    expect(n(1234.5, 'currency', 'en')).toBe('SAR 1,234.50')
    expect(n(1234.5, 'currency', 'ar')).toMatch(/1,234\.50/)
    expect(n(1234.5, 'currency', 'ar')).toMatch(/ر\.س/)

    applyOrganizationFormats({ timezone: 'Asia/Riyadh', currency: 'AED' })
    expect(n(10, 'currency', 'en')).toBe('AED 10.00')
  })
})
