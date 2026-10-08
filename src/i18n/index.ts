import { createI18n } from 'vue-i18n'
import en from './en'
import ar from './ar'

export type Locale = 'ar' | 'en'

const STORAGE_KEY = 'locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ar' || saved === 'en') return saved
  } catch {
    // storage unavailable — fall through to the default
  }
  return 'ar' // Arabic is the primary language
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, ar },
  // Western digits in both languages (design system content rules).
  datetimeFormats: {
    en: {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    },
    ar: {
      short: { year: 'numeric', month: 'short', day: 'numeric', numberingSystem: 'latn' },
      long: {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        numberingSystem: 'latn',
      },
    },
  },
})

export function hasSavedLocale(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
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
