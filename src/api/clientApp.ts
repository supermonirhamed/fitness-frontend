import { http } from '@/lib/http'
import type { Translated } from '@/api/tenant'

// The client app's API (EP-11): /api/app/* on the organization's subdomain, with the client's own
// cookie session (separate from staff sign-in).

export interface ClientAppConfig {
  enabled: boolean
  name: string
  logo_url: string | null
  primary_color: string
  currency: string
  timezone: string
  locale: 'ar' | 'en'
  contact: {
    phone: string | null
    email: string | null
    address: string | null
    website: string | null
  }
  self_registration: boolean
  otp_sign_in: boolean
  terms_url: string | null
  privacy_url: string | null
  features: Record<
    | 'online_booking'
    | 'online_sales'
    | 'show_prices'
    | 'show_coaches'
    | 'book_before_payment'
    | 'self_freeze'
    | 'online_academy_enrollment',
    boolean
  >
  locations: { id: number; name: string }[]
}

export interface ClientAccount {
  id: number
  verified: boolean
  email: string | null
  mobile: string | null
  client: {
    id: number
    member_id: string | null
    first_name: string
    last_name: string
    preferred_language: 'ar' | 'en' | null
    has_photo: boolean
  } | null
  pending: { first_name: string; last_name: string; preferred_language: 'ar' | 'en' } | null
  is_guardian: boolean
}

/** Local machines get the code back so sign-up can be tried without email or SMS. */
interface WithDevCode<T> {
  data: T
  dev_code?: string | null
}

export type NotificationType = 'reminders' | 'waitlist' | 'payments' | 'marketing'
export type NotificationChannel = 'email' | 'sms' | 'push'
export type Preferences = Record<NotificationType, Record<NotificationChannel, boolean>>

export interface ClientProfile extends ClientAccount {
  profile: {
    first_name: string
    last_name: string
    email: string | null
    mobile: string | null
    date_of_birth: string | null
    gender: 'female' | 'male' | null
    home_location_id: number | null
    home_location: string | null
    preferred_language: 'ar' | 'en' | null
    marketing_consent: boolean
    has_photo: boolean
    has_health_notes: boolean
  }
  emergency_contacts: { name: string; relation: string; phone: string }[]
  preferences: Preferences
}

export interface DeletionSummary {
  active: { id: number; name: string; status: string; ends_on: string | null }[]
  balance: { owed: number; overdue: number; oldest_due_on: string | null } | null
  currency: string
  request: { id: number; status: string; created_at: string; due_on: string } | null
  days: number
}

export interface AppBooking {
  id: number
  status: string
  entitlement_source: string
  session: {
    id: number
    starts_at: string
    ends_at: string
    date: string
    time: string
    timezone: string | null
    service: string
    location: string | null
    facility: string | null
    coach: string | null
  }
}

export interface AppHome {
  client: { first_name: string; member_id: string | null }
  next_booking: (AppBooking & { check_in_open: boolean }) | null
  entitlements: {
    id: number
    name: string
    kind: 'membership' | 'package'
    status: string
    ends_on: string | null
    credits_left: number | null
    credits_total: number | null
    shared_by: string | null
  }[]
  alerts: {
    expiring: { id: number; name: string; ends_on: string }[]
    balance: { owed: number; overdue: number; oldest_due_on: string | null } | null
    waivers: { id: number; name: string; state: 'missing' | 'resign' }[]
  }
  book_again: { service_id: number; name: string | null; location_id: number }[]
  children: { id: number; first_name: string; next_booking: AppBooking | null }[]
  offers: { id: number; name: string; kind: string; price: number | null }[]
}

export interface AppCatalog {
  locations: { id: number; name: string; timezone: string }[]
  categories: { id: number; name: string | null; color: string | null }[]
  services: { id: number; name: string | null; category_id: number; skill_level: string }[]
  coaches: { id: number; name: string }[]
  days_ahead: number
}

