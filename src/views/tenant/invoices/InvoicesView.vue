<script setup lang="ts">
// Invoices (US-07.05): every invoice at the user's branches, to view and follow up. Search by
// number or client; filter by status, open or overdue, branch, issue dates, what was sold and who
// issued it. Totals (void invoices left out) and overdue ones stand out.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar, { type FilterChip } from '@/components/patterns/FilterBar.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type Invoice, type InvoiceFilters, type InvoiceTotals } from '@/api/tenant'
import { isoDay } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const PER_PAGE = 25
const KINDS = [
  'membership',
  'package',
  'membership_period',
  'joining_fee',
  'plan_change',
  'freeze_fee',
  'commitment',
  'drop_in',
  'late_cancel_fee',
  'no_show_fee',
  'product',
]
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const invoices = ref<Invoice[]>([])
const totals = ref<InvoiceTotals | null>(null)
const total = ref(0)
const page = ref(1)

const search = ref('')
const statuses = ref<Invoice['status'][]>([])
// The Today page links here with ?due=overdue.
const due = ref<'all' | 'open' | 'overdue'>(
  route.query.due === 'overdue' || route.query.due === 'open' ? route.query.due : 'all',
)
const locationId = ref<number | null>(null)
const dates = ref<(Date | null)[] | null>(null)
const kind = ref<string | null>(null)
const createdBy = ref<number | null>(null)
const staff = ref<{ id: number; name: string }[]>([])
const branches = computed(() => auth.user?.switchable_locations ?? [])

const filters = computed<InvoiceFilters>(() => ({
  q: search.value.trim() || undefined,
  status: statuses.value.length ? statuses.value : undefined,
  due: due.value === 'all' ? undefined : due.value,
  location_id: locationId.value ?? undefined,
  from: dates.value?.[0] ? isoDay(dates.value[0]) : undefined,
  to: dates.value?.[1]
    ? isoDay(dates.value[1])
    : dates.value?.[0]
      ? isoDay(dates.value[0])
      : undefined,
  kind: kind.value ?? undefined,
  created_by: createdBy.value ?? undefined,
}))

let seq = 0
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const result = await tenantApi.invoices.list({
      ...filters.value,
      page: page.value,
      per_page: PER_PAGE,
    })
    if (mine !== seq) return
    invoices.value = result.data
    total.value = result.meta.total
    totals.value = result.totals
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  filters,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      page.value = 1
      load()
    }, 300)
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

const statusOptions = computed(() =>
  (['Due', 'PartiallyPaid', 'Paid', 'Void'] as const).map((s) => ({
    value: s,
    label: t(`status.${s}`),
  })),
)
const dueOptions = computed(() =>
  (['all', 'open', 'overdue'] as const).map((v) => ({
    value: v,
    label: t(`invoicesPage.due.${v}`),
  })),
)
const kindOptions = computed(() =>
  KINDS.map((k) => ({ value: k, label: t(`invoices.kinds.${k}`) })),
)
const morePanel = ref<InstanceType<typeof Popover>>()
const moreCount = computed(
  () =>
    [locationId.value, dates.value?.[0], kind.value, createdBy.value].filter((v) => v != null)
      .length,
)
const chips = computed<FilterChip[]>(() => {
  const list: FilterChip[] = []
  if (statuses.value.length)
    list.push({ key: 'status', label: statuses.value.map((s) => t(`status.${s}`)).join('، ') })
  if (due.value !== 'all') list.push({ key: 'due', label: t(`invoicesPage.due.${due.value}`) })
  if (locationId.value)
    list.push({
      key: 'location',
      label: branches.value.find((b) => b.id === locationId.value)?.name ?? '',
    })
  if (dates.value?.[0])
    list.push({
      key: 'dates',
      label: `${format.date(dates.value[0])}${dates.value[1] ? ` – ${format.date(dates.value[1])}` : ''}`,
    })
  if (kind.value) list.push({ key: 'kind', label: t(`invoices.kinds.${kind.value}`) })
  if (createdBy.value)
    list.push({
      key: 'staff',
      label: staff.value.find((u) => u.id === createdBy.value)?.name ?? '',
    })
  return list
})
function removeFilter(key: string) {
  if (key === 'status') statuses.value = []
  if (key === 'due') due.value = 'all'
  if (key === 'location') locationId.value = null
  if (key === 'dates') dates.value = null
  if (key === 'kind') kind.value = null
  if (key === 'staff') createdBy.value = null
}
function clearAll() {
  search.value = ''
  statuses.value = []
  due.value = 'all'
  locationId.value = null
  dates.value = null
  kind.value = null
  createdBy.value = null
}
const filtered = computed(() => Object.values(filters.value).some((v) => v !== undefined))
const what = (i: Invoice) => (i.lines ?? []).map((l) => l.description).join(' + ')
const range = computed(() =>
  t('clients.range', {
    from: total.value ? (page.value - 1) * PER_PAGE + 1 : 0,
    to: Math.min(page.value * PER_PAGE, total.value),
    total: total.value,
  }),
)
const open = (i: Invoice) => router.push({ name: 'tenant.invoice', params: { id: i.id } })
</script>

