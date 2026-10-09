import { csrfCookie, http } from '@/lib/http'

export interface Organization {
  name: string
  slug: string
  locale: 'ar' | 'en'
  currency: string
  timezone: string
  date_format: string
  time_format: '12h' | '24h'
  /** 0 = Sunday … 6 = Saturday */
  week_start: number
  logo_url: string | null
}

export interface OrganizationProfile {
  name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  logo_url?: string | null
}

export interface RegionalSettings {
  currency: string
  timezone: string
  locale: 'ar' | 'en'
  date_format: string
  time_format: '12h' | '24h'
  week_start: number
}

export type Penalty = 'none' | 'consume_credit' | 'fixed_fee'

/** Booking & cancellation policy (US-01.02). */
export interface BookingPolicy {
  booking_opens_days: number
  booking_closes_minutes: number
  cancellation_window_hours: number
  late_cancel_penalty: Penalty
  late_cancel_fee: number | null
  no_show_penalty: Penalty
  no_show_fee: number | null
  waitlist_closes_minutes: number
  waitlist_mode: 'manual' | 'automatic'
}

/** Overrides: null inherits from the level above. */
export type BookingPolicyOverrides = { [K in keyof BookingPolicy]: BookingPolicy[K] | null }

export type PolicySource = 'organization' | 'location' | 'service' | 'session'

export interface BookingPolicyOptions {
  penalties: Penalty[]
  waitlist_modes: BookingPolicy['waitlist_mode'][]
}

export interface LocationBookingPolicy {
  overrides: Partial<BookingPolicy>
  organization: BookingPolicy
  effective: BookingPolicy
  sources: Record<string, PolicySource>
}

export interface StaffUser {
  id: number
  name: string
  email: string
  locale: 'ar' | 'en' | null
  roles: string[]
  two_factor_enabled: boolean
  two_factor_required: boolean
  /** Effective permissions (module.action), for hiding what the user can't do. The API checks anyway. */
  permissions: string[]
  scope: AccessScope
  /** Locations this user may see; null means every location (US-00.09). */
  location_ids: number[] | null
}

export type LocationStatus = 'Draft' | 'Active' | 'Inactive'

/** Branch figures (US-01.04); null until the module behind it exists. */
export interface LocationStats {
  facilities: number | null
  active_services: number | null
  staff: number
  today_sessions: number | null
}

export interface Location {
  id: number
  name: string
  status: LocationStatus
  timezone: string
  archived_at?: string | null
  stats?: LocationStats
}

/** What deactivating a branch would affect (US-01.05). */
export interface DeactivationImpact {
  upcoming_sessions: number
  upcoming_bookings: number
}

export type FutureSessionsChoice = 'keep' | 'cancel'

/** "HH:MM"; an end of "24:00" is midnight. */
export interface TimeRange {
  start: string
  end: string
}

/** Days "0" (Sunday) to "6"; an empty list is closed. */
export type WeeklyHours = Record<string, TimeRange[]>

export const FACILITY_TYPES = [
  'Room',
  'Studio',
  'Field',
  'Pool',
  'Gym Area',
  'Court',
  'Other',
] as const
export type FacilityType = (typeof FACILITY_TYPES)[number]
export type FacilityStatus = 'Active' | 'Inactive'

export interface SubArea {
  id: number | null
  name: string
  capacity: number
}

/** A room, studio, field, pool, gym area or court of a branch (US-01.08). */
export interface Facility {
  id: number
  name: string
  type: FacilityType
  location_id: number
  location?: { id: number; name: string; timezone: string } | null
  capacity: number
  status: FacilityStatus
  description: string | null
  photo_url: string | null
  archived_at: string | null
  sub_areas?: SubArea[]
}

export interface FacilityInput {
  name: string
  type: FacilityType
  location_id: number
  capacity: number
  status?: FacilityStatus
  description: string | null
  sub_areas?: SubArea[]
}

