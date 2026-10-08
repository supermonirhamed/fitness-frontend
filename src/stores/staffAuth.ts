import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { needsTwoFactor, tenantApi, type SecondFactor, type StaffUser } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { resolveLocale, setLocale } from '@/i18n'
import { useOrganization } from '@/stores/organization'

export const useStaffAuth = defineStore('staffAuth', () => {
  const user = ref<StaffUser | null>(null)
  const checked = ref(false)
  const signedIn = computed(() => user.value !== null)
  const permissions = computed(() => new Set(user.value?.permissions ?? []))

  /** True when the user has every given permission (US-00.07). */
  function can(...required: string[]): boolean {
    return required.every((p) => permissions.value.has(p))
  }

  /** Loads the signed-in user once; `refresh` reloads it (e.g. after a security setting changed). */
  async function check(refresh = false): Promise<boolean> {
    if (!checked.value || refresh) {
      try {
        user.value = await tenantApi.me()
        applyUserLocale()
      } catch (e) {
        if (statusOf(e) !== 401) throw e
        user.value = null
      }
      checked.value = true
    }
    return user.value !== null
  }

  /** Returns 'two_factor' when the password was right but a code is still needed (see challenge()). */
  async function login(
    email: string,
    password: string,
    remember: boolean,
  ): Promise<'signed_in' | 'two_factor'> {
    const result = await tenantApi.login(email, password, remember)
    if (needsTwoFactor(result)) return 'two_factor'
    adopt(result)
    return 'signed_in'
  }

  async function challenge(factor: SecondFactor) {
    adopt(await tenantApi.twoFactorChallenge(factor))
  }

  /** Use the user the API just signed in (after accepting an invitation or resetting a password). */
  function adopt(signedInUser: StaffUser) {
    user.value = signedInUser
    checked.value = true
    applyUserLocale()
  }

  /** The user's own language, else the organization's (US-00.13). */
  function applyUserLocale() {
    if (!user.value) return
    const organization = useOrganization().organization?.locale ?? null
    setLocale(resolveLocale({ signedIn: true, user: user.value.locale, organization }), true)
  }

  async function logout() {
    try {
      await tenantApi.logout()
    } finally {
      forget()
    }
  }

  /** Drop the local user without calling the API (e.g. the server already ended the session). */
  function forget() {
    user.value = null
    checked.value = true
  }

  return { user, checked, signedIn, can, check, login, challenge, adopt, logout, forget }
})
