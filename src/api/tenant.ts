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
  two_factor_enabled: boolean
  two_factor_required: boolean
  /** Effective permissions (module.action), for hiding what the user can't do. The API checks anyway. */
  permissions: string[]
  scope: AccessScope
}

/** Where a role's permissions apply: whole organization, assigned branches, or own sessions and clients. */
export type AccessScope = 'organization' | 'locations' | 'own'

export interface RoleSummary {
  name: string
  system: boolean
  scope: AccessScope
  users_count: number
  permissions: string[]
}

export interface RolesMatrix {
  roles: RoleSummary[]
  /** module => actions, in display order */
  modules: Record<string, string[]>
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
  async roles(): Promise<RolesMatrix> {
    const { data } = await http.get('/api/roles')
    return { roles: data.data, modules: data.modules }
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