/** Time a facility is taken (US-01.10): a session (EP-03) or blocked by staff. Times are ISO (UTC). */
export interface FacilityReservation {
  id: number
  kind: 'session' | 'block'
  title: string
  facility_id: number
  facility: string | null
  starts_at: string
  ends_at: string
  /** Including setup/cleanup buffers. */
  blocked_from: string
  blocked_until: string
  coach: string | null
}

/** Something in the way of a booking (409 facility_conflict). */
export interface FacilityConflictItem {
  id: number
  kind: 'session' | 'block'
  title: string
  facility: string | null
  starts_at: string
  ends_at: string
  coach: string | null
}

export interface AvailabilityDay {
  date: string
  /** Opening ranges that day; [] closed; null weekly hours not set (open all day). */
  hours: TimeRange[] | null
  override: { label: string; closed: boolean } | null
}

export interface FacilityAvailability {
  facility: {
    id: number
    name: string
    type: FacilityType
    capacity: number
    status: FacilityStatus
    parent_id: number | null
  }
  timezone: string
  days: AvailabilityDay[]
  reservations: FacilityReservation[]
}

/** A holiday or special hours (US-01.07); dates are Y-m-d in the branch timezone. */
export interface HourOverride {
  id: number
  label: string
  start_date: string
  end_date: string
  closed: boolean
  hours: TimeRange[] | null
}

export type HourOverrideInput = Omit<HourOverride, 'id'> & { sessions?: FutureSessionsChoice }

/** A session a closure or deactivation would affect (filled in by EP-03). */
export interface AffectedSession {
  id: number
  title: string
  starts_at: string
  bookings: number
}

/** A branch's weekly opening hours (US-01.06); null hours: not set yet. */
export interface BusinessHours {
  hours: WeeklyHours | null
  timezone: string
}

export interface LocationStaffMember {
  id: number
  name: string
  email: string
  status: 'Invited' | 'Active'
  roles: string[]
}

/** Editable branch details (US-01.03). */
export interface LocationInput {
  name: string
  status: LocationStatus
  address: string
  timezone: string
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
}

export interface LocationDetails extends Location, LocationInput {
  photo_url: string | null
}

export interface StaffAccess {
  id: number
  name: string
  email: string
  status: 'Invited' | 'Active' | 'Deactivated'
  deactivated_at: string | null
  is_me: boolean
  roles: string[]
  scope: AccessScope
  owner: boolean
  /** false when a role applies to the whole organization: the assignment then has no effect */
  location_limited: boolean
  all_locations: boolean
  location_ids: number[]
}

/** Where a role's permissions apply: whole organization, assigned branches, or own sessions and clients. */
export type AccessScope = 'organization' | 'locations' | 'own'

export interface RoleSummary {
  id: number
  name: string
  system: boolean
  /** false for the Owner role, which can never change */
  editable: boolean
  scope: AccessScope
  users_count: number
  permissions: string[]
}

export interface RolesMatrix {
  roles: RoleSummary[]
  /** module => actions, in display order */
  modules: Record<string, string[]>
  scopes: AccessScope[]
}

export interface AuditEntry {
  id: number
  created_at: string
  actor: { id: number; name: string; email: string } | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
}

export interface AuditFilters {
  actor?: number | null
  action?: string | null
  entity_type?: string | null
  from?: string | null
  to?: string | null
}

export interface AuditFilterOptions {
  actors: { id: number; name: string; email: string }[]
  actions: string[]
  entity_types: string[]
}

export interface RoleInput {
  name?: string
  scope?: AccessScope
  permissions?: string[]
}

/** The password was right but the account uses 2FA: answer with twoFactorChallenge(). */
export interface TwoFactorPending {
  two_factor: true
}

export type SignInResult = StaffUser | TwoFactorPending

export const needsTwoFactor = (result: SignInResult): result is TwoFactorPending =>
  'two_factor' in result

export interface TwoFactorStatus {
  enabled: boolean
  required: boolean
  recovery_codes_left: number
  recovery_codes?: string[]
}

export interface TwoFactorSetup {
  secret: string
  otpauth_url: string
  qr_svg: string
}

export interface SecuritySettings {
  two_factor_required_roles: string[]
  roles: string[]
}

