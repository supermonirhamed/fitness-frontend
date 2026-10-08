import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tenantApi, type StaffUser } from '@/api/tenant'
import { statusOf } from '@/lib/http'

export const useStaffAuth = defineStore('staffAuth', () => {
  const user = ref<StaffUser | null>(null)
  const checked = ref(false)
  const signedIn = computed(() => user.value !== null)

  async function check(): Promise<boolean> {
    if (!checked.value) {
      try {
        user.value = await tenantApi.me()
      } catch (e) {
        if (statusOf(e) !== 401) throw e
        user.value = null
      }
      checked.value = true
    }
    return user.value !== null
  }

  async function login(email: string, password: string, remember: boolean) {
    user.value = await tenantApi.login(email, password, remember)
    checked.value = true
  }

  /** Use the user the API just signed in (after accepting an invitation or resetting a password). */
  function adopt(signedInUser: StaffUser) {
    user.value = signedInUser
    checked.value = true
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

  return { user, checked, signedIn, check, login, adopt, logout, forget }
})
