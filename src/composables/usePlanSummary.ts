import { useI18n } from 'vue-i18n'
import type { FreezePolicy, MembershipPlan } from '@/api/tenant'
import { useFormat } from './useFormat'

/** One-line summaries of a plan or package (EP-06), shared by the plans list and details page. */
export function usePlanSummary() {
  const { t } = useI18n()
  const format = useFormat()

  const access = (p: MembershipPlan) =>
    p.kind === 'package'
      ? p.drop_in_service_id
        ? t('plans.dropInSummary', { service: p.drop_in_service ?? '–' })
        : t('plans.creditsSummary', { n: p.credits })
      : p.type === 'Unlimited'
        ? t('plans.types.Unlimited')
        : t('plans.limitedSummary', { n: p.visit_limit, per: t(`plans.per.${p.visit_period}`) })

  const billing = (p: MembershipPlan) =>
    p.kind === 'package'
      ? p.validity_mode === 'fixed_date'
        ? t('plans.validUntilSummary', { date: p.valid_until ? format.date(p.valid_until) : '–' })
        : t('plans.validDaysSummary', { n: p.validity_days })
      : p.billing === 'recurring'
        ? [
            t(`plans.intervals.${p.billing_interval}`),
            p.min_commitment_months
              ? t('plans.commitmentSummary', { n: p.min_commitment_months })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : t('plans.durationSummary', {
            n: p.duration_value,
            unit: t(`plans.units.${p.duration_unit}`),
          })

  const covers = (p: MembershipPlan) => {
    const s = p.rules.services
    if (s.mode === 'categories') return t('plans.coversCategories', { n: s.category_ids.length })
    if (s.mode === 'services') return t('plans.coversServices', { n: s.service_ids.length })
    if (s.mode === 'programs') return t('plans.coversPrograms', { n: s.program_ids?.length ?? 0 })
    return s.exclude_service_ids?.length
      ? t('plans.coversAllExcept', { n: s.exclude_service_ids.length })
      : t('plans.coverModes.all')
  }

  const badge = (p: MembershipPlan) =>
    p.kind === 'package'
      ? { cls: 'package', icon: 'pi-ticket', label: t('plans.kindOne.package') }
      : p.type === 'Unlimited'
        ? { cls: 'unlimited', icon: 'pi-star', label: t('plans.types.Unlimited') }
        : { cls: 'limited', icon: 'pi-ticket', label: t('plans.types.Limited') }

  const priceRange = (p: MembershipPlan) => {
    const prices = p.prices.map((x) => x.price)
    if (!prices.length) return null
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? format.money(min) : t('plans.fromPrice', { price: format.money(min) })
  }

  const isFree = (p: MembershipPlan) => p.prices.length > 0 && p.prices.every((x) => x.price === 0)

  const intro = (p: MembershipPlan) =>
    p.intro_offer ? (isFree(p) ? t('plans.freeTrial') : t(`plans.intros.${p.intro_offer}`)) : null

  /** US-06.11: "Freeze 7–60 days, 2× a year, fee SAR 50". */
  const freezeSummary = (f: FreezePolicy) => {
    const days =
      f.min_days && f.max_days
        ? t('plans.freezeDaysRange', { min: f.min_days, max: f.max_days })
        : f.max_days
          ? t('plans.freezeDaysMax', { n: f.max_days })
          : f.min_days
            ? t('plans.freezeDaysMin', { n: f.min_days })
            : t('plans.freezeAny')
    return [
      days,
      f.max_per_year ? t('plans.freezePerYearSummary', { n: f.max_per_year }) : null,
      f.fee ? t('plans.freezeFeeSummary', { fee: format.money(f.fee) }) : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return { access, billing, covers, badge, priceRange, isFree, intro, freezeSummary }
}
