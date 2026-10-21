import { http } from '@/lib/http'
import type {
  AcademyProfile,
  InvoiceDocument,
  ProgressReport,
  Receipt,
  Translated,
} from '@/api/tenant'

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
    /** Mobile and PIN work at the self check-in kiosk (US-08.05). */
    has_kiosk_pin: boolean
  }
  emergency_contacts: { name: string; relation: string; phone: string }[]
  preferences: Preferences
  /** WhatsApp messages need the client's opt-in (US-12.05). */
  whatsapp?: { available: boolean; opted_in: boolean }
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
    waivers: {
      id: number
      name: string
      state: 'missing' | 'resign'
      client_id: number
      for: string | null
    }[]
  }
  book_again: { service_id: number; name: string | null; location_id: number }[]
  children: { id: number; first_name: string; next_booking: AppBooking | null }[]
  offers: { id: number; name: string; kind: string; price: number | null }[]
  academy_offers: AcademyOffers
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
  client_id?: number | null
}

export interface MyBooking {
  id: number
  status: string
  entitlement_source: string
  credits_used: number | null
  penalty: string | null
  penalty_fee: number | null
  cancel_reason: string | null
  event_registration_id: number | null
  session: {
    id: number
    starts_at: string
    date: string
    time: string
    timezone: string | null
    service: string
    location: string | null
    facility: string | null
    coach: string | null
    cancelled: boolean
  }
  can_change: boolean
}

export interface MyWaitlistEntry {
  id: number
  position: number | null
  session: {
    id: number
    starts_at: string
    date: string
    time: string
    service: string
    location: string | null
  }
}

export interface CancelTerms {
  late: boolean
  free_until: string
  penalty: 'none' | 'consume_credit' | 'fixed_fee'
  fee: number | null
  source: string
  credits: number | null
  outcome: 'free' | 'credit_returned' | 'credit_used' | 'fee'
}

export interface SessionBrief {
  id: number
  starts_at: string
  date: string
  time: string
  service: string | null
  location: string | null
  coach: string | null
}

export interface AppointmentService {
  id: number
  name: string | null
  description: Translated | null
  duration: number
  locations: { id: number; name: string; timezone: string; price: number | null }[]
  trainers: { id: number; name: string }[]
  free: boolean
}

export interface AppointmentDay {
  date: string
  slots: {
    start: string
    end: string
    starts_at: string
    coaches: { id: number; name: string }[]
  }[]
}

export interface AppEvent {
  id: number
  name: string | null
  description: Translated | null
  location: { id: number; name: string | null }
  capacity: number
  seats_left: number
  price: number | null
  open: boolean
  reason: string | null
  reason_code: string | null
  registration_closes_on: string | null
  registered: boolean
  sessions: { id: number; starts_at: string; date: string; time: string; ends: string }[]
}

export interface ShopProduct {
  id: number
  name: string
  kind: 'membership' | 'package'
  type: string | null
  description: Translated | null
  billing: string | null
  billing_interval: string | null
  duration_value: number | null
  duration_unit: string | null
  credits: number | null
  validity_days: number | null
  visit_limit: number | null
  visit_period: string | null
  joining_fee: number | null
  min_commitment_months: number | null
  activation: 'purchase' | 'chosen_date' | 'first_use'
  requires_payment: boolean
  intro_offer: boolean
  covers: {
    all_services: boolean
    categories: string[]
    services: string[]
    programs: string[]
    excluded: string[]
    locations: string[]
  }
  prices: { location_id: number; location: string; price: number | null }[]
}

export interface ShopQuote {
  currency: string
  lines: {
    kind: string
    description: string
    unit_price: number
    discount: number
    net: number
    vat: number
    total: number
  }[]
  subtotal: number
  discount: number
  net: number
  vat: number
  vat_rate: string | null
  prices_include_vat: boolean
  total: number
  intro_refusal: { code: string } | null
  start_date_required: boolean
  requires_payment: boolean
  coupon: { code: string; name: string; amount: number } | null
}

export interface MyInvoice {
  id: number
  number: string
  status: string
  location_id: number
  issued_on: string
  due_on: string
  total: number
  paid: number
  balance: number
  overdue: boolean
}

