export const centralDomain: string = import.meta.env.VITE_CENTRAL_DOMAIN ?? 'fitness.test'

export type AppContext = { kind: 'platform' } | { kind: 'tenant'; slug: string }

/** The platform console runs on the central domain; organizations on {slug}.{central domain} (D2). */
export function resolveAppContext(hostname: string): AppContext {
  const suffix = '.' + centralDomain
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length)
    if (slug && !slug.includes('.')) return { kind: 'tenant', slug }
  }
  return { kind: 'platform' }
}

export function tenantDomain(slug: string): string {
  return `${slug}.${centralDomain}`
}
