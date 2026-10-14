<script setup lang="ts">
// A client's invoices as payer (US-06.08: membership and package sales; renewals, US-06.10): what
// each was for, its total, paid amount and balance, open ones first. Staff with payments.create
// record a payment (US-07.03) for one open invoice or across several, oldest first. The client's account credit
// (from an immediate downgrade, US-06.12, or a cancellation refund, US-06.13) shows in the header.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import InvoiceDetailsDialog from '@/components/clients/InvoiceDetailsDialog.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type Invoice } from '@/api/tenant'
import RecordPaymentDialog from '@/components/payments/RecordPaymentDialog.vue'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const emit = defineEmits<{ paid: [] }>()
const { t } = useI18n()
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

// The whole invoice (US-07.01).
const detailsOpen = ref(false)
const detailsId = ref<number | null>(null)
function openDetails(i: Invoice) {
  detailsId.value = i.id
  detailsOpen.value = true
}

const what = (i: Invoice) => (i.lines ?? []).map((l) => l.description).join(' + ')
const isOpen = (i: Invoice) => i.status === 'Due' || i.status === 'PartiallyPaid'

// Record a payment (US-07.03): for one invoice from its row, or across all open ones.
const paying = ref<number | null>(null)
const open = ref(false)
const anyOpen = computed(() => invoices.value.some(isOpen))
function startPaying(i: Invoice | null) {
  paying.value = i?.id ?? null
  open.value = true
}
async function onPaid() {
  await load()
  emit('paid')
}
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h3>{{ t('invoices.title') }}</h3>
      <span class="head__end">
        <span v-if="credit" class="credit"
          ><i class="pi pi-wallet" aria-hidden="true" />{{
            t('invoices.accountCredit', { amount: format.money(credit) })
          }}</span
        >
        <Button
          v-if="auth.can('payments.create') && anyOpen"
          size="small"
          icon="pi pi-wallet"
          :label="t('recordPayment.title')"
          @click="startPaying(null)"
        />
      </span>
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <DataTable v-else :value="invoices" :loading="state === 'loading'" data-key="id">
      <template #empty>
        <EmptyState compact icon="pi-file" :title="t('invoices.empty')" />
      </template>
      <Column :header="t('invoices.number')">
        <template #body="{ data }">
          <button type="button" class="number" @click="openDetails(data)">
            {{ data.number }}
          </button>
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

  <InvoiceDetailsDialog v-model:visible="detailsOpen" :invoice-id="detailsId" />
  <RecordPaymentDialog
    v-model:visible="open"
    :client-id="clientId"
    :invoices="invoices"
    :invoice-id="paying"
    :credit="credit"
    @saved="onPaid"
  />
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
.head__end {
  display: inline-flex;
  gap: 12px;
  align-items: center;
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
.number {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  color: var(--text-link, var(--primary-700));
}
.number:hover {
  text-decoration: underline;
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
:deep(.row-end) {
  text-align: end;
}
</style>
