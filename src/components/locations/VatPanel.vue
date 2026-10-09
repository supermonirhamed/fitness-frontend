<script setup lang="ts">
// Tax / VAT of a branch (US-01.14, D8): on/off, rate from a date, VAT-inclusive or exclusive
// prices, registration number and the legal name on receipts, with a receipt preview.
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
import EmptyState from '@/components/patterns/EmptyState.vue'
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
  <div v-if="state === 'loading'" class="stack">
    <Skeleton v-for="n in 3" :key="n" height="56px" />
  </div>
  <EmptyState
    v-else-if="state === 'error'"
    icon="pi-exclamation-triangle"
    :title="t('vat.loadError')"
  >
    <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
  </EmptyState>

  <form v-else-if="settings" class="vat" @submit.prevent="save">
    <div class="toggle">
      <ToggleSwitch v-model="form.enabled" input-id="vat-enabled" :disabled="!canEdit" />
      <label for="vat-enabled">
        <strong>{{ t('vat.enabled') }}</strong>
        <small>{{ t('vat.enabledHint') }}</small>
      </label>
    </div>

    <Message v-if="!form.enabled" severity="info" :closable="false">{{
      t('vat.disabledNote')
    }}</Message>

    <template v-else>
      <div class="grid">
        <div class="field">
          <label for="vat-rate">{{ t('vat.rate') }} *</label>
          <InputNumber
            v-model="form.rate"
            input-id="vat-rate"
            :min="0"
            :max="100"
            :max-fraction-digits="2"
            suffix=" %"
            :disabled="!canEdit"
            :invalid="!!err('rate')"
            fluid
          />
          <small :class="err('rate') ? 'error' : 'hint'">{{
            err('rate') ?? t('vat.rateHint')
          }}</small>
        </div>
        <div v-if="rateChanged" class="field">
          <label for="vat-from">{{ t('vat.effectiveFrom') }} *</label>
          <DatePicker
            v-model="form.effective"
            input-id="vat-from"
            :min-date="today"
            :manual-input="false"
            date-format="yy-mm-dd"
            :invalid="!!err('effective_from')"
            fluid
          />
          <small :class="err('effective_from') ? 'error' : 'hint'">{{
            err('effective_from') ?? t('vat.effectiveHint')
          }}</small>
        </div>
      </div>

      <div class="field">
        <span id="vat-pricing" class="label">{{ t('vat.pricing') }}</span>
        <SelectButton
          v-model="form.prices_include_vat"
          :options="pricingOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!canEdit"
          aria-labelledby="vat-pricing"
        />
      </div>

      <div class="grid">
        <div class="field">
          <label for="vat-number">{{ t('vat.registrationNumber') }} *</label>
          <InputText
            id="vat-number"
            v-model="form.registration_number"
            maxlength="30"
            dir="ltr"
            :disabled="!canEdit"
            :invalid="!!err('registration_number')"
            fluid
          />
          <small v-if="err('registration_number')" class="error">{{
            err('registration_number')
          }}</small>
        </div>
        <div class="field">
          <label for="vat-legal">{{ t('vat.legalName') }}</label>
          <InputText
            id="vat-legal"
            v-model="form.legal_name"
            maxlength="190"
            :disabled="!canEdit"
            fluid
          />
          <small class="hint">{{ t('vat.legalNameHint') }}</small>
        </div>
      </div>

      <section class="preview" :aria-label="t('vat.preview')">
        <span class="label">{{ t('vat.preview') }}</span>
        <p class="receipt">
          <span
            >{{ t('vat.subtotal') }} <b class="num">{{ money(preview.net) }}</b></span
          >
          <span
            >{{ t('vat.vatLine', { rate: form.rate ?? 0 }) }}
            <b class="num">{{ money(preview.vat) }}</b></span
          >
          <span
            >{{ t('vat.total') }} <b class="num">{{ money(preview.gross) }}</b></span
          >
        </p>
        <small class="hint">{{
          form.prices_include_vat ? t('vat.previewInclusive') : t('vat.previewExclusive')
        }}</small>
      </section>
    </template>

    <section v-if="settings.rates.length" class="history">
      <span class="label">{{ t('vat.history') }}</span>
      <ul>
        <li v-for="r in settings.rates" :key="r.effective_from">
          <span class="num">{{ r.rate }} %</span>
          <span>{{
            t('vat.from', { date: format.date(`${r.effective_from}T00:00:00Z`, 'UTC') })
          }}</span>
          <span v-if="r.scheduled" class="tag">{{ t('vat.scheduled') }}</span>
        </li>
      </ul>
    </section>

    <Message v-if="formError" severity="error" :closable="false" role="alert">{{
      formError
    }}</Message>
    <div v-if="canEdit" class="footer">
      <span class="audit"
        ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
      >
      <Button type="submit" :label="t('permissions.save')" :loading="saving" />
    </div>
  </form>
</template>

<style scoped>
.stack,
.vat {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.toggle {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.toggle label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.field label,
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.hint,
.toggle small {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.preview,
.history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-card);
}
.receipt {
  display: flex;
  gap: var(--space-3) var(--space-5);
  flex-wrap: wrap;
  margin: 0;
}
.history ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.history li {
  display: flex;
  gap: var(--space-3);
  font: var(--text-small);
}
.tag {
  font: var(--text-caption);
  color: var(--sev-info-fg, var(--text-muted));
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