export interface MyEntitlement {
  id: number
  name: string
  kind: 'membership' | 'package'
  status: string
  awaiting_payment: boolean
  starts_on: string | null
  ends_on: string | null
  credits_total: number | null
  credits_left: number | null
  location: string | null
  auto_renew: boolean
  recurring: boolean
  renews_on: string | null
  renewal_amount: number | null
  currency: string
  cancelled: boolean
}

export interface MyMembership extends MyEntitlement {
  history: { kind: string; change: number; balance_after: number; at: string | null }[]
  covers: ShopProduct['covers']
  freeze: { id: number; starts_on: string; ends_on: string; status: string } | null
  freeze_policy: {
    min_days?: number
    max_days?: number
    max_per_year?: number
    fee?: number
  } | null
  can: { auto_renew: boolean; freeze: boolean; cancel: boolean; upgrade: boolean }
}

export interface MyPayments {
  currency: string
  owed: number
  account_credit: number
  invoices: MyInvoice[]
  payments: {
    id: number
    receipt_number: string
    date: string | null
    method: string
    amount: number
    status: string
  }[]
  refunds: {
    id: number
    date: string | null
    amount: number
    destination: string
    method: string
  }[]
}

export interface InboxItem {
  id: number
  type: string
  kind: string
  data: Record<string, unknown>
  read: boolean
  about: string | null
  at: string | null
}

/** A waiver as the app lists it (US-11.21). */
export interface AppWaiver {
  template_id: number
  name: string
  required_for: 'all' | 'services' | 'minors'
  services: string[]
  version: number | null
  state: 'signed' | 'missing' | 'resign'
  signed: {
    id: number
    version: number
    signer_name: string
    on_behalf: boolean
    method: 'typed' | 'drawn'
    signed_at: string
    in_app: boolean
  } | null
}

export interface FamilyWaivers {
  client: { id: number; first_name: string; self: boolean; minor: boolean }
  waivers: AppWaiver[]
}

export interface WaiverToSign {
  template_id: number
  name: Translated
  version: number | null
  content: Translated | null
  client: { id: number; name: string; minor: boolean }
  on_behalf: boolean
}

/** A client's attendance in a period (US-11.22). */
export interface AppAttendance {
  from: string
  to: string
  visits: {
    type: 'session' | 'open_access'
    id: number
    date: string
    time: string
    title: string | null
    location: string | null
    coach: string | null
    status: 'attended' | 'late' | 'no_show' | 'excused' | 'late_cancel'
    method: string | null
  }[]
  summary: {
    attended: number
    no_show: number
    excused: number
    late_cancel: number
    rate: number | null
  }
  streak: { current_weeks: number; best_weeks: number }
}

/** One minute of the client's rotating check-in code (US-11.23). */
export interface CheckInCode {
  code: string
  valid_from: string
  valid_until: string
  svg: string
}

/** What scanning a branch's check-in QR offers (US-11.23). */
export interface BranchCheckIn {
  location: { id: number; name: string }
  bookings: {
    id: number
    client: { id: number; first_name: string | null; self: boolean }
    session: { id: number; service: string; time: string; facility: string | null }
    checked_in: boolean
    can_check_in: boolean
    denials: { code: string; message: string }[]
  }[]
}

/** A coach as clients see them (US-11.24). */
export interface AppCoach {
  id: number
  name: string
  specialties: string[]
  photo_url: string | null
}

export interface AppCoachProfile extends AppCoach {
  bio: string | null
  certifications: string[]
  sessions: (SessionBrief & { duration: number })[]
  appointments: { id: number; name: string | null }[]
}

/** A parent's child (US-11.25). */
export interface FamilyChild {
  id: number
  first_name: string
  last_name: string
  member_id: string | null
  date_of_birth: string | null
  age: number | null
  gender: 'female' | 'male' | null
  relation: 'mother' | 'father' | 'guardian' | 'other'
  permissions: Record<
    'can_book' | 'can_pay' | 'can_view_performance' | 'receives_notifications',
    boolean
  >
  photo_url: string | null
  has_health_notes: boolean
}

