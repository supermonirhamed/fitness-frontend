<script setup lang="ts">
// Bookings (US-04.09, brief 05 §2): every booking the user can see (their branches, following the
// branch switcher; coaches only their own sessions). Filters: dates, branch, service, coach,
// status, payment source and a client search. Bulk: cancel with a reason, mark attended. Export CSV
// with reports.export. A row opens the booking's details.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import BookingDetailsDrawer from '@/components/bookings/BookingDetailsDrawer.vue'
import BulkActionBar from '@/components/patterns/BulkActionBar.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar from '@/components/patterns/FilterBar.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type Booking, type BookingFilters, type EntitlementSource } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const PER_PAGE = 25
const STATUSES: Booking['status'][] = [
  'Confirmed',
  'Attended',
  'Cancelled',
  'LateCancel',
  'NoShow',
  'CancelledByBusiness',
  'Rescheduled',
]
const SOURCES: EntitlementSource[] = ['pay_at_desk', 'complimentary', 'drop_in', 'guest_pass']

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const bookings = ref<Booking[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
// The coming week by default.
const range = ref<(Date | null)[] | null>([new Date(), new Date(Date.now() + 7 * 864e5)])
const statuses = ref<Booking['status'][]>([])
const serviceId = ref<number | null>(null)
const coachId = ref<number | null>(null)
const locationId = ref<number | null>(null)
const source = ref<EntitlementSource | null>(null)
const options = ref<Awaited<ReturnType<typeof tenantApi.bookings.filterOptions>>>({
  services: [],
  coaches: [],
  locations: [],
})

const ymd = (d: Date | null | undefined) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : undefined
const filters = computed<BookingFilters>(() => ({
  q: search.value.trim() || undefined,
  from: ymd(range.value?.[0]),
  to: ymd(range.value?.[1] ?? range.value?.[0]),
  status: statuses.value.length ? statuses.value : undefined,
  service_id: serviceId.value ?? undefined,
  coach_id: coachId.value ?? undefined,
  location_id: locationId.value ?? undefined,
  entitlement_source: source.value ?? undefined,
}))

let request = 0
async function load() {
  const mine = ++request
  state.value = 'loading'
  try {
    const result = await tenantApi.bookings.list({
      ...filters.value,
      page: page.value,
      per_page: PER_PAGE,
    })
    if (mine !== request) return
    bookings.value = result.data
    total.value = result.meta.total
    selected.value = []
    state.value = 'ready'
  } catch (e) {
    if (mine === request) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
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
  try {
    options.value = await tenantApi.bookings.filterOptions()
  } catch {
    // Filters still work by search and dates.
  }
})
function onPage(e: DataTablePageEvent) {
  page.value = e.page + 1
  load()
}
const filtered = computed(
  () =>
    !!search.value ||
    statuses.value.length > 0 ||
    !!serviceId.value ||
    !!coachId.value ||
    !!locationId.value ||
    !!source.value,
)
function clearFilters() {
  search.value = ''
  statuses.value = []
  serviceId.value = null
  coachId.value = null
  locationId.value = null
  source.value = null
}

const statusOptions = computed(() => STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })))
const sourceOptions = computed(() =>
  SOURCES.map((s) => ({ value: s, label: t(`booking.payments.${s}`) })),
)

// Details
const detailsOpen = ref(false)
const openId = ref<number | null>(null)
function open(b: Booking) {
  openId.value = b.id
  detailsOpen.value = true
}

// Bulk (US-04.09)
const selected = ref<Booking[]>([])
const canCancel = computed(() => auth.can('bookings.delete'))
const canAttend = computed(() => auth.can('attendance.update'))
const cancelOpen = ref(false)
const bulkBusy = ref(false)
async function bulk(action: 'cancel' | 'attend', reason?: string) {
  bulkBusy.value = true
  try {
    const result = await tenantApi.bookings.bulk({
      action,
      ids: selected.value.map((b) => b.id),
      reason,
    })
    toast.add({
      severity: result.failed.length ? 'warn' : 'success',
      summary: t(action === 'cancel' ? 'bookings.bulk.cancelled' : 'bookings.bulk.attended', {
        n: result.done,
      }),
      detail: result.failed.length
        ? t('bookings.bulk.failed', { n: result.failed.length, reason: result.failed[0]!.message })
        : undefined,
      life: 5000,
    })
    cancelOpen.value = false
    load()
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    bulkBusy.value = false
  }
}

