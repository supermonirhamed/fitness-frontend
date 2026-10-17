<script setup lang="ts">
// Transactions (US-07.10): every money movement at the user's branches (payments, voids, refunds
// and account credit movements) by branch, method, staff user and local dates, with totals by
// method for reconciling the drawer and the bank. Export to CSV for the accountant
// (payments.export), and the daily close per branch or staff drawer.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import DailyCloseDialog from '@/components/payments/DailyCloseDialog.vue'
import {
  tenantApi,
  type PaymentMethod,
  type Transaction,
  type TransactionFilters,
  type TransactionTotals,
} from '@/api/tenant'
import { isoDay } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const PER_PAGE = 50
const METHODS: PaymentMethod[] = [
  'cash',
  'card_terminal',
  'bank_transfer',
  'cheque',
  'account_credit',
  'other',
]
const TYPES: Transaction['type'][] = ['payment', 'void', 'refund', 'credit']
const { t } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const rows = ref<Transaction[]>([])
const totals = ref<TransactionTotals | null>(null)
const total = ref(0)
const page = ref(1)

const today = new Date()
const dates = ref<(Date | null)[] | null>([today, today])
const locationId = ref<number | null>(auth.currentLocation?.id ?? null)
const method = ref<PaymentMethod | null>(null)
const userId = ref<number | null>(null)
const types = ref<Transaction['type'][]>([])
const staff = ref<{ id: number; name: string }[]>([])
const branches = computed(() => auth.user?.switchable_locations ?? [])

const filters = computed<TransactionFilters>(() => ({
  from: dates.value?.[0] ? isoDay(dates.value[0]) : undefined,
  to: dates.value?.[1]
    ? isoDay(dates.value[1])
    : dates.value?.[0]
      ? isoDay(dates.value[0])
      : undefined,
  location_id: locationId.value ?? undefined,
  method: method.value ?? undefined,
  user_id: userId.value ?? undefined,
  type: types.value.length ? types.value : undefined,
}))

let seq = 0
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const result = await tenantApi.transactions.list({
      ...filters.value,
      page: page.value,
      per_page: PER_PAGE,
    })
    if (mine !== seq) return
    rows.value = result.data
    total.value = result.meta.total
    totals.value = result.totals
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
watch(
  filters,
  () => {
    page.value = 1
    load()
  },
  { deep: true },
)
onMounted(async () => {
  load()
  if (auth.can('staff.view'))
    staff.value = (await tenantApi.users().catch(() => [])).map((u) => ({ id: u.id, name: u.name }))
})
function onPage(e: DataTablePageEvent) {
  page.value = e.page + 1
  load()
}

const methodOptions = computed(() =>
  METHODS.map((m) => ({ value: m, label: t(`payments.methods.${m}`) })),
)
const typeOptions = computed(() =>
  TYPES.map((v) => ({ value: v, label: t(`transactions.types.${v}`) })),
)
const severity = (type: Transaction['type']) =>
  ({ payment: 'success', void: 'danger', refund: 'warn', credit: 'info' })[type]
const range = computed(() =>
  t('clients.range', {
    from: total.value ? (page.value - 1) * PER_PAGE + 1 : 0,
    to: Math.min(page.value * PER_PAGE, total.value),
    total: total.value,
  }),
)
const filtered = computed(
  () => !!(locationId.value || method.value || userId.value || types.value.length),
)
function exportCsv() {
  window.location.href = tenantApi.transactions.exportUrl(filters.value)
}
function openRow(r: Transaction) {
  if (r.payment_id)
    window.open(
      router.resolve({ name: 'tenant.receipt', params: { id: r.payment_id } }).href,
      '_blank',
    )
}
const closing = ref(false)
</script>

