import type { ShopProduct } from '@/api/clientApp'

type T = (key: string, params?: Record<string, unknown>, plural?: number) => string

/** One line about a product (US-11.13): credits and validity, or the membership's term and visits. */
export function productSummary(t: T, p: ShopProduct): string {
  if (p.kind === 'package') {
    return [
      t('app.shop.credits', { n: p.credits ?? 0 }, p.credits ?? 0),
      p.validity_days ? t('app.shop.validDays', { n: p.validity_days }, p.validity_days) : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  const term =
    p.billing === 'recurring'
      ? t(`app.shop.every.${p.billing_interval ?? 'month'}`)
      : p.duration_value
        ? t(
            `app.shop.for.${p.duration_unit ?? 'months'}`,
            { n: p.duration_value },
            p.duration_value,
          )
        : null
  const visits =
    p.type === 'Limited' && p.visit_limit
      ? t(`app.shop.visits.${p.visit_period ?? 'week'}`, { n: p.visit_limit }, p.visit_limit)
      : t('app.shop.unlimited')
  return [
    term,
    visits,
    p.min_commitment_months ? t('app.shop.commitment', { n: p.min_commitment_months }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
