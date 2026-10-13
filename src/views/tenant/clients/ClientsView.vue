<script setup lang="ts">
// Clients (US-05.01), as the design's ClientsScreen: header with the count and New client, a search
// by name, mobile, email or member ID, and the clients the user can see (their branches, US-00.09;
// coaches only clients booked with them). Filters, last visit, upcoming bookings and CSV export
// (US-05.04); tags, segments and messages join with US-05.12 and EP-12.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar from '@/components/patterns/FilterBar.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import NewClientDrawer from '@/components/clients/NewClientDrawer.vue'
import { tenantApi, type Client, type ClientFilters } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const PER_PAGE = 25
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const auth = useStaffAuth()
const format = useFormat()
const canCreate = computed(() => auth.can('clients.create'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const clients = ref<Client[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const locationId = ref<number | null>(null)
const statuses = ref<Client['status'][]>([])
const age = ref<'any' | 'minor' | 'adult'>('any')
const lastVisit = ref<'any' | 'recent' | 'lapsed' | 'never'>('any')
const created = ref<(Date | null)[] | null>(null)
const ownOnly = computed(() => auth.user?.scope === 'own')
const locations = computed(() => auth.user?.switchable_locations ?? [])

const ymd = (d: Date | null | undefined) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : undefined
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 864e5))
// "Visited in the last 30 days", "Not for 30 days", "Never visited"; minors under 18.
const filters = computed<ClientFilters>(() => ({
  q: search.value.trim() || undefined,
  location_id: locationId.value ?? undefined,
  status: statuses.value.length ? statuses.value : undefined,
  age_max: age.value === 'minor' ? 17 : undefined,
  age_min: age.value === 'adult' ? 18 : undefined,
  last_visit: lastVisit.value === 'never' ? 'never' : undefined,
  visited_from: lastVisit.value === 'recent' ? daysAgo(30) : undefined,
  visited_to: lastVisit.value === 'lapsed' ? daysAgo(30) : undefined,
  created_from: ymd(created.value?.[0]),
  created_to: ymd(created.value?.[1] ?? created.value?.[0]),
}))
const filtered = computed(() => Object.values(filters.value).some((v) => v !== undefined))
function clearFilters() {
  search.value = ''
  locationId.value = null
  statuses.value = []
  age.value = 'any'
  lastVisit.value = 'any'
  created.value = null
}
const statusOptions = computed(() =>
  (['Active', 'Inactive', 'Lead', 'Blocked'] as const).map((s) => ({
    value: s,
    label: t(`status.${s}`),
  })),
)
const ageOptions = computed(() =>
  (['any', 'minor', 'adult'] as const).map((v) => ({
    value: v,
    label: t(`clients.filters.age.${v}`),
  })),
)
const visitOptions = computed(() =>
  (['any', 'recent', 'lapsed', 'never'] as const).map((v) => ({
    value: v,
    label: t(`clients.filters.visit.${v}`),
  })),
)
const canExport = computed(() => auth.can('clients.export'))
function exportCsv() {
  window.location.href = tenantApi.clients.exportUrl(filters.value)
}

let request = 0
async function load() {
  const mine = ++request
  state.value = 'loading'
  try {
    const result = await tenantApi.clients.list({
      ...filters.value,
      page: page.value,
      per_page: PER_PAGE,
    })
    if (mine !== request) return
    clients.value = result.data
    total.value = result.meta.total
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
const drawerOpen = ref(false)
onMounted(async () => {
  await load()
  // "New client" from another page (booking, POS) opens the form straight away.
  if (route.query.new === '1' && canCreate.value) {
    drawerOpen.value = true
    router.replace({ query: {} })
  }
})
function onPage(e: DataTablePageEvent) {
  page.value = e.page + 1
  load()
}
const open = (c: Client) => router.push({ name: 'tenant.client', params: { id: c.id } })
function onSaved(client: Client) {
  toast.add({
    severity: 'success',
    summary: t('clients.created', { name: client.name }),
    life: 4000,
  })
  open(client)
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('clients.title')">
      <template v-if="state === 'ready' && !filtered" #meta>
        <span>{{ t('clients.count', total) }}</span>
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
      <template v-if="canCreate" #primary>
        <Button icon="pi pi-user-plus" :label="t('clients.new')" @click="drawerOpen = true" />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <Message v-if="ownOnly" severity="info" :closable="false" icon="pi pi-info-circle">{{
        t('clients.coachOnly')
      }}</Message>
      <FilterBar v-model:search="search" :placeholder="t('clients.search')">
        <Select
          v-if="locations.length > 1"
          v-model="locationId"
          :options="locations"
          option-label="name"
          option-value="id"
          :placeholder="t('clients.filters.home')"
          show-clear
          class="filter"
        />
        <MultiSelect
          v-model="statuses"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('clients.columns.status')"
          :max-selected-labels="1"
          class="filter"
        />
        <Select
          v-model="age"
          :options="ageOptions"
          option-label="label"
          option-value="value"
          class="filter"
        />
        <Select
          v-model="lastVisit"
          :options="visitOptions"
          option-label="label"
          option-value="value"
          class="filter"
        />
        <DatePicker
          v-model="created"
          selection-mode="range"
          date-format="yy-mm-dd"
          :manual-input="false"
          :placeholder="t('clients.filters.created')"
          :aria-label="t('clients.filters.created')"
          show-icon
          icon-display="input"
          show-button-bar
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

      <ErrorState
        v-if="state === 'error'"
        class="card"
        :title="t('clients.loadError')"
        @retry="load"
      />
      <EmptyState
        v-else-if="state === 'ready' && !clients.length && !filtered"
        class="card card--tall"
        icon="pi-users"
        :title="t('clients.empty')"
        :body="t('clients.emptyHint')"
      >
        <Button
          v-if="canCreate"
          icon="pi pi-user-plus"
          :label="t('clients.new')"
          @click="drawerOpen = true"
        />
      </EmptyState>
      <DataTable
        v-else
        :value="clients"
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
            icon="pi-search"
            :title="t('clients.noMatch')"
            :body="t('clients.noMatchHint')"
          />
        </template>
        <template #loading>
          <div class="skeleton"><Skeleton v-for="n in 3" :key="n" height="20px" /></div>
        </template>
        <Column :header="t('clients.columns.client')">
          <template #body="{ data }">
            <div class="person">
              <PersonAvatar :name="data.name" :image="data.photo_url" />
              <div>
                <div class="person__name">{{ data.name }}</div>
                <div class="person__id num">{{ data.member_id }}</div>
              </div>
            </div>
          </template>
        </Column>
        <Column :header="t('clients.columns.mobile')">
          <template #body="{ data }">
            <span v-if="data.contact_hidden" class="muted">{{ t('clients.hidden') }}</span>
            <span v-else dir="ltr" class="num muted">{{ data.mobile ?? data.email }}</span>
          </template>
        </Column>
        <Column :header="t('clients.columns.home')">
          <template #body="{ data }">{{ data.home_location?.name ?? '—' }}</template>
        </Column>
        <Column :header="t('clients.columns.status')">
          <template #body="{ data }"><StatusTag :status="data.status" /></template>
        </Column>
        <Column :header="t('clients.columns.lastVisit')">
          <template #body="{ data }">
            <span class="muted">{{
              data.last_visit_at ? format.date(data.last_visit_at) : t('clients.never')
            }}</span>
          </template>
        </Column>
        <Column :header="t('clients.columns.upcoming')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span class="num">{{ data.upcoming_bookings ?? 0 }}</span></template
          >
        </Column>
        <Column :header="t('clients.columns.since')">
          <template #body="{ data }">
            <span class="muted">{{ data.created_at ? format.date(data.created_at) : '—' }}</span>
          </template>
        </Column>
        <Column header-class="row-end" body-class="row-end">
          <template #body>
            <i class="pi pi-chevron-right pi-dir row-chevron" aria-hidden="true" />
          </template>
        </Column>
      </DataTable>
    </template>

    <NewClientDrawer v-model:visible="drawerOpen" @saved="onSaved" />
  </div>
</template>

<style scoped>
.filter {
  min-width: 150px;
}
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
.card--tall {
  padding: 40px 0;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 16px;
}
.person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.person__name {
  font: 500 14px/1.4 var(--font-sans);
}
.person__id {
  font: var(--text-caption);
  color: var(--text-muted);
}
.muted {
  color: var(--text-secondary);
}
</style>