<template>
  <div class="page">
    <PageHeader :title="t('transactions.title')">
      <template v-if="totals" #meta>
        <span>{{ t('transactions.count', totals.count) }}</span>
      </template>
      <template #actions>
        <Button
          v-if="auth.can('payments.export')"
          :label="t('transactions.export')"
          icon="pi pi-download"
          severity="secondary"
          variant="outlined"
          :disabled="!total"
          @click="exportCsv"
        />
        <Button
          v-if="auth.can('payments.create')"
          :label="t('dailyClose.title')"
          icon="pi pi-lock"
          @click="closing = true"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <div v-if="totals" class="stats">
        <div class="stat card">
          <span class="stat__label">{{ t('transactions.collected') }}</span>
          <strong class="num">{{ format.money(totals.payments) }}</strong>
        </div>
        <div class="stat card">
          <span class="stat__label">{{ t('transactions.voidsRefunds') }}</span>
          <strong class="num">{{ format.money(totals.voids + totals.refunds) }}</strong>
        </div>
        <div class="stat card">
          <span class="stat__label">{{ t('transactions.net') }}</span>
          <strong class="num">{{ format.money(totals.net) }}</strong>
          <span class="by-method">
            <span v-for="(amount, m) in totals.by_method" :key="m"
              >{{ t(`payments.methods.${m}`) }} {{ format.money(amount ?? 0) }}</span
            >
          </span>
        </div>
      </div>

      <div class="filters card">
        <DatePicker
          v-model="dates"
          selection-mode="range"
          :manual-input="false"
          show-icon
          icon-display="input"
          :aria-label="t('transactions.dates')"
          class="filter"
        />
        <Select
          v-if="branches.length > 1"
          v-model="locationId"
          :options="branches"
          option-label="name"
          option-value="id"
          :placeholder="t('clients.filters.anyBranch')"
          show-clear
          class="filter"
        />
        <Select
          v-model="method"
          :options="methodOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('transactions.anyMethod')"
          show-clear
          class="filter"
        />
        <MultiSelect
          v-model="types"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('transactions.anyType')"
          :max-selected-labels="2"
          class="filter"
        />
        <Select
          v-if="staff.length"
          v-model="userId"
          :options="staff"
          option-label="name"
          option-value="id"
          :placeholder="t('invoicesPage.anyone')"
          show-clear
          filter
          class="filter"
        />
      </div>

      <ErrorState v-if="state === 'error'" class="card" @retry="load" />
      <DataTable
        v-else
        :value="rows"
        :data-key="(r: Transaction) => `${r.type}-${r.id}`"
        lazy
        paginator
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        :loading="state === 'loading'"
        paginator-template="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        :current-page-report-template="range"
        :row-class="(r: Transaction) => (r.payment_id ? 'row-click' : '')"
        @page="onPage"
        @row-click="openRow($event.data)"
      >
        <template #empty>
          <EmptyState
            compact
            :icon="filtered ? 'pi-search' : 'pi-wallet'"
            :title="t('transactions.empty')"
          />
        </template>
        <Column :header="t('transactions.when')">
          <template #body="{ data }">
            <span class="num">{{ format.date(data.date) }}</span>
            <div class="muted">{{ format.time(data.at) }}</div>
          </template>
        </Column>
        <Column :header="t('transactions.type')">
          <template #body="{ data }">
            <Tag
              class="tag-sm"
              :severity="severity(data.type)"
              :value="t(`transactions.types.${data.type}`)"
            />
            <div v-if="data.kind" class="muted">
              {{ t(`accountCredit.kinds.${data.kind}`, data.kind) }}
            </div>
          </template>
        </Column>
        <Column :header="t('transactions.receipt')">
          <template #body="{ data }">
            <span class="mono">{{ data.receipt_number ?? '—' }}</span>
            <div v-if="data.reference" class="muted mono">{{ data.reference }}</div>
          </template>
        </Column>
        <Column :header="t('invoices.payer')">
          <template #body="{ data }">{{ data.client?.name ?? t('pos.walkIn') }}</template>
        </Column>
        <Column v-if="branches.length > 1" :header="t('invoices.branch')">
          <template #body="{ data }">{{ data.location ?? '—' }}</template>
        </Column>
        <Column :header="t('payments.method')">
          <template #body="{ data }">{{
            data.method ? t(`payments.methods.${data.method}`) : '—'
          }}</template>
        </Column>
        <Column :header="t('transactions.staff')">
          <template #body="{ data }">
            {{ data.staff ?? '—' }}
            <div v-if="data.note" class="muted note">{{ data.note }}</div>
          </template>
        </Column>
        <Column :header="t('payments.amount')" header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <span :class="['num', { neg: data.amount < 0, credit: data.type === 'credit' }]">{{
              format.money(data.amount)
            }}</span>
          </template>
        </Column>
      </DataTable>
    </template>

    <DailyCloseDialog
      v-model:visible="closing"
      :branches="branches"
      :staff="staff"
      :location-id="locationId"
      @changed="load"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 720px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
.stat {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat strong {
  font: 600 20px var(--font-sans);
}
.stat__label,
.by-method {
  font: var(--text-small);
  color: var(--text-muted);
}
.by-method {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.filters {
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter {
  min-width: 170px;
}
.mono {
  font-family: var(--font-mono);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.note {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neg {
  color: var(--sev-danger-fg, var(--red-600));
}
.credit {
  color: var(--text-secondary);
  font-style: italic;
}
:deep(.row-end) {
  text-align: end;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
