import axios, { AxiosError } from 'axios'

// Same-origin in dev (Vite proxies /api and /sanctum), so Sanctum SPA cookie auth just works.
export const http = axios.create({
  baseURL: '/',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
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