const canExport = computed(() => auth.can('reports.export'))
function exportCsv() {
  window.location.href = tenantApi.bookings.exportUrl(filters.value)
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('bookings.title')">
      <template v-if="state === 'ready'" #meta>
        <span>{{ t('bookings.count', total) }}</span>
      </template>
      <template v-if="canExport" #actions>
        <Button
          icon="pi pi-download"
          :label="t('bookings.export')"
          severity="secondary"
          variant="outlined"
          @click="exportCsv"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <FilterBar v-model:search="search" :placeholder="t('bookings.search')">
        <DatePicker
          v-model="range"
          selection-mode="range"
          date-format="yy-mm-dd"
          :manual-input="false"
          :placeholder="t('bookings.dates')"
          :aria-label="t('bookings.dates')"
          show-icon
          icon-display="input"
          show-button-bar
          class="filter"
        />
        <MultiSelect
          v-model="statuses"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('bookings.status')"
          :max-selected-labels="1"
          class="filter"
        />
        <Select
          v-model="serviceId"
          :options="options.services"
          option-label="name"
          option-value="id"
          :placeholder="t('bookings.service')"
          show-clear
          filter
          class="filter"
        />
        <Select
          v-if="options.coaches.length"
          v-model="coachId"
          :options="options.coaches"
          option-label="name"
          option-value="id"
          :placeholder="t('bookings.coach')"
          show-clear
          class="filter"
        />
        <Select
          v-if="options.locations.length > 1"
          v-model="locationId"
          :options="options.locations"
          option-label="name"
          option-value="id"
          :placeholder="t('bookings.branch')"
          show-clear
          class="filter"
        />
        <Select
          v-model="source"
          :options="sourceOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('booking.payment')"
          show-clear
          class="filter"
        />
        <template #end>
          <Button
            v-if="filtered"
            :label="t('bookings.clear')"
            variant="text"
            severity="secondary"
            @click="clearFilters"
          />
        </template>
      </FilterBar>

      <BulkActionBar
        v-if="selected.length"
        :label="t('bookings.bulk.selected', { n: selected.length })"
        @clear="selected = []"
      >
        <Button
          v-if="canAttend"
          size="small"
          severity="contrast"
          icon="pi pi-check"
          :label="t('bookings.bulk.attend')"
          :loading="bulkBusy"
          @click="bulk('attend')"
        />
        <Button
          v-if="canCancel"
          size="small"
          severity="contrast"
          icon="pi pi-times"
          :label="t('bookings.bulk.cancel')"
          @click="cancelOpen = true"
        />
      </BulkActionBar>

      <ErrorState
        v-if="state === 'error'"
        class="card"
        :title="t('bookings.loadError')"
        @retry="load"
      />
      <DataTable
        v-else
        v-model:selection="selected"
        :value="bookings"
        data-key="id"
        lazy
        paginator
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        :loading="state === 'loading'"
        :row-class="() => 'row-click'"
        @page="onPage"
        @row-click="open($event.data)"
      >
        <template #empty>
          <EmptyState
            compact
            icon="pi-calendar"
            :title="filtered ? t('bookings.noMatch') : t('bookings.empty')"
            :body="filtered ? t('bookings.noMatchHint') : t('bookings.emptyHint')"
          />
        </template>
        <template #loading>
          <div class="skeleton"><Skeleton v-for="n in 3" :key="n" height="20px" /></div>
        </template>
        <Column
          v-if="canCancel || canAttend"
          selection-mode="multiple"
          header-style="width: 3rem"
        />
        <Column :header="t('bookings.columns.when')">
          <template #body="{ data }">
            <span v-if="data.session" class="when">
              <span class="num">{{ data.session.local.date }}</span>
              <small dir="ltr" class="muted num"
                >{{ data.session.local.start }}–{{ data.session.local.end }}</small
              >
            </span>
          </template>
        </Column>
        <Column :header="t('bookings.columns.client')">
          <template #body="{ data }">
            <div class="person">
              <PersonAvatar :name="data.client.name ?? ''" :image="data.client.photo_url" />
              <div>
                <div class="person__name">{{ data.client.name }}</div>
                <div class="muted">
                  {{
                    data.host
                      ? t('booking.guestOf', { name: data.host.name })
                      : data.client.member_id
                  }}
                </div>
              </div>
            </div>
          </template>
        </Column>
        <Column :header="t('bookings.columns.session')">
          <template #body="{ data }">
            <div v-if="data.session">
              <div>{{ data.session.service }}</div>
              <div class="muted">
                {{ [data.session.location.name, data.session.coach].filter(Boolean).join(' · ') }}
              </div>
            </div>
          </template>
        </Column>
        <Column :header="t('bookings.columns.status')">
          <template #body="{ data }"><StatusTag :status="data.status" size="sm" /></template>
        </Column>
        <Column :header="t('booking.payment')">
          <template #body="{ data }">
            {{ data.entitlement_source ? t(`booking.payments.${data.entitlement_source}`) : '—' }}
          </template>
        </Column>
        <Column :header="t('sessionPage.roster.bookedBy')">
          <template #body="{ data }">
            <span class="muted">{{ data.booked_by ?? '—' }}</span>
          </template>
        </Column>
      </DataTable>
    </template>

    <BookingDetailsDrawer v-model:visible="detailsOpen" :booking-id="openId" @changed="load" />
    <OverrideDialog
      v-model:visible="cancelOpen"
      :title="t('bookings.bulk.cancelTitle', { n: selected.length })"
      :description="t('bookings.bulk.cancelBody')"
      :confirm-label="t('bookings.bulk.cancel')"
      :loading="bulkBusy"
      destructive
      @confirm="(reason: string) => bulk('cancel', reason)"
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
.filter {
  min-width: 160px;
}
.person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.person__name {
  font: 500 14px/1.4 var(--font-sans);
}
.when {
  display: flex;
  flex-direction: column;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
