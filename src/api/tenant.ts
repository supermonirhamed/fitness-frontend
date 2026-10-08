import { http } from '@/lib/http'

export interface Organization {
  name: string
  slug: string
  locale: 'ar' | 'en'
}

export const tenantApi = {
  async organization(): Promise<Organization> {
    return (await http.get('/api/organization')).data.data
  },
}
