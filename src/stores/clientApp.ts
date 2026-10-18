import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { clientApi, type ClientAccount, type ClientAppConfig } from '@/api/clientApp'
import { statusOf } from '@/lib/http'
import { applyBrandColor } from '@/lib/brand'
import { hasSavedLocale, setLocale } from '@/i18n'

/**
 * The client app (EP-11): the organization's app setup (brand, features, whether it is on) and the
 * signed-in client's account, which is separate from staff sign-in.
 */
export const useClientApp = defineStore('clientApp', () => {
  const config = ref<ClientAppConfig | null>(null)
  const account = ref<ClientAccount | null>(null)
  const checked = ref(false)
  const signedIn = computed(() => account.value !== null)
  const verified = computed(() => account.value?.verified ?? false)
  const firstName = computed(
    () => account.value?.client?.first_name ?? account.value?.pending?.first_name ?? '',
  )

  async function loadConfig(): Promise<ClientAppConfig> {
    if (!config.value) {
      config.value = await clientApi.config()
      applyBrandColor(config.value.primary_color)
      installable()
    }
    return config.value
  }

  async function check(refresh = false): Promise<boolean> {
    if (!checked.value || refresh) {
      try {
        adopt(await clientApi.auth.me())
      } catch (e) {
        if (statusOf(e) !== 401 && statusOf(e) !== 403) throw e
        account.value = null
      }
      checked.value = true
    }
    return signedIn.value
  }

  /** Signed in: their own language wins over the organization's (US-00.13). */
  function adopt(next: ClientAccount) {
    account.value = next
    checked.value = true
    const language = next.client?.preferred_language ?? next.pending?.preferred_language
    if (language && !hasSavedLocale()) setLocale(language)
  }

  async function logout() {
    await clientApi.auth.logout().catch(() => null)
    forget()
  }

  function forget() {
    account.value = null
    checked.value = true
  }

  return {
    config,
    account,
    checked,
    signedIn,
    verified,
    firstName,
    loadConfig,
    check,
    adopt,
    logout,
    forget,
  }
})

/** The manifest and service worker that make the app installable (US-11.01). */
function installable() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/api/app/manifest.webmanifest'
    document.head.appendChild(link)
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/app-sw.js', { scope: '/app' }).catch(() => null)
  }
}
