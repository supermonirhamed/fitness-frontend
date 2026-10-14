import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { tenantApi, type PaymentMethod, type PaymentMethodSettings } from '@/api/tenant'

const cache = new Map<number, Promise<PaymentMethodSettings>>()
const DEFAULTS: PaymentMethodSettings = {
  methods: ['cash', 'bank_transfer', 'card_terminal', 'cheque', 'account_credit', 'other'],
  reference_required: ['bank_transfer', 'card_terminal'],
}

/** The payment methods a branch takes and which need a reference (US-07.03), loaded once per branch. */
export function usePaymentMethods(locationId: Ref<number | null | undefined>) {
  const { t } = useI18n()
  const settings = ref<PaymentMethodSettings>(DEFAULTS)
  watch(
    locationId,
    async (id) => {
      if (!id) return
      if (!cache.has(id))
        cache.set(
          id,
          tenantApi.paymentMethods.get(id).catch(() => DEFAULTS),
        )
      settings.value = await cache.get(id)!
    },
    { immediate: true },
  )
  const options = computed(() =>
    settings.value.methods.map((m) => ({ value: m, label: t(`payments.methods.${m}`) })),
  )
  const needsReference = (m: PaymentMethod) => settings.value.reference_required.includes(m)
  /** Forget a branch's settings after they were changed. */
  const forget = (id: number) => cache.delete(id)

  return { settings, options, needsReference, forget }
}
