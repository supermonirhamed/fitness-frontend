<script setup lang="ts">
// The payments a client made (US-04.15, US-06.08), newest first: date, receipt (opens the printable
// receipt), what it paid for (a booked session, opening the booking, or an invoice's membership or
// package), method, amount and status. Filtered here by what it paid for, method and status.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import RefundDialog from '@/components/payments/RefundDialog.vue'
import VoidPaymentDialog from '@/components/payments/VoidPaymentDialog.vue'
import type { Payment, PaymentMethod } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ payments: Payment[] | null }>()
const emit = defineEmits<{ openBooking: [id: number]; changed: [] }>()
// Voiding (US-07.06).
const voiding = ref<Payment | null>(null)
const voidOpen = ref(false)
function startVoid(p: Payment) {
  voiding.value = p
  voidOpen.value = true
}
// Refunds (US-07.08).
const refunding = ref<Payment | null>(null)
const refundOpen = ref(false)
function startRefund(p: Payment) {
  refunding.value = p
  refundOpen.value = true
}
const { t } = useI18n()
const format = useFormat()

type Kind = 'all' | 'booking' | 'invoice'
const kind = ref<Kind>('all')
const method = ref<PaymentMethod | null>(null)
const status = ref<Payment['status'] | null>(null)
const filtered = computed(() => kind.value !== 'all' || !!method.value || !!status.value)
function clear() {
  kind.value = 'all'
  method.value = null
  status.value = null
}

const kindOptions = computed(() =>
  (['all', 'booking', 'invoice'] as Kind[]).map((v) => ({
    value: v,
    label: t(`clientPayments.kinds.${v}`),
  })),
)
// Only the methods and statuses this client's payments use.
const methodOptions = computed(() =>
  [...new Set((props.payments ?? []).map((p) => p.method))].map((m) => ({
    value: m,
    label: t(`payments.methods.${m}`),
  })),
)
const statusOptions = computed(() =>
  (['Recorded', 'Voided'] as const).map((s) => ({
    value: s,
    label: t(`clientProfile.payment.${s}`),
  })),
)

const rows = computed(() =>
  (props.payments ?? []).filter(
    (p) =>
      (kind.value === 'all' || p.for?.type === kind.value) &&
      (!method.value || p.method === method.value) &&
      (!status.value || p.status === status.value),
  ),
)
const products = (p: Payment) =>
  p.for?.type === 'invoice'
    ? p.for.items
        .filter((i) => i.kind !== 'joining_fee')
        .map((i) => i.description)
        .join(' + ') || p.for.items.map((i) => i.description).join(' + ')
    : ''
const isPackage = (p: Payment) =>
  p.for?.type === 'invoice' && p.for.items.some((i) => i.kind === 'package')
</script>

