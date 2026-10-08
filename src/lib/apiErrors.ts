import { AxiosError } from 'axios'

export type SignInError = 'invalid' | 'throttled' | 'deactivated' | 'suspended' | 'generic'

/** Maps a sign-in failure to the message the UI shows (copy lives in i18n, not in API messages). */
export function signInError(error: unknown): { kind: SignInError; seconds?: number } {
  if (!(error instanceof AxiosError) || !error.response) return { kind: 'generic' }
  const { status, data } = error.response

  if (status === 422) return { kind: 'invalid' }
  if (status === 429) {
    const seconds = Number(String(data?.errors?.email?.[0] ?? '').match(/\d+/)?.[0])
    return { kind: 'throttled', seconds: Number.isFinite(seconds) ? seconds : 60 }
  }
  if (status === 403 && data?.code === 'tenant_suspended') return { kind: 'suspended' }
  if (status === 403) return { kind: 'deactivated' }
  return { kind: 'generic' }
}
