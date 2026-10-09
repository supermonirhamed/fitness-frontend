import { AxiosError } from 'axios'

export type SignInError =
  'invalid' | 'throttled' | 'deactivated' | 'suspended' | 'twoFactorExpired' | 'generic'

/** Maps a sign-in (or 2FA code) failure to the message the UI shows (copy lives in i18n, not in API messages). */
export function signInError(error: unknown): { kind: SignInError; seconds?: number } {
  if (!(error instanceof AxiosError) || !error.response) return { kind: 'generic' }
  const { status, data } = error.response

  if (status === 422) return { kind: 'invalid' }
  if (status === 410 && data?.code === 'two_factor_expired') return { kind: 'twoFactorExpired' }
  if (status === 429) {
    const message = data?.errors?.email?.[0] ?? data?.errors?.code?.[0] ?? ''
    const seconds = Number(String(message).match(/\d+/)?.[0])
    return { kind: 'throttled', seconds: Number.isFinite(seconds) ? seconds : 60 }
  }
  if (status === 403 && data?.code === 'tenant_suspended') return { kind: 'suspended' }
  if (status === 403) return { kind: 'deactivated' }
  return { kind: 'generic' }
}

export type LinkProblem = 'invalid' | 'expired' | 'used'

/** Why an emailed reset or invitation link can't be used, or null for any other failure. */
export function linkProblem(error: unknown): LinkProblem | null {
  if (!(error instanceof AxiosError) || error.response?.status !== 410) return null
  const code = String(error.response.data?.code ?? '')
  return (['invalid', 'expired', 'used'] as const).find((p) => code === `link_${p}`) ?? 'invalid'
}

/** The `code` an API error carries (e.g. 'two_factor_required'), if any. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof AxiosError ? error.response?.data?.code : undefined
}

/** The translated message of a refusal that carries a `code` (409 conflicts, 403 rules), if any. */
export function apiMessage(error: unknown): string | undefined {
  return errorCode(error)
    ? (error as AxiosError<{ message?: string }>).response?.data?.message
    : undefined
}
