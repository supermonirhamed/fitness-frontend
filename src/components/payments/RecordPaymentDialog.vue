<script setup lang="ts">
// Record a payment from a client (US-07.03): amount, method (those the current branch takes),
// reference when the branch asks for one, the date it was received and a note. It pays the open
// invoices ticked, oldest first; the split is previewed. More than they owe becomes account credit
// once staff confirm it; paying with account credit spends the client's balance.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type Invoice, type Payment, type PaymentMethod } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{
  clientId: number
  /** The client's open invoices, oldest first. */
  invoices: Invoice[]
  /** Pay just this one (from its row); otherwise all are ticked. */
  invoiceId?: number | null
  credit: number
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [payment: Payment] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const org = useOrganization()
const currency = computed(() => org.organization?.currency ?? 'SAR')
const locationId = computed(
  () => auth.currentLocation?.id ?? auth.user?.switchable_locations?.[0]?.id ?? null,
)
const { options, needsReference } = usePaymentMethods(locationId)

const open = computed(() =>
  [...props.invoices]
    .filter((i) => i.status === 'Due' || i.status === 'PartiallyPaid')
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id),
)
const picked = ref<number[]>([])
const form = ref({
  amount: null as number | null,
  method: 'cash' as PaymentMethod,
  reference: '',
  note: '',
  paidOn: new Date() as Date | null,
})
const toCredit = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})

const methodOptions = computed(() =>
  options.value.filter((o) => o.value !== 'account_credit' || props.credit > 0),
)
const owed = computed(() =>
  open.value.filter((i) => picked.value.includes(i.id)).reduce((sum, i) => sum + i.balance, 0),
)
watch(visible, (isOpen) => {
  if (!isOpen) return
  picked.value = props.invoiceId ? [props.invoiceId] : open.value.map((i) => i.id)
  form.value = {
    amount: Math.round(owed.value * 1000) / 1000 || null,
    method: (options.value[0]?.value ?? 'cash') as PaymentMethod,
    reference: '',
    note: '',
    paidOn: new Date(),
  }
  toCredit.value = false
  error.value = null
  errors.value = {}
})

// How the amount splits over the ticked invoices, oldest first.
const split = computed(() => {
  let left = form.value.amount ?? 0
  return open.value
    .filter((i) => picked.value.includes(i.id))
    .map((i) => {
      const part = Math.min(left, i.balance)
      left = Math.round((left - part) * 1000) / 1000
      return { invoice: i, part }
    })
})
const extra = computed(() =>
  Math.max(0, Math.round(((form.value.amount ?? 0) - owed.value) * 1000) / 1000),
)
const ready = computed(
  () =>
    !!form.value.amount &&
    form.value.amount > 0 &&
    (!needsReference(form.value.method) || !!form.value.reference.trim()) &&
    (form.value.method !== 'account_credit' ||
      (form.value.amount <= props.credit && extra.value === 0)) &&
    (extra.value === 0 || toCredit.value),
)

async function save() {
  if (!ready.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const payment = await tenantApi.clients.recordPayment(props.clientId, {
      amount: form.value.amount!,
      method: form.value.method,
      reference: form.value.reference.trim() || null,
      note: form.value.note.trim() || null,
      paid_on: form.value.paidOn ? isoDay(form.value.paidOn) : null,
      location_id: locationId.value,
      invoice_ids: open.value.filter((i) => picked.value.includes(i.id)).map((i) => i.id),
      overpayment_to_credit: extra.value > 0,
    })
    visible.value = false
    toast.add({
      severity: 'success',
      summary: t('payments.recorded', { receipt: payment.receipt_number }),
      detail: format.money(payment.amount),
      life: 5000,
    })
    emit('saved', payment)
  } catch (e) {
    errors.value = validationErrors(e)
    error.value =
      apiMessage(e) ?? (Object.keys(errors.value).length ? null : t('common.genericError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('recordPayment.title')"
    icon="pi-wallet"
    size="md"
    :save-label="t('payments.save')"
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <div class="grid2">
      <FormField :label="t('payments.amount')" for="rp-amount" required :error="errors.amount?.[0]">
        <InputNumber
          v-model="form.amount"
          input-id="rp-amount"
          mode="currency"
          :currency="currency"
          :min="0"
          :max-fraction-digits="3"
          fluid
        />
      </FormField>
      <FormField :label="t('recordPayment.paidOn')" for="rp-date" :error="errors.paid_on?.[0]">
        <DatePicker
          v-model="form.paidOn"
          input-id="rp-date"
          :max-date="new Date()"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
      <FormField :label="t('payments.method')" for="rp-method" required :error="errors.method?.[0]">
        <Select
          v-model="form.method"
          input-id="rp-method"
          :options="methodOptions"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
      <FormField
        :label="t('payments.reference')"
        for="rp-ref"
        :required="needsReference(form.method)"
        :error="errors.reference?.[0]"
      >
        <InputText id="rp-ref" v-model="form.reference" dir="ltr" maxlength="100" fluid />
      </FormField>
    </div>
    <Message
      v-if="form.method === 'account_credit'"
      severity="secondary"
      :closable="false"
      size="small"
      >{{ t('recordPayment.creditBalance', { amount: format.money(credit) }) }}</Message
    >

    <div v-if="open.length" class="invoices">
      <span class="label">{{ t('recordPayment.applyTo') }}</span>
      <label v-for="row in open" :key="row.id" class="invoice">
        <Checkbox v-model="picked" :value="row.id" :input-id="`rp-inv-${row.id}`" />
        <span class="invoice__what">
          <span class="mono">{{ row.number }}</span>
          <small class="muted">{{
            t('recordPayment.dueOn', { date: format.date(row.due_on) })
          }}</small>
        </span>
        <span class="num muted">{{
          t('recordPayment.owes', { amount: format.money(row.balance) })
        }}</span>
        <strong class="num part">{{
          format.money(split.find((s) => s.invoice.id === row.id)?.part ?? 0)
        }}</strong>
      </label>
    </div>
    <Message v-else severity="secondary" :closable="false" size="small">{{
      t('recordPayment.noOpen')
    }}</Message>

    <div v-if="extra > 0" class="extra">
      <Message
        :severity="form.method === 'account_credit' ? 'error' : 'warn'"
        :closable="false"
        size="small"
        >{{
          form.method === 'account_credit'
            ? t('recordPayment.creditMoreThanOwed')
            : t('recordPayment.extra', { amount: format.money(extra) })
        }}</Message
      >
      <div v-if="form.method !== 'account_credit'" class="check">
        <Checkbox v-model="toCredit" input-id="rp-credit" binary />
        <label for="rp-credit">{{
          t('recordPayment.keepAsCredit', { amount: format.money(extra) })
        }}</label>
      </div>
    </div>

    <FormField :label="t('payments.note')" for="rp-note">
      <InputText id="rp-note" v-model="form.note" maxlength="500" fluid />
    </FormField>
    <small class="muted">{{ t('payments.immutable') }}</small>
  </FormDialog>
</template>

<style scoped>
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.label {
  font: 500 14px var(--font-sans);
}
.invoices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.invoice {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  cursor: pointer;
}
.invoice__what {
  display: flex;
  flex-direction: column;
}
.part {
  min-width: 90px;
  text-align: end;
}
.mono {
  font-family: var(--font-mono);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.extra {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