<template>
  <section class="card">
    <header class="card__head">
      <div class="card__title">
        <h3>{{ t('clientProfile.paymentsTitle') }}</h3>
        <span v-if="payments?.length" class="muted">{{
          filtered
            ? t('clientPayments.shown', { n: rows.length, total: payments.length })
            : t('clientProfile.paymentsCount', payments.length)
        }}</span>
      </div>
      <div v-if="payments?.length" class="filters">
        <SelectButton
          v-model="kind"
          :options="kindOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          size="small"
          :aria-label="t('clientPayments.for')"
        />
        <Select
          v-model="method"
          :options="methodOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('clientPayments.anyMethod')"
          show-clear
          size="small"
          class="filter"
        />
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('clientPayments.anyStatus')"
          show-clear
          size="small"
          class="filter"
        />
      </div>
    </header>
    <DataTable :value="rows" :loading="payments === null" data-key="id">
      <template #empty>
        <EmptyState v-if="filtered" compact icon="pi-filter" :title="t('clientPayments.noMatch')">
          <Button :label="t('filters.clearAll')" variant="text" @click="clear" />
        </EmptyState>
        <EmptyState v-else compact icon="pi-wallet" :title="t('clientProfile.noPayments')" />
      </template>
      <Column :header="t('payments.date')">
        <template #body="{ data }">
          <span class="nowrap">{{
            data.recorded_at ? format.dateTime(data.recorded_at) : ''
          }}</span>
        </template>
      </Column>
      <Column :header="t('payments.receiptNumber')">
        <template #body="{ data }">
          <a :href="`/receipts/${data.id}`" target="_blank" rel="noopener" class="mono">{{
            data.receipt_number
          }}</a>
        </template>
      </Column>
      <Column :header="t('clientPayments.for')">
        <template #body="{ data }">
          <button
            v-if="data.for?.type === 'booking'"
            type="button"
            class="for for--link"
            @click="emit('openBooking', data.for.booking_id)"
          >
            <i class="pi pi-calendar" aria-hidden="true" />
            <span class="for__text">
              <span class="for__what">{{ data.for.service ?? t('clientPayments.booking') }}</span>
              <small v-if="data.for.starts_at" class="muted">{{
                format.dateTime(data.for.starts_at)
              }}</small>
            </span>
          </button>
          <span v-else-if="data.for?.type === 'invoice'" class="for">
            <i :class="['pi', isPackage(data) ? 'pi-ticket' : 'pi-id-card']" aria-hidden="true" />
            <span class="for__text">
              <span class="for__what">{{ products(data) }}</span>
              <small class="muted mono">{{ data.for.invoice }}</small>
            </span>
          </span>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column :header="t('payments.method')">
        <template #body="{ data }">
          {{ t(`payments.methods.${data.method}`) }}
          <small v-if="data.reference" class="muted mono ref">{{ data.reference }}</small>
        </template>
      </Column>
      <Column :header="t('payments.total')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <span :class="['num', { voided: data.status === 'Voided' }]">{{
            format.money(data.amount)
          }}</span>
          <small v-if="data.refunded" class="muted refunded">{{
            t('refunds.refundedAmount', { amount: format.money(data.refunded) })
          }}</small>
        </template>
      </Column>
      <Column :header="t('bookings.columns.status')">
        <template #body="{ data }">
          <Tag
            v-tooltip.top="data.status === 'Voided' ? (data.void_reason ?? undefined) : undefined"
            class="tag-sm"
            :severity="data.status === 'Voided' ? 'secondary' : 'success'"
            :value="t(`clientProfile.payment.${data.status}`)"
          />
        </template>
      </Column>
      <Column header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <Button
            v-if="data.can_refund"
            v-tooltip.top="t('refunds.refund')"
            icon="pi pi-replay"
            size="small"
            variant="text"
            severity="secondary"
            :aria-label="t('refunds.refund')"
            @click="startRefund(data)"
          />
          <Button
            v-if="data.can_void"
            v-tooltip.top="t('voiding.voidPayment')"
            icon="pi pi-ban"
            size="small"
            variant="text"
            severity="danger"
            :aria-label="t('voiding.voidPayment')"
            @click="startVoid(data)"
          />
        </template>
      </Column>
    </DataTable>
    <VoidPaymentDialog v-model:visible="voidOpen" :payment="voiding" @voided="emit('changed')" />
    <RefundDialog v-model:visible="refundOpen" :payment="refunding" @refunded="emit('changed')" />
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.card__head {
  padding: 14px 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.card__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.card__title h3 {
  margin: 0;
  font: var(--text-h4);
}
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.filter {
  min-width: 140px;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.mono {
  font-family: var(--font-mono);
}
.nowrap {
  white-space: nowrap;
}
.ref {
  display: block;
}
.for {
  display: inline-flex;
  gap: 8px;
  align-items: flex-start;
  text-align: start;
}
.for > i {
  margin-top: 3px;
  color: var(--text-muted);
}
.for--link {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.for--link .for__what {
  color: var(--text-link, var(--primary-700));
}
.for--link:hover .for__what {
  text-decoration: underline;
}
.for__text {
  display: flex;
  flex-direction: column;
}
.for__what {
  font-weight: 500;
}
.refunded {
  display: block;
}
.voided {
  text-decoration: line-through;
  color: var(--text-muted);
}
</style>
