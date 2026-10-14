<script setup lang="ts">
// Desk payments of a booking (US-04.15, brief 05 §6): what it costs at the branch with VAT, what was
// paid, Unpaid / Partially paid / Paid, and each payment with its receipt. "Record payment" takes
// the amount (prefilled with what is left), the method and, for transfers and card terminals, a
// reference. Payments are never edited or deleted: a manager voids one with a reason.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import { tenantApi, type BookingPayments, type Payment, type PaymentMethod } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { isoDay } from '@/lib/audit'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ bookingId: number; timezone?: string }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const info = ref<BookingPayments | null>(null)
async function load() {
  state.value = 'loading'
  try {
    info.value = await tenantApi.payments.forBooking(props.bookingId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.bookingId, load, { immediate: true })

const SEVERITY = {
  unpaid: 'danger',
  partial: 'warn',
  paid: 'success',
  not_required: 'secondary',
} as const
// The methods the booking's branch takes, and which need a reference (US-07.03).
const { options: methodOptions, needsReference: methodNeedsReference } = usePaymentMethods(
  computed(() => info.value?.location_id ?? null),
)
const canRecord = computed(() => auth.can('payments.create') && !!info.value?.required)
const canVoid = computed(() => auth.can('payments.void'))

// Record
const recordOpen = ref(false)
const form = ref({
  amount: null as number | null,
  method: 'cash' as PaymentMethod,
  reference: '',
  note: '',
  paidOn: new Date() as Date | null,
})
const saving = ref(false)
const errors = ref<Record<string, string[]>>({})
const error = ref<string | null>(null)
const needsReference = computed(() => methodNeedsReference(form.value.method))
function openRecord() {
  form.value = {
    amount: info.value?.balance ?? info.value?.due ?? null,
    method: (methodOptions.value[0]?.value ?? 'cash') as PaymentMethod,
    reference: '',
    note: '',
    paidOn: new Date(),
  }
  errors.value = {}
  error.value = null
  recordOpen.value = true
}
const ready = computed(
  () =>
    !!form.value.amount &&
    form.value.amount > 0 &&
    (!needsReference.value || !!form.value.reference.trim()),
)
async function record() {
  if (!ready.value || form.value.amount === null) return
  saving.value = true
  errors.value = {}
  error.value = null
  try {
    const payment = await tenantApi.payments.record(props.bookingId, {
      amount: form.value.amount,
      method: form.value.method,
      reference: form.value.reference.trim() || null,
      note: form.value.note.trim() || null,
      paid_on: form.value.paidOn ? isoDay(form.value.paidOn) : null,
    })
    recordOpen.value = false
    toast.add({
      severity: 'success',
      summary: t('payments.recorded', { receipt: payment.receipt_number }),
      detail: format.money(payment.amount),
      life: 5000,
    })
    await load()
    emit('changed')
  } catch (e) {
    errors.value = validationErrors(e)
    error.value =
      apiMessage(e) ?? (Object.keys(errors.value).length ? null : t('common.genericError'))
  } finally {
    saving.value = false
  }
}

// Void
const voiding = ref<Payment | null>(null)
const voidOpen = ref(false)
async function voidPayment(reason: string) {
  if (!voiding.value) return
  saving.value = true
  try {
    await tenantApi.payments.void(voiding.value.id, reason)
    voidOpen.value = false
    await load()
    emit('changed')
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}

const receiptUrl = (p: Payment) => `/receipts/${p.id}`
</script>

<template>
  <section class="pay">
    <div class="pay__head">
      <h3 class="section-title">{{ t('payments.title') }}</h3>
      <Tag
        v-if="info"
        class="tag-sm"
        :severity="SEVERITY[info.status]"
        :value="t(`payments.status.${info.status}`)"
      />
    </div>

    <Skeleton v-if="state === 'loading'" height="48px" />
    <Message v-else-if="state === 'error'" severity="error" :closable="false">{{
      t('payments.loadError')
    }}</Message>
    <template v-else-if="info">
      <dl v-if="info.required" class="pay__sums">
        <template v-if="info.due !== null">
          <dt>{{ t('payments.price') }}</dt>
          <dd class="num">{{ format.money(info.price!) }}</dd>
          <template v-if="info.rate">
            <dt>{{ t('payments.vat', { rate: Number(info.rate) }) }}</dt>
            <dd class="num">{{ format.money(info.vat!) }}</dd>
          </template>
          <dt>{{ t('payments.total') }}</dt>
          <dd class="num strong">{{ format.money(info.due) }}</dd>
        </template>
        <dt>{{ t('payments.paid') }}</dt>
        <dd class="num">{{ format.money(info.paid) }}</dd>
        <template v-if="info.balance">
          <dt>{{ t('payments.balance') }}</dt>
          <dd class="num strong">{{ format.money(info.balance) }}</dd>
        </template>
      </dl>
      <p v-else class="muted">{{ t('payments.notRequired') }}</p>
      <p v-if="info.required && info.due === null" class="muted">{{ t('payments.noPrice') }}</p>

      <ul v-if="info.payments.length" class="pay__list">
        <li v-for="p in info.payments" :key="p.id" :class="{ voided: p.status === 'Voided' }">
          <span class="pay__line">
            <span class="num strong">{{ format.money(p.amount) }}</span>
            <span>{{ t(`payments.methods.${p.method}`) }}</span>
            <span v-if="p.reference" class="muted" dir="ltr">{{ p.reference }}</span>
            <span class="muted mono">{{ p.receipt_number }}</span>
          </span>
          <small class="muted">
            {{ p.recorded_at ? format.dateTime(p.recorded_at, timezone) : '' }} ·
            {{ p.recorded_by }}
            <template v-if="p.status === 'Voided'"
              >·
              {{ t('payments.voidedBy', { name: p.voided_by, reason: p.void_reason }) }}</template
            >
          </small>
          <span class="pay__actions">
            <a :href="receiptUrl(p)" target="_blank" rel="noopener">{{ t('payments.receipt') }}</a>
            <Button
              v-if="canVoid && p.status === 'Recorded'"
              size="small"
              variant="text"
              severity="danger"
              :label="t('payments.void')"
              @click="
                () => {
                  voiding = p
                  voidOpen = true
                }
              "
            />
          </span>
        </li>
      </ul>

      <Button
        v-if="canRecord && info.status !== 'paid'"
        icon="pi pi-wallet"
        :label="t('payments.record')"
        severity="secondary"
        variant="outlined"
        @click="openRecord"
      />
    </template>
  </section>

  <Dialog
    v-model:visible="recordOpen"
    modal
    :header="t('payments.record')"
    :style="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="form">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="pay-amount" class="field__label">{{ t('payments.amount') }} *</label>
        <InputNumber
          v-model="form.amount"
          input-id="pay-amount"
          mode="currency"
          :currency="info?.currency ?? 'SAR'"
          :min="0"
          :max="1000000"
          :max-fraction-digits="3"
          :invalid="!!errors.amount"
          fluid
        />
        <small class="muted">{{ t('payments.amountHint') }}</small>
      </div>
      <div class="field">
        <label for="pay-method" class="field__label">{{ t('payments.method') }}</label>
        <Select
          v-model="form.method"
          input-id="pay-method"
          :options="methodOptions"
          option-label="label"
          option-value="value"
          fluid
        />
      </div>
      <div class="field">
        <label for="pay-date" class="field__label">{{ t('recordPayment.paidOn') }}</label>
        <DatePicker
          v-model="form.paidOn"
          input-id="pay-date"
          :max-date="new Date()"
          show-icon
          icon-display="input"
          fluid
        />
      </div>
      <div class="field">
        <label for="pay-ref" class="field__label"
          >{{ t('payments.reference') }}<template v-if="needsReference"> *</template></label
        >
        <InputText
          id="pay-ref"
          v-model="form.reference"
          dir="ltr"
          maxlength="100"
          :invalid="!!errors.reference"
        />
      </div>
      <div class="field">
        <label for="pay-note" class="field__label">{{ t('payments.note') }}</label>
        <InputText id="pay-note" v-model="form.note" maxlength="500" />
      </div>
      <small class="muted">{{ t('payments.immutable') }}</small>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="recordOpen = false"
      />
      <Button :label="t('payments.save')" :loading="saving" :disabled="!ready" @click="record" />
    </template>
  </Dialog>

  <OverrideDialog
    v-model:visible="voidOpen"
    :title="t('payments.voidTitle', { receipt: voiding?.receipt_number })"
    :description="t('payments.voidBody')"
    :confirm-label="t('payments.void')"
    :loading="saving"
    destructive
    @confirm="voidPayment"
  />
</template>

<style scoped>
.pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pay__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title {
  font: var(--text-h4);
  margin: 0;
}
.pay__sums {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 16px;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-sunken);
}
.pay__sums dd {
  margin: 0;
  text-align: end;
}
.strong {
  font-weight: 600;
}
.pay__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pay__list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}
.pay__list li.voided .pay__line {
  text-decoration: line-through;
  color: var(--text-muted);
}
.pay__line {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: baseline;
}
.pay__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font: 500 14px var(--font-sans);
}
</style>
