import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tenantApi, type Organization } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { hasSavedLocale, setLocale } from '@/i18n'

export type OrganizationState =
  'unknown' | 'ready' | 'suspended' | 'notFound' | 'unavailable' | 'error'

/** The organization behind the current subdomain, and whether it can be used. */
export const useOrganization = defineStore('organization', () => {
  const organization = ref<Organization | null>(null)
  const state = ref<OrganizationState>('unknown')

  async function load(force = false): Promise<OrganizationState> {
    if (state.value === 'ready' && !force) return state.value
    try {
      organization.value = await tenantApi.organization()
      state.value = 'ready'
      if (!hasSavedLocale()) setLocale(organization.value.locale) // org default until the user picks one
    } catch (e) {
      const byStatus = { 403: 'suspended', 404: 'notFound', 503: 'unavailable' } as const
      state.value = byStatus[statusOf(e) as keyof typeof byStatus] ?? 'error'
    }
    return state.value
  }

  return { organization, state, load }
})