export interface AppSession {
  id: number
  starts_at: string
  ends_at: string
  date: string
  time: string
  timezone: string | null
  duration: number
  service: {
    id: number
    name: string | null
    color: string | null
    category: string | null
    skill_level: string
  }
  coach: { id: number; name: string } | null
  location: { id: number; name: string | null }
  facility: string | null
  capacity: number | null
  spots_left: number | null
  state: 'available' | 'almost' | 'full' | 'full_waitlist' | 'cancelled'
  opens_at: string | null
  price: { kind: 'included' | 'free' | 'drop_in'; amount: number | null } | null
  mine: { state: 'booked' | 'waitlisted'; booking_id?: number; position?: number | null } | null
}

export type BookingAction =
  | 'booked'
  | 'waitlisted'
  | 'book_with_entitlement'
  | 'book'
  | 'book_pay_at_desk'
  | 'join_waitlist'
  | 'buy'
  | 'unavailable'

export interface AppSessionDetails extends AppSession {
  description: Translated | null
  equipment_notes: string | null
  location: {
    id: number
    name: string | null
    address: string | null
    phone: string | null
    map_url: string | null
  }
  policy: {
    cancellation_window_hours: number
    late_cancel_penalty: 'none' | 'consume_credit' | 'fixed_fee'
    late_cancel_fee: number | null
    no_show_penalty: string
    waitlist_mode: 'manual' | 'automatic'
  }
  eligibility: {
    action: BookingAction
    reasons: { code: string; message: string }[]
    entitlements: string[]
    options: {
      id: number
      source: 'membership' | 'package'
      name: string
      credits_left: number | null
      ends_on: string | null
      shared_by: string | null
    }[]
    credit_cost: number | null
  }
  products: {
    id: number
    name: string
    kind: string
    intro_offer: boolean
    price: number | null
    currency: string
  }[]
}

export interface BookingResult extends AppBooking {
  payment: { status: string; price: number | null; due: number | null; currency: string }
}

export type ScheduleFilters = {
  location_id?: number | null
  category_id?: number | null
  service_id?: number | null
  coach_id?: number | null
  time_of_day?: 'morning' | 'afternoon' | 'evening' | null
  level?: string | null
  q?: string | null
}