export interface FamilyChildProfile extends FamilyChild {
  bookings: { bookings: MyBooking[]; waitlist: MyWaitlistEntry[] }
  enrollments: {
    id: number
    status: string
    program: string | null
    group: string | null
    term: string | null
  }[]
  attendance: { attended: number; no_shows: number; rate: number | null }
  payments: MyInvoice[] | null
}

export interface ChildInput {
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: 'female' | 'male' | null
}

/** Params for a request made for a child; nothing for the client themselves. */
function forWhom(clientId?: number | null): { client_id?: number } {
  return clientId ? { client_id: clientId } : {}
}

/** Academy enrollment in the app (US-11.26). */
export interface AppProgram {
  id: number
  name: string | null
  description: Translated | null
  age_min: number | null
  age_max: number | null
  gender: string
  trials: boolean
}

export interface AppAcademyFees {
  model: 'none' | 'term' | 'instalments' | 'monthly'
  lines: { kind: string; description: string; amount: number; discount: number; due_on: string }[]
  total: number
  instalments: number
  fraction: number
  sibling_discount_percent: number
}

export interface AppAcademyGroup {
  id: number
  name: string | null
  level: string | null
  age_group: string | null
  gender: string
  location: string | null
  coach: string | null
  term: { name: string | null; starts_on: string; ends_on: string | null } | null
  schedule: { weekdays: number[]; start_time: string; minutes: number }[]
  places_left: number
  suitable: boolean
  reasons: { check: string; code: string; message: string }[]
  waivers_missing: boolean
  waitlist: boolean
  trial_sessions: { id: number; starts_at: string; date: string; time: string }[]
  fees: AppAcademyFees | null
}

export interface AcademyOffers {
  waitlist: {
    id: number
    client: { id: number; first_name: string | null }
    program: string | null
    group: string | null
    expires_at: string
  }[]
  reenrollment: {
    id: number
    client: { id: number; first_name: string | null }
    term: string | null
    group: string | null
    deadline: string
  }[]
}

export interface AcademyEnrolled {
  enrollment: { id: number; status: string; starts_on: string }
  invoices: MyInvoice[]
  booked: number
}

