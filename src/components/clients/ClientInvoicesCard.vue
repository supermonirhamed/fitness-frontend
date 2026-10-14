<script setup lang="ts">
// A client's invoices as payer (US-06.08: membership and package sales; renewals, US-06.10): what
// each was for, its total, paid amount and balance, open ones first. Staff with payments.create
// record a payment against an open invoice, in part or in full. The client's account credit
// (from an immediate downgrade, US-06.12, or a cancellation refund, US-06.13) shows in the header.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type Invoice, type PaymentMethod } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const emit = defineEmits<{ paid: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const invoices = ref<Invoice[]>([])
const credit = ref<number>(0)
async function load() {
  state.value = 'loading'
  try {
    const [list, account] = await Promise.all([
      tenantApi.invoices.forClient(props.clientId),
      tenantApi.clients.accountCredit(props.clientId).catch(() => null),
    ])
    invoices.value = list
    credit.value = account?.balance ?? 0
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
defineExpose({ load })

const what = (i: Invoice) => (i.lines ?? []).map((l) => l.description).join(' + ')
const isOpen = (i: Invoice) => i.status === 'Due' || i.status === 'PartiallyPaid'

// Record a payment against an invoice.
const paying = ref<Invoice | null>(null)
const open = ref(false)
const form = ref({
  amount: null as number | null,
  method: 'cash' as PaymentMethod,
  reference: '',
  note: '',
})
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})
const methodOptions = computed(() =>
  (['cash', 'bank_transfer', 'card_terminal', 'other'] as PaymentMethod[]).map((m) => ({
    value: m,
    label: t(`payments.methods.${m}`),
  })),
)
const needsReference = computed(() =>
  ['bank_transfer', 'card_terminal'].includes(form.value.method),
)
function startPaying(i: Invoice) {
  paying.value = i
  form.value = { amount: i.balance, method: 'cash', reference: '', note: '' }
  error.value = null
  errors.value = {}
  open.value = true
}
const ready = computed(
  () =>
    !!paying.value &&
    !!form.value.amount &&
    form.value.amount > 0 &&
    form.value.amount <= paying.value.balance &&
    (!needsReference.value || !!form.value.reference.trim()),
)
async function record() {
  if (!ready.value || !paying.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const payment = await tenantApi.invoices.pay(paying.value.id, {
      amount: form.value.amount!,
      method: form.value.method,
      reference: form.value.reference.trim() || null,
      note: form.value.note.trim() || null,
    })
    open.value = false
    toast.add({
      severity: 'success',
      summary: t('payments.recorded', { receipt: payment.receipt_number }),
      detail: format.money(payment.amount),
      life: 5000,
    })
    await load()
    emit('paid')
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
  <section class="card">
    <header class="card__head">
      <h3>{{ t('invoices.title') }}</h3>
      <span v-if="credit" class="credit"
        ><i class="pi pi-wallet" aria-hidden="true" />{{
          t('invoices.accountCredit', { amount: format.money(credit) })
        }}</span
      >
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <DataTable v-else :value="invoices" :loading="state === 'loading'" data-key="id">
      <template #empty>
        <EmptyState compact icon="pi-file" :title="t('invoices.empty')" />
      </template>
      <Column :header="t('invoices.number')">
        <template #body="{ data }">
          <span class="mono">{{ data.number }}</span>
          <div class="muted">{{ format.date(data.issued_on) }}</div>
        </template>
      </Column>
      <Column :header="t('invoices.for')">
        <template #body="{ data }">
          {{ what(data) }}
          <div v-if="data.lines?.[0]?.beneficiary" class="muted">
            {{ t('invoices.forWhom', { name: data.lines[0].beneficiary }) }}
          </div>
        </template>
      </Column>
      <Column :header="t('invoices.total')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <span class="num">{{ format.money(data.total) }}</span>
        </template>
      </Column>
      <Column :header="t('invoices.balance')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <span :class="['num', { due: data.balance > 0 && data.status !== 'Void' }]">{{
            format.money(data.balance)
          }}</span>
        </template>
      </Column>
      <Column :header="t('bookings.columns.status')">
        <template #body="{ data }">
          <span class="status">
            <StatusTag :status="data.status" size="sm" />
            <Tag
              v-if="data.overdue"
              class="tag-sm"
              severity="danger"
              :value="t('invoices.overdue')"
            />
          </span>
        </template>
      </Column>
      <Column v-if="auth.can('payments.create')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <Button
            v-if="isOpen(data)"
            size="small"
            variant="outlined"
            icon="pi pi-wallet"
            :label="t('invoices.pay')"
            @click="startPaying(data)"
          />
        </template>
      </Column>
    </DataTable>
  </section>

  <Dialog
    v-model:visible="open"
    modal
    :header="t('invoices.payTitle', { number: paying?.number ?? '' })"
    :style="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="form">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="inv-pay-amount" class="field__label">{{ t('payments.amount') }} *</label>
        <InputNumber
          v-model="form.amount"
          input-id="inv-pay-amount"
          mode="currency"
          :currency="paying?.currency ?? 'SAR'"
          :min="0"
          :max="paying?.balance"
          :max-fraction-digits="3"
          :invalid="!!errors.amount"
          fluid
        />
        <small class="muted">{{
          t('invoices.balanceHint', { amount: format.money(paying?.balance ?? 0) })
        }}</small>
      </div>
      <div class="field">
        <span id="inv-pay-method" class="field__label">{{ t('payments.method') }}</span>
        <SelectButton
          v-model="form.method"
          :options="methodOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="inv-pay-method"
        />
      </div>
      <div class="field">
        <label for="inv-pay-ref" class="field__label"
          >{{ t('payments.reference') }}<template v-if="needsReference"> *</template></label
        >
        <InputText
          id="inv-pay-ref"
          v-model="form.reference"
          dir="ltr"
          maxlength="100"
          :invalid="!!errors.reference"
        />
      </div>
      <div class="field">
        <label for="inv-pay-note" class="field__label">{{ t('payments.note') }}</label>
        <InputText id="inv-pay-note" v-model="form.note" maxlength="500" />
      </div>
      <small class="muted">{{ t('payments.immutable') }}</small>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="open = false"
      />
      <Button :label="t('payments.save')" :loading="saving" :disabled="!ready" @click="record" />
    </template>
  </Dialog>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.card__head {
  padding: 14px 16px 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.credit {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font: 500 13px var(--font-sans);
  color: var(--sev-success-fg, var(--text-secondary));
}
.card__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.mono {
  font-family: var(--font-mono);
}
.due {
  color: var(--sev-danger-fg, var(--red-600));
  font-weight: 600;
}
.status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
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
:deep(.row-end) {
  text-align: end;
}
</style>