export const clientApi = {
  async config(): Promise<ClientAppConfig> {
    return (await http.get('/api/app/config')).data.data
  },
  auth: {
    async me(): Promise<ClientAccount> {
      return (await http.get('/api/app/auth/me')).data.data
    },
    async register(input: {
      first_name: string
      last_name: string
      email: string
      mobile: string
      password: string
      password_confirmation: string
      preferred_language: 'ar' | 'en'
      home_location_id: number | null
      accept_terms: boolean
      channel: 'email' | 'sms'
    }): Promise<WithDevCode<ClientAccount>> {
      return (await http.post('/api/app/auth/register', input)).data
    },
    async verify(channel: 'email' | 'sms', code: string): Promise<ClientAccount> {
      return (await http.post('/api/app/auth/verify', { channel, code })).data.data
    },
    async resend(channel: 'email' | 'sms'): Promise<WithDevCode<{ sent: boolean }>> {
      return (await http.post('/api/app/auth/verify/resend', { channel })).data
    },
    async login(login: string, password: string, remember: boolean): Promise<ClientAccount> {
      return (await http.post('/api/app/auth/login', { login, password, remember })).data.data
    },
    async sendSignInCode(mobile: string): Promise<WithDevCode<{ sent: boolean }>> {
      return (await http.post('/api/app/auth/sign-in-code', { mobile })).data
    },
    async loginWithCode(mobile: string, code: string): Promise<ClientAccount> {
      return (await http.post('/api/app/auth/sign-in-with-code', { mobile, code })).data.data
    },
    async forgot(login: string): Promise<WithDevCode<{ sent: boolean }>> {
      return (await http.post('/api/app/auth/forgot-password', { login })).data
    },
    async reset(input: {
      login: string
      code: string
      password: string
      password_confirmation: string
    }): Promise<void> {
      await http.post('/api/app/auth/reset-password', input)
    },
    async logout(): Promise<void> {
      await http.post('/api/app/auth/logout')
    },
  },
  profile: {
    async get(): Promise<ClientProfile> {
      return (await http.get('/api/app/profile')).data.data
    },
    async update(input: {
      first_name: string
      last_name: string
      date_of_birth: string | null
      gender: 'female' | 'male' | null
      home_location_id: number | null
      preferred_language: 'ar' | 'en'
      marketing_consent: boolean
    }): Promise<ClientProfile> {
      return (await http.put('/api/app/profile', input)).data.data
    },
    async emergencyContacts(contacts: ClientProfile['emergency_contacts']): Promise<ClientProfile> {
      return (await http.put('/api/app/profile/emergency-contacts', { contacts })).data.data
    },
    async healthNotes(health_notes: string | null): Promise<ClientProfile> {
      return (await http.put('/api/app/profile/health-notes', { health_notes })).data.data
    },
    async preferences(preferences: Preferences): Promise<ClientProfile> {
      return (await http.put('/api/app/profile/preferences', { preferences })).data.data
    },
    async uploadPhoto(file: File): Promise<ClientProfile> {
      const body = new FormData()
      body.append('photo', file)
      return (await http.post('/api/app/profile/photo', body)).data.data
    },
    async deletePhoto(): Promise<void> {
      await http.delete('/api/app/profile/photo')
    },
    async requestContactChange(
      field: 'email' | 'mobile',
      value: string,
    ): Promise<WithDevCode<{ sent: boolean }>> {
      return (await http.post('/api/app/profile/contact', { field, value })).data
    },
    async confirmContactChange(
      field: 'email' | 'mobile',
      value: string,
      code: string,
    ): Promise<ClientProfile> {
      return (await http.post('/api/app/profile/contact/confirm', { field, value, code })).data.data
    },
    async deletion(): Promise<DeletionSummary> {
      return (await http.get('/api/app/profile/deletion')).data.data
    },
    async requestDeletion(password: string, reason: string | null): Promise<DeletionSummary> {
      return (await http.post('/api/app/profile/deletion', { password, reason })).data.data
    },
    async cancelDeletion(): Promise<DeletionSummary> {
      return (await http.delete('/api/app/profile/deletion')).data.data
    },
  },
  async home(): Promise<AppHome> {
    return (await http.get('/api/app/home')).data.data
  },
  async catalog(): Promise<AppCatalog> {
    return (await http.get('/api/app/catalog')).data.data
  },
  async day(date: string, filters: ScheduleFilters): Promise<AppSession[]> {
    const params = Object.fromEntries(
      Object.entries({ date, ...filters }).filter(
        ([, v]) => v !== null && v !== undefined && v !== '',
      ),
    )
    return (await http.get('/api/app/sessions', { params })).data.data
  },
  async session(id: number): Promise<AppSessionDetails> {
    return (await http.get(`/api/app/sessions/${id}`)).data.data
  },
  async book(
    id: number,
    input: { entitlement_source?: string | null; entitlement_id?: number | null },
  ): Promise<BookingResult> {
    return (await http.post(`/api/app/sessions/${id}/book`, input)).data.data
  },
  async joinWaitlist(id: number): Promise<{ id: number; position: number | null }> {
    return (await http.post(`/api/app/sessions/${id}/waitlist`, {})).data.data
  },
  calendarUrl(bookingId: number): string {
    return `/api/app/bookings/${bookingId}/calendar.ics`
  },
  photoUrl(): string {
    return '/api/app/profile/photo'
  },
  qrUrl(): string {
    return '/api/app/profile/qr'
  },
}
