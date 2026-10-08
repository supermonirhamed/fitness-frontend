import { csrfCookie, http } from '@/lib/http'

export type TenantStatus = 'Provisioning' | 'Failed' | 'Active' | 'Suspended'

export interface Tenant {
  id: string
  name: string
  slug: string
  domain: string
  url: string
  status: TenantStatus
  owner_name: string
  owner_email: string
  currency: string
  timezone: string
  locale: 'ar' | 'en'
  provisioning_error: string | null
  provisioned_at: string | null
  created_at: string
}

export interface SuperAdmin {
  id: number
  name: string
  email: string
}

export type NewTenant = Pick<
  Tenant,
  'name' | 'slug' | 'owner_name' | 'owner_email' | 'currency' | 'timezone' | 'locale'
>

export interface SlugAvailability {
  slug: string
  available: boolean
  reason: 'invalid' | 'reserved' | 'taken' | null
  domain: string
}

export const platformApi = {
  async login(email: string, password: string, remember: boolean): Promise<SuperAdmin> {
    await csrfCookie()
    return (await http.post('/api/platform/auth/login', { email, password, remember })).data.data
  },
  async me(): Promise<SuperAdmin> {
    return (await http.get('/api/platform/auth/me')).data.data
  },
  async logout(): Promise<void> {
    await http.post('/api/platform/auth/logout')
  },
  async tenants(
    page = 1,
  ): Promise<{ data: Tenant[]; meta: { total: number; per_page: number; current_page: number } }> {
    return (await http.get('/api/platform/tenants', { params: { page } })).data
  },
  async tenant(id: string): Promise<Tenant> {
    return (await http.get(`/api/platform/tenants/${id}`)).data.data
  },
  async createTenant(payload: NewTenant): Promise<Tenant> {
    return (await http.post('/api/platform/tenants', payload)).data.data
  },
  async retryProvisioning(id: string): Promise<Tenant> {
    return (await http.post(`/api/platform/tenants/${id}/retry-provisioning`)).data.data
  },
  async slugAvailability(slug: string): Promise<SlugAvailability> {
    return (await http.get('/api/platform/tenants/slug-availability', { params: { slug } })).data
  },
}

export const CURRENCIES = ['SAR', 'AED', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'JOD', 'USD', 'EUR']
