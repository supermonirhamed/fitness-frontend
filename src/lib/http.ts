import axios, { AxiosError } from 'axios'

// Same-origin in dev (Vite proxies /api and /sanctum), so Sanctum SPA cookie auth just works.
export const http = axios.create({
  baseURL: '/',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

const unauthenticatedHandlers: Array<() => void> = []

/** Called when an authenticated request comes back 401 (session expired or user deactivated). */
export function onUnauthenticated(handler: () => void): void {
  unauthenticatedHandlers.push(handler)
}

http.interceptors.response.use(undefined, (error) => {
  const url = String(error?.config?.url ?? '')
  if (error instanceof AxiosError && error.response?.status === 401 && !url.includes('/auth/me')) {
    unauthenticatedHandlers.forEach((handler) => handler())
  }
  return Promise.reject(error)
})

export function csrfCookie() {
  return http.get('/sanctum/csrf-cookie')
}

export type ValidationErrors = Record<string, string[]>

export function validationErrors(error: unknown): ValidationErrors {
  if (error instanceof AxiosError && error.response?.status === 422) {
    return error.response.data?.errors ?? {}
  }
  return {}
}

export function statusOf(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined
}
