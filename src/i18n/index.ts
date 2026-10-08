import { createI18n } from 'vue-i18n'
import en from './en'
import ar from './ar'

export type Locale = 'ar' | 'en'

const STORAGE_KEY = 'locale'

function savedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'ar' || saved === 'en' ? saved : null
  } catch {
    return null // storage unavailable
  }
}

/**
 * Which language to show (US-00.13): a signed-in user's own choice, else the organization's
 * default; before sign-in, the last choice made in this browser, else the organization's default.
 * Arabic is the primary language.
 */
export function resolveLocale(options: {
  signedIn: boolean
  user?: Locale | null
  saved?: Locale | null
  organization?: Locale | null
}): Locale {
  const own = options.signedIn ? options.user : options.saved
  return own ?? options.organization ?? 'ar'
}

/** Date formats in the organization's timezone (D4: branches get their own later). Western digits in both languages. */
function datetimeFormats(timeZone?: string) {
  const zone = timeZone ? { timeZone } : {}
  const formats = {
    short: { year: 'numeric', month: 'short', day: 'numeric', ...zone },
    long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...zone },
    dateTime: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...zone,
    },
    time: { hour: 'numeric', minute: '2-digit', ...zone },
  } as const
  const latn = Object.fromEntries(
    Object.entries(formats).map(([name, f]) => [name, { ...f, numberingSystem: 'latn' }]),
  )
  return { en: formats, ar: latn }
}

/** Number formats; `currency` uses the organization's currency. */
function numberFormats(currency = 'SAR') {
  const formats = {
    currency: { style: 'currency', currency, currencyDisplay: 'symbol' },
    decimal: { style: 'decimal', maximumFractionDigits: 2 },
    integer: { style: 'decimal', maximumFractionDigits: 0 },
    percent: { style: 'percent', maximumFractionDigits: 1 },
  } as const
  const latn = Object.fromEntries(
    Object.entries(formats).map(([name, f]) => [name, { ...f, numberingSystem: 'latn' }]),
  )
  return { en: formats, ar: latn }
}

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale() ?? 'ar',
  fallbackLocale: 'en',
  messages: { en, ar },
  datetimeFormats: datetimeFormats(),
  numberFormats: numberFormats(),
})

/** Formats dates in the organization's timezone and money in its currency. */
export function applyOrganizationFormats(organization: {
  timezone?: string
  currency?: string
}): void {
  const dates = datetimeFormats(organization.timezone)
  const numbers = numberFormats(organization.currency)
  for (const locale of ['en', 'ar'] as const) {
    i18n.global.setDateTimeFormat(locale, dates[locale])
    i18n.global.setNumberFormat(locale, numbers[locale])
  }
}

export function hasSavedLocale(): boolean {
  return savedLocale() !== null
}

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

/** Switches language and document direction together; RTL is native, not mirrored. */
export function setLocale(locale: Locale, persist = false): void {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  if (!persist) return
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore
  }
}
