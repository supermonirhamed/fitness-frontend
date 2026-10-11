<script setup lang="ts">
// Tax / VAT of a branch (US-01.14, D8): on/off, rate from a date, VAT-inclusive or exclusive
// prices, registration number and the legal name on receipts, with a receipt preview.
// Laid out as the design (BranchDetails.jsx VatTab): setting rows beside a receipt preview card.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import { tenantApi, type VatSettings } from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { isoDay } from '@/lib/audit'
import { calculateVat } from '@/lib/vat'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const settings = ref<VatSettings | null>(null)
const form = ref({
  enabled: false,
  prices_include_vat: true,
  rate: null as number | null,
  effective: null as Date | null,
  registration_number: '',
  legal_name: '',
})
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)

const fromYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
function apply(s: VatSettings) {
  settings.value = s
  form.value = {
    enabled: s.enabled,
    prices_include_vat: s.prices_include_vat,
    rate: s.rate === null ? null : Number(s.rate),
    effective: fromYmd(s.today),
    registration_number: s.registration_number ?? '',
    legal_name: s.legal_name ?? '',
  }
}
async function load() {
  state.value = 'loading'
  try {
    apply(await tenantApi.vat.get(props.locationId))
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const today = computed(() => (settings.value ? fromYmd(settings.value.today) : new Date()))
const rateChanged = computed(
  () => form.value.rate !== null && form.value.rate !== Number(settings.value?.rate ?? NaN),
)
const pricingOptions = computed(() => [
  { value: true, label: t('vat.inclusive') },
  { value: false, label: t('vat.exclusive') },
])
const err = (field: string) => errors.value[field]?.[0]

// Receipt preview for a 100.00 price as entered.
const preview = computed(() =>
  calculateVat(10000, form.value.enabled ? form.value.rate : null, form.value.prices_include_vat),
)
const money = (minor: number) => format.money(minor / 100)

async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    apply(
      await tenantApi.vat.update(props.locationId, {
        enabled: form.value.enabled,
        prices_include_vat: form.value.prices_include_vat,
        rate: form.value.enabled ? form.value.rate : null,
        effective_from:
          rateChanged.value && form.value.effective ? isoDay(form.value.effective) : null,
        registration_number: form.value.registration_number || null,
        legal_name: form.value.legal_name || null,
      }),
    )
    toast.add({ severity: 'success', summary: t('vat.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="vat">
    <SettingsCard>
      <div v-for="n in 4" :key="n" class="skeleton-row">
        <Skeleton width="40%" /><Skeleton height="36px" />
      </div>
    </SettingsCard>
  </div>
  <ErrorState
    v-else-if="state === 'error'"
    class="card"
    :title="t('vat.loadError')"
    @retry="load"
  />

  <form v-else-if="settings" class="vat" @submit.prevent="save">
    <div class="vat__rows">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
      <SettingsCard>
        <SettingRow :label="t('vat.enabled')" :help="t('vat.enabledHint')">
          <label class="switch">
            <ToggleSwitch
              v-model="form.enabled"
              :disabled="!canEdit"
              :aria-label="t('vat.enabled')"
            />
            <span>{{ form.enabled ? t('vat.on') : t('vat.off') }}</span>
          </label>
        </SettingRow>

        <template v-if="form.enabled">
          <SettingRow :label="t('vat.rate')" :help="t('vat.rateHint')" label-for="vat-rate">
            <InputNumber
              v-model="form.rate"
              input-id="vat-rate"
              :min="0"
              :max="100"
              :max-fraction-digits="2"
              suffix=" %"
              :disabled="!canEdit"
              :invalid="!!err('rate')"
              class="narrow"
            />
            <small v-if="err('rate')" class="error">{{ err('rate') }}</small>
          </SettingRow>
          <SettingRow
            :label="t('vat.pricing')"
            :help="form.prices_include_vat ? t('vat.previewInclusive') : t('vat.previewExclusive')"
          >
            <SelectButton
              v-model="form.prices_include_vat"
              :options="pricingOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              :disabled="!canEdit"
              :aria-label="t('vat.pricing')"
            />
          </SettingRow>
          <SettingRow :label="t('vat.registrationNumber')" label-for="vat-number">
            <InputText
              id="vat-number"
              v-model="form.registration_number"
              maxlength="30"
              dir="ltr"
              class="mono"
              :disabled="!canEdit"
              :invalid="!!err('registration_number')"
              fluid
            />
            <small v-if="err('registration_number')" class="error">{{
              err('registration_number')
            }}</small>
          </SettingRow>
          <SettingRow
            :label="t('vat.legalName')"
            :help="t('vat.legalNameHint')"
            label-for="vat-legal"
          >
            <InputText
              id="vat-legal"
              v-model="form.legal_name"
              maxlength="190"
              :disabled="!canEdit"
              fluid
            />
          </SettingRow>
          <SettingRow
            v-if="rateChanged"
            :label="t('vat.effectiveFrom')"
            :help="t('vat.effectiveHint')"
            label-for="vat-from"
          >
            <DatePicker
              v-model="form.effective"
              input-id="vat-from"
              :min-date="today"
              :manual-input="false"
              date-format="yy-mm-dd"
              :invalid="!!err('effective_from')"
              fluid
            />
            <small v-if="err('effective_from')" class="error">{{ err('effective_from') }}</small>
          </SettingRow>
        </template>
        <div v-else class="off-note">
          <Message severity="secondary" :closable="false">{{ t('vat.disabledNote') }}</Message>
        </div>
      </SettingsCard>
    </div>

    <section class="card preview" :aria-label="t('vat.preview')">
      <div class="preview__title">{{ t('vat.preview') }}</div>
      <template v-if="form.enabled">
        <div class="preview__line">
          <span>{{ t('vat.subtotal') }}</span
          ><span class="num">{{ money(preview.net) }}</span>
        </div>
        <div class="preview__line">
          <span>{{ t('vat.vatLine', { rate: form.rate ?? 0 }) }}</span
          ><span class="num">{{ money(preview.vat) }}</span>
        </div>
      </template>
      <div class="preview__line preview__total">
        <span>{{ t('vat.total') }}</span
        ><span class="num">{{ money(preview.gross) }}</span>
      </div>
      <Button v-if="canEdit" type="submit" :label="t('vat.save')" :loading="saving" fluid />
    </section>
  </form>
</template>

<style scoped>
.vat {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.vat__rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.narrow {
  max-width: 160px;
}
.mono :deep(input),
.mono {
  font-family: var(--font-mono);
}
.off-note {
  padding: 0 0 16px;
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.preview {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview__title {
  font: var(--text-h4);
}
.preview__line {
  display: flex;
  justify-content: space-between;
  font: var(--text-body);
  color: var(--text-secondary);
}
.preview__total {
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
  font: 600 16px var(--font-sans);
  color: var(--text-primary);
}
@media (max-width: 900px) {
  .vat {
    grid-template-columns: 1fr;
  }
}
</style>
