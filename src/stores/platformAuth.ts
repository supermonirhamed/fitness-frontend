import { defineStore } from 'pinia'
import { ref } from 'vue'
import { platformApi, type SuperAdmin } from '@/api/platform'
import { statusOf } from '@/lib/http'

export const usePlatformAuth = defineStore('platformAuth', () => {
  const admin = ref<SuperAdmin | null>(null)
  const checked = ref(false)

  async function check(): Promise<boolean> {
    if (!checked.value) {
      try {
        admin.value = await platformApi.me()
      } catch (e) {
        if (statusOf(e) !== 401) throw e
        admin.value = null
      }
      checked.value = true
    }
    return admin.value !== null
  }

  async function login(email: string, password: string, remember: boolean) {
    admin.value = await platformApi.login(email, password, remember)
    checked.value = true
  }

  async function logout() {
    await platformApi.logout()
    admin.value = null
  }

  return { admin, checked, check, login, logout }
})