/** A child's academy page for their parent (US-11.27): the staff profile, as guardians see it. */
export type ChildAcademy = Omit<AcademyProfile, 'upcoming'> & {
  child: { id: number; first_name: string }
  upcoming: {
    booking_id: number
    session_id: number
    starts_at: string
    group: string | null
    location: string | null
    excused: boolean
    excuse_reason: string | null
  }[]
  announcements: { id: number; title: string; body: string; author: string | null; at: string }[]
  report_terms: { id: number; name: string | null }[]
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
    async preferences(preferences: Preferences, whatsapp?: boolean): Promise<ClientProfile> {
      return (await http.put('/api/app/profile/preferences', { preferences, whatsapp })).data.data
    },
    async uploadPhoto(file: File): Promise<ClientProfile> {
      const body = new FormData()
      body.append('photo', file)
      return (await http.post('/api/app/profile/photo', body)).data.data
    },
    async deletePhoto(): Promise<void> {
      await http.delete('/api/app/profile/photo')
    },
    /** The PIN for the self check-in kiosk (US-08.05); null removes it. */
    async setKioskPin(pin: string | null, confirmation: string | null): Promise<ClientProfile> {
      return (await http.put('/api/app/profile/kiosk-pin', { pin, pin_confirmation: confirmation }))
        .data.data
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
  /** `clientId`: a child the parent books for (US-11.25). */
  async session(id: number, clientId?: number | null): Promise<AppSessionDetails> {
    return (await http.get(`/api/app/sessions/${id}`, { params: forWhom(clientId) })).data.data
  },
  async book(
    id: number,
    input: {
      entitlement_source?: string | null
      entitlement_id?: number | null
      client_id?: number | null
    },
  ): Promise<BookingResult> {
    return (await http.post(`/api/app/sessions/${id}/book`, input)).data.data
  },
  async joinWaitlist(
    id: number,
    clientId?: number | null,
  ): Promise<{ id: number; position: number | null }> {
    return (await http.post(`/api/app/sessions/${id}/waitlist`, forWhom(clientId))).data.data
  },
  bookings: {
    async list(
      scope: 'upcoming' | 'past',
      clientId?: number | null,
    ): Promise<{ bookings: MyBooking[]; waitlist: MyWaitlistEntry[] }> {
      return (
        await http.get('/api/app/bookings', {
          params: { scope, ...(clientId ? { client_id: clientId } : {}) },
        })
      ).data.data
    },
    async cancelTerms(id: number): Promise<CancelTerms> {
      return (await http.get(`/api/app/bookings/${id}/cancel-terms`)).data.data
    },
    async cancel(
      id: number,
    ): Promise<{ id: number; status: string; penalty: string | null; penalty_fee: number | null }> {
      return (await http.post(`/api/app/bookings/${id}/cancel`)).data.data
    },
    async rescheduleOptions(id: number): Promise<SessionBrief[]> {
      return (await http.get(`/api/app/bookings/${id}/reschedule-options`)).data.data
    },
    async reschedule(id: number, sessionId: number): Promise<{ id: number; session_id: number }> {
      return (await http.post(`/api/app/bookings/${id}/reschedule`, { session_id: sessionId })).data
        .data
    },
  },
  /** Reporting an academy training absence ahead (US-11.27); `false` withdraws it. */
  async excuse(bookingId: number, excused: boolean, reason: string | null): Promise<void> {
    await http.post(`/api/app/bookings/${bookingId}/excuse`, { excused, reason })
  },
  waitlist: {
    async leave(id: number): Promise<void> {
      await http.post(`/api/app/waitlist/${id}/leave`)
    },
    async claim(id: number): Promise<{ booking_id: number; session_id: number }> {
      return (await http.post(`/api/app/waitlist/${id}/claim`)).data.data
    },
  },
  appointments: {
    async services(): Promise<AppointmentService[]> {
      return (await http.get('/api/app/appointments/services')).data.data
    },
    async slots(params: {
      service_id: number
      location_id: number
      from: string
      coach_id?: number | null
    }): Promise<AppointmentDay[]> {
      return (await http.get('/api/app/appointments/slots', { params })).data.data
    },
    async book(input: {
      service_id: number
      location_id: number
      starts_at: string
      coach_id?: number | null
      client_id?: number | null
    }): Promise<BookingResult> {
      return (await http.post('/api/app/appointments', input)).data.data
    },
  },
  events: {
    async list(): Promise<AppEvent[]> {
      return (await http.get('/api/app/events')).data.data
    },
    async get(id: number, clientId?: number | null): Promise<AppEvent> {
      return (await http.get(`/api/app/events/${id}`, { params: forWhom(clientId) })).data.data
    },
    async register(
      id: number,
      clientId?: number | null,
    ): Promise<{ id: number; invoice_id: number | null; event: AppEvent }> {
      return (await http.post(`/api/app/events/${id}/register`, forWhom(clientId))).data.data
    },
  },
  shop: {
    async list(clientId?: number | null): Promise<ShopProduct[]> {
      return (await http.get('/api/app/shop', { params: forWhom(clientId) })).data.data
    },
    async quote(
      planId: number,
      input: { location_id: number; coupon?: string | null; client_id?: number | null },
    ): Promise<ShopQuote> {
      return (await http.post(`/api/app/shop/${planId}/quote`, input)).data.data
    },
    async buy(
      planId: number,
      input: {
        location_id: number
        coupon?: string | null
        starts_on?: string | null
        accept_terms: boolean
        client_id?: number | null
      },
    ): Promise<{
      entitlement: MyEntitlement
      invoice: MyInvoice
      pay_at: { location: string; address: string | null }
    }> {
      return (await http.post(`/api/app/shop/${planId}/buy`, input)).data.data
    },
  },
  async payments(): Promise<MyPayments> {
    return (await http.get('/api/app/payments')).data.data
  },
  /** Paying by card online (US-07.12). */
  online: {
    async availability(): Promise<{ available: boolean; location_ids: number[] }> {
      return (await http.get('/api/app/payments/online')).data.data
    },
    async start(input: {
      invoice_ids: number[]
      save_card?: boolean
      return_path?: string
    }): Promise<{ reference: string; url: string }> {
      return (await http.post('/api/app/payments/online', input)).data.data
    },
    async status(reference: string): Promise<{
      reference: string
      status: 'Pending' | 'Succeeded' | 'Failed' | 'Cancelled'
      amount: number
      currency: string
      error: string | null
      receipt_number: string | null
    }> {
      return (await http.get(`/api/app/payments/online/${reference}`)).data.data
    },
  },
  memberships: {
    async list(): Promise<MyMembership[]> {
      return (await http.get('/api/app/memberships')).data.data
    },
    async autoRenew(id: number, on: boolean): Promise<MyMembership[]> {
      return (await http.post(`/api/app/memberships/${id}/auto-renew`, { on })).data.data
    },
    async freezePreview(
      id: number,
      input: { starts_on: string; ends_on: string },
    ): Promise<{ days: number; fee: number; ends_on: string | null; bookings: unknown[] }> {
      return (await http.post(`/api/app/memberships/${id}/freeze/preview`, input)).data.data
    },
    async freeze(
      id: number,
      input: { starts_on: string; ends_on: string; cancel_bookings: boolean },
    ): Promise<MyMembership[]> {
      return (await http.post(`/api/app/memberships/${id}/freeze`, input)).data.data
    },
    async cancel(
      id: number,
      input: { reason: string; note: string | null },
    ): Promise<MyMembership[]> {
      return (await http.post(`/api/app/memberships/${id}/cancel`, input)).data.data
    },
    async upgrade(id: number, note: string | null): Promise<void> {
      await http.post(`/api/app/memberships/${id}/upgrade`, { note })
    },
  },
  inbox: {
    async list(): Promise<{
      data: InboxItem[]
      meta: { unread: number; push_key: string | null }
    }> {
      return (await http.get('/api/app/notifications')).data
    },
    async unread(): Promise<number> {
      return (await http.get('/api/app/notifications/unread')).data.data.unread
    },
    async read(ids?: number[]): Promise<number> {
      return (await http.post('/api/app/notifications/read', ids ? { ids } : {})).data.data.unread
    },
    async subscribe(subscription: PushSubscriptionJSON): Promise<void> {
      await http.post('/api/app/push-subscriptions', subscription)
    },
  },
  calendarFeed: {
    async rotate(): Promise<string> {
      return (await http.post('/api/app/calendar-feed')).data.data.url
    },
    async revoke(): Promise<void> {
      await http.delete('/api/app/calendar-feed')
    },
  },
  academy: {
    async programs(): Promise<AppProgram[]> {
      return (await http.get('/api/app/academy/programs')).data.data
    },
    async groups(programId: number, clientId: number | null): Promise<AppAcademyGroup[]> {
      return (
        await http.get(`/api/app/academy/programs/${programId}/groups`, {
          params: forWhom(clientId),
        })
      ).data.data
    },
    async enroll(groupId: number, clientId: number | null): Promise<AcademyEnrolled> {
      return (await http.post(`/api/app/academy/groups/${groupId}/enroll`, forWhom(clientId))).data
        .data
    },
    async joinWaitlist(
      groupId: number,
      clientId: number | null,
    ): Promise<{ id: number; position: number }> {
      return (await http.post(`/api/app/academy/groups/${groupId}/waitlist`, forWhom(clientId)))
        .data.data
    },
    async trial(groupId: number, clientId: number | null, sessionId: number): Promise<void> {
      await http.post(`/api/app/academy/groups/${groupId}/trial`, {
        ...forWhom(clientId),
        session_id: sessionId,
      })
    },
    async answerWaitlistOffer(id: number, accept: boolean): Promise<AcademyEnrolled | null> {
      return (await http.post(`/api/app/academy/waitlist-offers/${id}`, { accept })).data.data
    },
    async answerReenrollment(id: number, accept: boolean): Promise<void> {
      await http.post(`/api/app/academy/reenrollment-offers/${id}`, { accept })
    },
  },
  family: {
    async list(): Promise<FamilyChild[]> {
      return (await http.get('/api/app/family')).data.data
    },
    async add(
      input: ChildInput & { relation: string; health_notes: string | null },
    ): Promise<FamilyChildProfile> {
      return (await http.post('/api/app/family', input)).data.data
    },
    async get(id: number): Promise<FamilyChildProfile> {
      return (await http.get(`/api/app/family/${id}`)).data.data
    },
    async update(id: number, input: ChildInput): Promise<FamilyChildProfile> {
      return (await http.put(`/api/app/family/${id}`, input)).data.data
    },
    async healthNotes(id: number, notes: string | null): Promise<void> {
      await http.put(`/api/app/family/${id}/health-notes`, { health_notes: notes })
    },
    async academy(id: number): Promise<ChildAcademy> {
      return (await http.get(`/api/app/family/${id}/academy`)).data.data
    },
    async report(id: number, termId?: number | null): Promise<ProgressReport> {
      return (
        await http.get(`/api/app/family/${id}/academy/report`, {
          params: termId ? { term_id: termId } : {},
        })
      ).data.data
    },
    async uploadPhoto(id: number, file: File): Promise<FamilyChildProfile> {
      const form = new FormData()
      form.append('photo', file)
      return (await http.post(`/api/app/family/${id}/photo`, form)).data.data
    },
  },
  coaches: {
    async list(): Promise<AppCoach[]> {
      return (await http.get('/api/app/coaches')).data.data
    },
    async get(id: number): Promise<AppCoachProfile> {
      return (await http.get(`/api/app/coaches/${id}`)).data.data
    },
  },
  checkIn: {
    async codes(): Promise<CheckInCode[]> {
      return (await http.get('/api/app/check-in/codes')).data.data
    },
    async branch(token: string): Promise<BranchCheckIn> {
      return (await http.get(`/api/app/check-in/${token}`)).data.data
    },
    async checkIn(token: string, bookingId: number): Promise<BranchCheckIn> {
      return (await http.post(`/api/app/check-in/${token}`, { booking_id: bookingId })).data.data
    },
  },
  async attendance(params: {
    from: string
    to: string
    client_id?: number | null
  }): Promise<AppAttendance> {
    return (
      await http.get('/api/app/attendance', {
        params: { ...params, client_id: params.client_id ?? undefined },
      })
    ).data.data
  },
  waivers: {
    async family(): Promise<FamilyWaivers[]> {
      return (await http.get('/api/app/waivers')).data.data
    },
    async get(id: number, clientId?: number | null): Promise<WaiverToSign> {
      return (
        await http.get(`/api/app/waivers/${id}`, { params: { client_id: clientId ?? undefined } })
      ).data.data
    },
    async sign(
      id: number,
      clientId: number | null,
      input: {
        signer_name: string
        method: 'typed' | 'drawn'
        signature: string | null
        accepted: boolean
      },
    ): Promise<AppWaiver['signed']> {
      return (
        await http.post(`/api/app/waivers/${id}/sign`, input, {
          params: { client_id: clientId ?? undefined },
        })
      ).data.data
    },
  },
  async invoice(id: number): Promise<InvoiceDocument> {
    return (await http.get(`/api/app/invoices/${id}`)).data.data
  },
  async receipt(id: number): Promise<Receipt> {
    return (await http.get(`/api/app/payments/${id}/receipt`)).data.data
  },
  calendarUrl(bookingId: number): string {
    return `/api/app/bookings/${bookingId}/calendar.ics`
  },
  /** "Add to Google Calendar" for a session (US-11.19). */
  googleCalendarUrl(input: {
    title: string
    starts_at: string
    ends_at?: string
    minutes?: number
    location?: string | null
  }): string {
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
    const start = new Date(input.starts_at)
    const end = input.ends_at
      ? new Date(input.ends_at)
      : new Date(start.getTime() + (input.minutes ?? 60) * 60000)
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: input.title,
      dates: `${fmt(start)}/${fmt(end)}`,
      location: input.location ?? '',
    })
    return `https://calendar.google.com/calendar/render?${params}`
  },
  photoUrl(): string {
    return '/api/app/profile/photo'
  },
  qrUrl(): string {
    return '/api/app/profile/qr'
  },
}