/** Exactly one of the two: a 6-digit code from the app, or a recovery code. */
export type SecondFactor = { code: string } | { recovery_code: string }

export interface Invitation {
  name: string
  email: string
  role: string
  expires_at: string
}

/** The token and email from an emailed link (US-00.05). */
export interface EmailedLink {
  token: string
  email: string
}

export interface NewPassword {
  password: string
  password_confirmation: string
}

/** Drops empty filter values so they are not sent as `?actor=`. */
function cleanParams(params: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}

export const tenantApi = {
  async organization(): Promise<Organization> {
    return (await http.get('/api/organization')).data.data
  },
  async login(email: string, password: string, remember: boolean): Promise<SignInResult> {
    await csrfCookie()
    const { data } = await http.post('/api/auth/login', { email, password, remember })
    return data.two_factor ? data : data.data
  },
  async twoFactorChallenge(factor: SecondFactor): Promise<StaffUser> {
    return (await http.post('/api/auth/two-factor-challenge', factor)).data.data
  },
  async me(): Promise<StaffUser> {
    return (await http.get('/api/auth/me')).data.data
  },
  async logout(): Promise<void> {
    await http.post('/api/auth/logout')
  },
  /** null: follow the organization's language. */
  async updateProfile(profile: { locale: 'ar' | 'en' | null }): Promise<StaffUser> {
    return (await http.put('/api/account/profile', profile)).data.data
  },
  async forgotPassword(email: string): Promise<void> {
    await csrfCookie()
    await http.post('/api/auth/forgot-password', { email })
  },
  /** Resolves when the reset link can still be used; rejects with 410 otherwise. */
  async checkResetLink(link: EmailedLink): Promise<void> {
    await http.get('/api/auth/reset-password', { params: link })
  },
  async resetPassword(link: EmailedLink, password: NewPassword): Promise<SignInResult> {
    await csrfCookie()
    const { data } = await http.post('/api/auth/reset-password', { ...link, ...password })
    return data.two_factor ? data : data.data
  },
  async invitation(link: EmailedLink): Promise<Invitation> {
    return (await http.get('/api/invitation', { params: link })).data.data
  },
  async acceptInvitation(link: EmailedLink, password: NewPassword): Promise<StaffUser> {
    await csrfCookie()
    return (await http.post('/api/invitation/accept', { ...link, ...password })).data.data
  },
  twoFactor: {
    async status(): Promise<TwoFactorStatus> {
      return (await http.get('/api/account/two-factor')).data.data
    },
    async start(password: string): Promise<TwoFactorSetup> {
      return (await http.post('/api/account/two-factor', { password })).data.data
    },
    async confirm(code: string): Promise<TwoFactorStatus> {
      return (await http.post('/api/account/two-factor/confirm', { code })).data.data
    },
    async newRecoveryCodes(password: string): Promise<TwoFactorStatus> {
      return (await http.post('/api/account/two-factor/recovery-codes', { password })).data.data
    },
    async disable(password: string): Promise<TwoFactorStatus> {
      return (await http.delete('/api/account/two-factor', { data: { password } })).data.data
    },
  },
  /** Active branches, or archived ones (needs locations.delete). */
  async locations(archived = false, status?: LocationStatus): Promise<Location[]> {
    const params = { ...(archived ? { archived: 1 } : {}), ...(status ? { status } : {}) }
    return (await http.get('/api/locations', { params })).data.data
  },
  async location(id: number): Promise<LocationDetails> {
    return (await http.get(`/api/locations/${id}`)).data.data
  },
  async locationStaff(
    id: number,
  ): Promise<{ data: LocationStaffMember[]; all_locations_count: number }> {
    return (await http.get(`/api/locations/${id}/staff`)).data
  },
  async createLocation(input: Partial<LocationInput>): Promise<LocationDetails> {
    return (await http.post('/api/locations', input)).data.data
  },
  async updateLocation(id: number, input: LocationInput): Promise<LocationDetails> {
    return (await http.put(`/api/locations/${id}`, input)).data.data
  },
  async uploadLocationPhoto(id: number, file: File): Promise<LocationDetails> {
    const form = new FormData()
    form.append('photo', file)
    return (await http.post(`/api/locations/${id}/photo`, form)).data.data
  },
  async deleteLocationPhoto(id: number): Promise<void> {
    await http.delete(`/api/locations/${id}/photo`)
  },
  async deactivationImpact(id: number): Promise<DeactivationImpact> {
    return (await http.get(`/api/locations/${id}/deactivation`)).data.data
  },
  async deactivateLocation(
    id: number,
    choice: { future_sessions?: FutureSessionsChoice; reason?: string } = {},
  ): Promise<LocationDetails> {
    return (await http.post(`/api/locations/${id}/deactivate`, choice)).data.data
  },
  async activateLocation(id: number): Promise<LocationDetails> {
    return (await http.post(`/api/locations/${id}/activate`)).data.data
  },
  async businessHours(id: number): Promise<BusinessHours> {
    return (await http.get(`/api/locations/${id}/business-hours`)).data.data
  },
  async updateBusinessHours(id: number, hours: WeeklyHours | null): Promise<BusinessHours> {
    return (await http.put(`/api/locations/${id}/business-hours`, { hours })).data.data
  },
  facilities: {
    async list(params: { location_id?: number; archived?: boolean } = {}): Promise<Facility[]> {
      const query = { ...params, archived: params.archived ? 1 : undefined }
      return (await http.get('/api/facilities', { params: query })).data.data
    },
    async create(input: FacilityInput): Promise<Facility> {
      return (await http.post('/api/facilities', input)).data.data
    },
    async update(id: number, input: FacilityInput): Promise<Facility> {
      return (await http.put(`/api/facilities/${id}`, input)).data.data
    },
    async uploadPhoto(id: number, file: File): Promise<Facility> {
      const form = new FormData()
      form.append('photo', file)
      return (await http.post(`/api/facilities/${id}/photo`, form)).data.data
    },
    async deletePhoto(id: number): Promise<void> {
      await http.delete(`/api/facilities/${id}/photo`)
    },
    async archive(id: number): Promise<void> {
      await http.delete(`/api/facilities/${id}`)
    },
    async restore(id: number): Promise<Facility> {
      return (await http.post(`/api/facilities/${id}/restore`)).data.data
    },
    async get(id: number): Promise<Facility> {
      return (await http.get(`/api/facilities/${id}`)).data.data
    },
    async availability(id: number, from: string, to: string): Promise<FacilityAvailability> {
      return (await http.get(`/api/facilities/${id}/availability`, { params: { from, to } })).data
        .data
    },
    /** Local "Y-m-d H:i" times at the facility's branch. */
    async block(
      id: number,
      input: { title: string; starts_at: string; ends_at: string },
    ): Promise<FacilityReservation> {
      return (await http.post(`/api/facilities/${id}/blocks`, input)).data.data
    },
    async unblock(id: number, blockId: number): Promise<void> {
      await http.delete(`/api/facilities/${id}/blocks/${blockId}`)
    },
  },
  hourOverrides: {
    async list(locationId: number): Promise<HourOverride[]> {
      return (await http.get(`/api/locations/${locationId}/hour-overrides`)).data.data
    },
    async create(locationId: number, input: HourOverrideInput): Promise<HourOverride> {
      return (await http.post(`/api/locations/${locationId}/hour-overrides`, input)).data.data
    },
    async update(locationId: number, id: number, input: HourOverrideInput): Promise<HourOverride> {
      return (await http.put(`/api/locations/${locationId}/hour-overrides/${id}`, input)).data.data
    },
    async remove(locationId: number, id: number): Promise<void> {
      await http.delete(`/api/locations/${locationId}/hour-overrides/${id}`)
    },
  },
  async archiveLocation(id: number): Promise<void> {
    await http.delete(`/api/locations/${id}`)
  },
  async restoreLocation(id: number): Promise<Location> {
    return (await http.post(`/api/locations/${id}/restore`)).data.data
  },
  async users(): Promise<StaffAccess[]> {
    return (await http.get('/api/users')).data.data
  },
  async updateUserLocations(
    id: number,
    access: { all_locations: boolean; location_ids: number[] },
  ): Promise<StaffAccess> {
    return (await http.put(`/api/users/${id}/locations`, access)).data.data
  },
  async deactivateUser(id: number): Promise<StaffAccess> {
    return (await http.post(`/api/users/${id}/deactivate`)).data.data
  },
  async reactivateUser(id: number): Promise<StaffAccess> {
    return (await http.post(`/api/users/${id}/reactivate`)).data.data
  },
  async auditLogs(
    filters: AuditFilters,
    page: number,
  ): Promise<{ data: AuditEntry[]; meta: { total: number; per_page: number } }> {
    return (await http.get('/api/audit-logs', { params: { ...cleanParams(filters), page } })).data
  },
  async auditFilterOptions(): Promise<AuditFilterOptions> {
    return (await http.get('/api/audit-logs/filters')).data.data
  },
  auditExportUrl(filters: AuditFilters): string {
    return `/api/audit-logs/export?${new URLSearchParams(cleanParams(filters) as Record<string, string>)}`
  },
  async roles(): Promise<RolesMatrix> {
    const { data } = await http.get('/api/roles')
    return { roles: data.data, modules: data.modules, scopes: data.scopes }
  },
  async createRole(input: Required<RoleInput>): Promise<RoleSummary> {
    return (await http.post('/api/roles', input)).data.data
  },
  async updateRole(id: number, input: RoleInput): Promise<RoleSummary> {
    return (await http.put(`/api/roles/${id}`, input)).data.data
  },
  async resetRole(id: number): Promise<RoleSummary> {
    return (await http.post(`/api/roles/${id}/reset`)).data.data
  },
  async deleteRole(id: number): Promise<void> {
    await http.delete(`/api/roles/${id}`)
  },
  organizationProfile: {
    async get(): Promise<OrganizationProfile> {
      return (await http.get('/api/settings/organization')).data.data
    },
    async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
      return (await http.put('/api/settings/organization', profile)).data.data
    },
    async uploadLogo(file: File): Promise<OrganizationProfile> {
      const form = new FormData()
      form.append('logo', file)
      return (await http.post('/api/settings/organization/logo', form)).data.data
    },
    async deleteLogo(): Promise<void> {
      await http.delete('/api/settings/organization/logo')
    },
  },
  regional: {
    async get(): Promise<{
      data: RegionalSettings & { currency_locked: boolean }
      options: {
        currencies: string[]
        locales: string[]
        date_formats: string[]
        time_formats: string[]
      }
    }> {
      return (await http.get('/api/settings/regional')).data
    },
    async update(
      settings: RegionalSettings,
    ): Promise<RegionalSettings & { currency_locked: boolean }> {
      return (await http.put('/api/settings/regional', settings)).data.data
    },
  },
  bookingPolicy: {
    async get(): Promise<{ data: BookingPolicy; options: BookingPolicyOptions }> {
      return (await http.get('/api/settings/booking-policy')).data
    },
    async update(policy: BookingPolicy): Promise<BookingPolicy> {
      return (await http.put('/api/settings/booking-policy', policy)).data.data
    },
    async forLocation(
      id: number,
    ): Promise<{ data: LocationBookingPolicy; options: BookingPolicyOptions }> {
      return (await http.get(`/api/locations/${id}/booking-policy`)).data
    },
    async updateLocation(
      id: number,
      overrides: BookingPolicyOverrides,
    ): Promise<LocationBookingPolicy> {
      return (await http.put(`/api/locations/${id}/booking-policy`, overrides)).data.data
    },
  },
  security: {
    async get(): Promise<SecuritySettings> {
      return (await http.get('/api/settings/security')).data.data
    },
    async update(requiredRoles: string[]): Promise<SecuritySettings> {
      return (
        await http.put('/api/settings/security', { two_factor_required_roles: requiredRoles })
      ).data.data
    },
  },
}
