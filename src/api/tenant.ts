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
}

export interface RegionalSettings {
  currency: string
  timezone: string
  locale: 'ar' | 'en'
  date_format: string
  time_format: '12h' | '24h'
  week_start: number
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

export interface Location {
  id: number
  name: string
  timezone: string
  archived_at?: string | null
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
  async locations(archived = false): Promise<Location[]> {
    return (await http.get('/api/locations', { params: archived ? { archived: 1 } : {} })).data.data
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
