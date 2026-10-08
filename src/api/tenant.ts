import { csrfCookie, http } from '@/lib/http'

export interface Organization {
  name: string
  slug: string
  locale: 'ar' | 'en'
}

export interface StaffUser {
  id: number
  name: string
  email: string
  locale: 'ar' | 'en' | null
  roles: string[]
}

export const tenantApi = {
  async organization(): Promise<Organization> {
    return (await http.get('/api/organization')).data.data
  },
  async login(email: string, password: string, remember: boolean): Promise<StaffUser> {
    await csrfCookie()
    return (await http.post('/api/auth/login', { email, password, remember })).data.data
  },
  async me(): Promise<StaffUser> {
    return (await http.get('/api/auth/me')).data.data
  },
  async logout(): Promise<void> {
    await http.post('/api/auth/logout')
  },
}