<template>
  <div class="page">
    <PageHeader :title="t('invoicesPage.title')">
      <template v-if="totals" #meta>
        <span>{{ t('invoicesPage.count', totals.count) }}</span>
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <div v-if="totals" class="stats">
        <div class="stat card">
          <span class="stat__label">{{ t('invoicesPage.billed') }}</span>
          <strong class="num">{{ format.money(totals.total) }}</strong>
        </div>
        <div class="stat card">
          <span class="stat__label">{{ t('invoicesPage.outstanding') }}</span>
          <strong class="num">{{ format.money(totals.balance) }}</strong>
        </div>
        <button
          type="button"
          :class="['stat', 'card', 'stat--link', { 'stat--danger': totals.overdue > 0 }]"
          @click="due = 'overdue'"
        >
          <span class="stat__label">{{ t('invoicesPage.overdue') }}</span>
          <strong class="num">{{ totals.overdue }}</strong>
        </button>
      </div>

      <FilterBar
        v-model:search="search"
        :placeholder="t('invoicesPage.search')"
        :chips="chips"
        @remove="removeFilter"
        @clear="clearAll"
      >
        <MultiSelect
          v-model="statuses"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('clients.filters.allStatuses')"
          :max-selected-labels="1"
          :selected-items-label="t('clients.filters.nStatuses', { n: statuses.length })"
          class="filter"
        />
        <SelectButton
          v-model="due"
          :options="dueOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('invoicesPage.dueLabel')"
        />
        <Button
          :label="t('clients.filters.more')"
          icon="pi pi-filter"
          severity="secondary"
          variant="outlined"
          :badge="moreCount ? String(moreCount) : undefined"
          @click="morePanel?.toggle($event)"
        />
      </FilterBar>
      <Popover ref="morePanel">
        <div class="more">
          <FormField v-if="branches.length > 1" :label="t('invoices.branch')" for="inv-branch">
            <Select
              v-model="locationId"
              input-id="inv-branch"
              :options="branches"
              option-label="name"
              option-value="id"
              :placeholder="t('clients.filters.anyBranch')"
              show-clear
              fluid
            />
          </FormField>
          <FormField :label="t('invoicesPage.issuedBetween')" for="inv-dates">
            <DatePicker
              v-model="dates"
              input-id="inv-dates"
              selection-mode="range"
              :manual-input="false"
              show-icon
              icon-display="input"
              show-button-bar
              fluid
            />
          </FormField>
          <FormField :label="t('invoicesPage.productType')" for="inv-kind">
            <Select
              v-model="kind"
              input-id="inv-kind"
              :options="kindOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('invoicesPage.anyType')"
              show-clear
              fluid
            />
          </FormField>
          <FormField v-if="staff.length" :label="t('invoices.issuedBy')" for="inv-staff">
            <Select
              v-model="createdBy"
              input-id="inv-staff"
              :options="staff"
              option-label="name"
              option-value="id"
              :placeholder="t('invoicesPage.anyone')"
              show-clear
              filter
              fluid
            />
          </FormField>
        </div>
      </Popover>

      <ErrorState
        v-if="state === 'error'"
        class="card"
        :title="t('invoicesPage.loadError')"
        @retry="load"
      />
      <DataTable
        v-else
        :value="invoices"
        data-key="id"
        lazy
        paginator
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        :loading="state === 'loading'"
        paginator-template="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        :current-page-report-template="range"
        :row-class="(i: Invoice) => (i.overdue ? 'row-click row-overdue' : 'row-click')"
        @page="onPage"
        @row-click="open($event.data)"
      >
        <template #empty>
          <EmptyState
            compact
            :icon="filtered ? 'pi-search' : 'pi-file'"
            :title="filtered ? t('invoicesPage.noMatch') : t('invoices.empty')"
          />
        </template>
        <Column :header="t('invoices.number')">
          <template #body="{ data }">
            <span class="mono">{{ data.number }}</span>
            <div class="muted">{{ format.date(data.issued_on) }}</div>
          </template>
        </Column>
        <Column :header="t('invoices.payer')">
          <template #body="{ data }">{{ data.client.name ?? t('pos.walkIn') }}</template>
        </Column>
        <Column :header="t('invoices.for')">
          <template #body="{ data }"
            ><span class="what">{{ what(data) }}</span></template
          >
        </Column>
        <Column v-if="branches.length > 1" :header="t('invoices.branch')">
          <template #body="{ data }">{{ data.location }}</template>
        </Column>
        <Column :header="t('invoices.due')">
          <template #body="{ data }">
            <span :class="{ overdue: data.overdue }">{{ format.date(data.due_on) }}</span>
          </template>
        </Column>
        <Column :header="t('invoices.total')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span class="num">{{ format.money(data.total) }}</span></template
          >
        </Column>
        <Column :header="t('invoices.balance')" header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <span :class="['num', { overdue: data.overdue }]">{{
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
      </DataTable>
    </template>
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
.stat {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: start;
  font: inherit;
  color: inherit;
}
.stat strong {
  font: 600 20px var(--font-sans);
}
.stat__label {
  font: var(--text-small);
  color: var(--text-muted);
}
.stat--link {
  cursor: pointer;
}
.stat--danger strong {
  color: var(--sev-danger-fg, var(--red-600));
}
.filter {
  min-width: 150px;
}
.more {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 12px 16px;
  width: min(480px, calc(100vw - 48px));
}
.mono {
  font-family: var(--font-mono);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.what {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 320px;
}
.overdue {
  color: var(--sev-danger-fg, var(--red-600));
  font-weight: 600;
}
.status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
:deep(.row-overdue) {
  background: color-mix(in srgb, var(--sev-danger-bg, #fee2e2) 45%, transparent);
}
</style>
