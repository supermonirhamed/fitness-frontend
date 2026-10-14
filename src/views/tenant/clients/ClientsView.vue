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
import Popover from 'primevue/popover'
import type { MenuItem } from 'primevue/menuitem'
import Select from 'primevue/select'
import BulkActionBar from '@/components/patterns/BulkActionBar.vue'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar, { type FilterChip } from '@/components/patterns/FilterBar.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import NewClientDrawer from '@/components/clients/NewClientDrawer.vue'
import {
  tenantApi,
  type Client,
  type ClientFilters,
  type Segment,
  type Tag as TagItem,
} from '@/api/tenant'
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
// Tags and segments (US-05.12); a segment link opens the list filtered by it.
const tagIds = ref<number[]>([])
const segmentId = ref<number | null>(route.query.segment ? Number(route.query.segment) : null)
const tagOptions = ref<TagItem[]>([])
const segmentOptions = ref<Segment[]>([])
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
  tag_ids: tagIds.value.length ? tagIds.value : undefined,
  segment_id: segmentId.value ?? undefined,
}))
const filtered = computed(() => Object.values(filters.value).some((v) => v !== undefined))
function clearFilters() {
  search.value = ''
  locationId.value = null
  statuses.value = []
  age.value = 'any'
  lastVisit.value = 'any'
  created.value = null
  tagIds.value = []
  segmentId.value = null
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

// Header "more" menu: import, tags & segments, export (design: ClientsScreen).
const moreItems = computed<MenuItem[]>(
  () =>
    [
      canCreate.value && {
        label: t('import.title'),
        icon: 'pi pi-upload',
        command: () => router.push({ name: 'tenant.clients.import' }),
      },
      {
        label: t('segments.title'),
        icon: 'pi pi-tags',
        command: () => router.push({ name: 'tenant.clients.segments' }),
      },
      canExport.value && {
        label: t('bookings.export'),
        icon: 'pi pi-download',
        command: exportCsv,
      },
    ].filter(Boolean) as MenuItem[],
)

// Status and segment stay in the bar; the rest open under "More filters".
const morePanel = ref<InstanceType<typeof Popover>>()
const moreCount = computed(
  () =>
    [
      locationId.value !== null,
      age.value !== 'any',
      lastVisit.value !== 'any',
      !!created.value?.[0],
      tagIds.value.length > 0,
    ].filter(Boolean).length,
)
const label = <T extends { value: unknown; label: string }>(options: T[], value: unknown) =>
  options.find((o) => o.value === value)?.label ?? ''
const chips = computed<FilterChip[]>(() => {
  const list: FilterChip[] = []
  if (statuses.value.length)
    list.push({
      key: 'status',
      label: `${t('clients.columns.status')}: ${statuses.value.map((v) => t(`status.${v}`)).join('، ')}`,
    })
  if (segmentId.value !== null)
    list.push({
      key: 'segment',
      label: `${t('segments.segment')}: ${segmentOptions.value.find((x) => x.id === segmentId.value)?.name ?? ''}`,
    })
  if (locationId.value !== null)
    list.push({
      key: 'location',
      label: `${t('clients.filters.home')}: ${locations.value.find((l) => l.id === locationId.value)?.name ?? ''}`,
    })
  if (age.value !== 'any') list.push({ key: 'age', label: label(ageOptions.value, age.value) })
  if (lastVisit.value !== 'any')
    list.push({ key: 'visit', label: label(visitOptions.value, lastVisit.value) })
  if (created.value?.[0])
    list.push({
      key: 'created',
      label: `${t('clients.filters.created')}: ${format.date(created.value[0])}${
        created.value[1] ? ` – ${format.date(created.value[1])}` : ''
      }`,
    })
  if (tagIds.value.length)
    list.push({
      key: 'tags',
      label: `${t('segments.tags')}: ${tagOptions.value
        .filter((x) => tagIds.value.includes(x.id))
        .map((x) => x.name)
        .join('، ')}`,
    })
  return list
})
function removeFilter(key: string) {
  if (key === 'status') statuses.value = []
  else if (key === 'segment') segmentId.value = null
  else if (key === 'location') locationId.value = null
  else if (key === 'age') age.value = 'any'
  else if (key === 'visit') lastVisit.value = 'any'
  else if (key === 'created') created.value = null
  else if (key === 'tags') tagIds.value = []
}

// "1–25 of 312" next to the pages.
const range = computed(() =>
  t('clients.range', {
    from: total.value ? (page.value - 1) * PER_PAGE + 1 : 0,
    to: Math.min(page.value * PER_PAGE, total.value),
    total: total.value,
  }),
)
// Two tags show; the rest count as "+N".
const TAGS_SHOWN = 2

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
// Bulk (US-05.12): add a tag, or add to a static segment.
const selected = ref<Client[]>([])
const canTag = computed(() => auth.can('clients.update'))
const canSegment = computed(() => auth.can('marketing.update'))
const bulkDialog = ref<'tag' | 'segment' | null>(null)
const bulkTarget = ref<number | null>(null)
const bulkSaving = ref(false)
const staticSegments = computed(() => segmentOptions.value.filter((s) => s.type === 'static'))
async function applyBulk() {
  if (!bulkTarget.value) return
  const ids = selected.value.map((c) => c.id)
  bulkSaving.value = true
  try {
    if (bulkDialog.value === 'tag') await tenantApi.tags.bulk(bulkTarget.value, ids)
    else await tenantApi.segments.addMembers(bulkTarget.value, ids)
    toast.add({
      severity: 'success',
      summary: t('clients.bulk.done', { n: ids.length }),
      life: 3000,
    })
    bulkDialog.value = null
    bulkTarget.value = null
    selected.value = []
    load()
    loadTaxonomy()
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    bulkSaving.value = false
  }
}
async function loadTaxonomy() {
  ;[tagOptions.value, segmentOptions.value] = await Promise.all([
    tenantApi.tags.list().catch(() => []),
    tenantApi.segments.list().catch(() => []),
  ])
}

onMounted(async () => {
  loadTaxonomy()
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
    <PageHeader :title="t('clients.title')" :more-items="moreItems">
      <template v-if="state === 'ready' || clients.length" #meta>
        <span>{{ filtered ? t('clients.matches', total) : t('clients.count', total) }}</span>
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
      <FilterBar
        v-model:search="search"
        :placeholder="t('clients.search')"
        :chips="chips"
        @remove="removeFilter"
        @clear="clearFilters"
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
        <Select
          v-if="segmentOptions.length"
          v-model="segmentId"
          :options="segmentOptions"
          option-label="name"
          option-value="id"
          :placeholder="t('segments.segment')"
          show-clear
          class="filter"
        />
        <Button
          :label="t('clients.filters.more')"
          icon="pi pi-filter"
          severity="secondary"
          variant="outlined"
          :badge="moreCount ? String(moreCount) : undefined"
          aria-haspopup="true"
          @click="morePanel?.toggle($event)"
        />
      </FilterBar>
      <Popover ref="morePanel">
        <div class="more-filters">
          <FormField
            v-if="locations.length > 1"
            :label="t('clients.filters.home')"
            for="filter-home"
          >
            <Select
              v-model="locationId"
              input-id="filter-home"
              :options="locations"
              option-label="name"
              option-value="id"
              :placeholder="t('clients.filters.anyBranch')"
              show-clear
              fluid
            />
          </FormField>
          <FormField :label="t('clients.filters.ageLabel')" for="filter-age">
            <Select
              v-model="age"
              input-id="filter-age"
              :options="ageOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </FormField>
          <FormField :label="t('clients.columns.lastVisit')" for="filter-visit">
            <Select
              v-model="lastVisit"
              input-id="filter-visit"
              :options="visitOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </FormField>
          <FormField :label="t('clients.filters.created')" for="filter-created">
            <DatePicker
              v-model="created"
              input-id="filter-created"
              selection-mode="range"
              :manual-input="false"
              show-icon
              icon-display="input"
              show-button-bar
              fluid
            />
          </FormField>
          <FormField v-if="tagOptions.length" :label="t('segments.tags')" for="filter-tags">
            <MultiSelect
              v-model="tagIds"
              input-id="filter-tags"
              :options="tagOptions"
              option-label="name"
              option-value="id"
              :placeholder="t('clients.filters.anyTag')"
              :max-selected-labels="2"
              filter
              fluid
            />
          </FormField>
        </div>
      </Popover>
      <BulkActionBar
        v-if="selected.length"
        :label="t('bookings.bulk.selected', { n: selected.length })"
        @clear="selected = []"
      >
        <Button
          v-if="canTag && tagOptions.length"
          size="small"
          severity="contrast"
          icon="pi pi-tag"
          :label="t('clients.bulk.addTag')"
          @click="bulkDialog = 'tag'"
        />
        <Button
          v-if="canSegment && staticSegments.length"
          size="small"
          severity="contrast"
          icon="pi pi-filter"
          :label="t('clients.bulk.addToSegment')"
          @click="bulkDialog = 'segment'"
        />
      </BulkActionBar>

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
        v-model:selection="selected"
        :value="clients"
        data-key="id"
        lazy
        paginator
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        :loading="state === 'loading'"
        paginator-template="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        :current-page-report-template="range"
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
        <Column v-if="canTag || canSegment" selection-mode="multiple" header-style="width: 3rem" />
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
            <span v-else dir="ltr" class="num muted nowrap">{{ data.mobile ?? data.email }}</span>
          </template>
        </Column>
        <Column :header="t('clients.columns.home')">
          <template #body="{ data }"
            ><span class="nowrap">{{ data.home_location?.name ?? '—' }}</span></template
          >
        </Column>
        <Column :header="t('clients.columns.status')">
          <template #body="{ data }"><StatusTag :status="data.status" size="sm" /></template>
        </Column>
        <Column :header="t('segments.tags')">
          <template #body="{ data }">
            <span class="tags">
              <span v-for="tag in (data.tags ?? []).slice(0, TAGS_SHOWN)" :key="tag.id" class="chip"
                ><span
                  class="chip__dot"
                  :style="{ background: tag.color ?? 'var(--text-muted)' }"
                />{{ tag.name }}</span
              >
              <span
                v-if="(data.tags?.length ?? 0) > TAGS_SHOWN"
                v-tooltip.top="
                  data.tags
                    .slice(TAGS_SHOWN)
                    .map((x: TagItem) => x.name)
                    .join(', ')
                "
                class="chip chip--more"
                >+{{ data.tags.length - TAGS_SHOWN }}</span
              >
            </span>
          </template>
        </Column>
        <Column :header="t('clients.columns.lastVisit')">
          <template #body="{ data }">
            <span :class="['nowrap', { muted: !data.last_visit_at }]">{{
              data.last_visit_at ? format.date(data.last_visit_at) : t('clients.never')
            }}</span>
          </template>
        </Column>
        <Column :header="t('clients.columns.upcoming')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span :class="['num', { muted: !data.upcoming_bookings }]">{{
              data.upcoming_bookings ?? 0
            }}</span></template
          >
        </Column>
        <Column header-class="row-end" body-class="row-end">
          <template #body>
            <i class="pi pi-chevron-right pi-dir row-chevron" aria-hidden="true" />
          </template>
        </Column>
      </DataTable>
    </template>

    <NewClientDrawer v-model:visible="drawerOpen" @saved="onSaved" />
    <FormDialog
      :visible="bulkDialog !== null"
      :title="bulkDialog === 'tag' ? t('clients.bulk.addTag') : t('clients.bulk.addToSegment')"
      :subtitle="t('clients.bulk.selectedCount', { n: selected.length })"
      :icon="bulkDialog === 'tag' ? 'pi-tag' : 'pi-users'"
      size="sm"
      :saving="bulkSaving"
      :save-disabled="!bulkTarget"
      :save-label="t('clients.bulk.apply', { n: selected.length })"
      @update:visible="(v: boolean) => !v && (bulkDialog = null)"
      @save="applyBulk"
    >
      <FormField
        :label="bulkDialog === 'tag' ? t('segments.tags') : t('segments.segment')"
        for="bulk-target"
        required
      >
        <Select
          v-model="bulkTarget"
          input-id="bulk-target"
          :options="bulkDialog === 'tag' ? tagOptions : staticSegments"
          option-label="name"
          option-value="id"
          filter
          fluid
          :placeholder="
            bulkDialog === 'tag' ? t('clients.bulk.pickTag') : t('clients.bulk.pickSegment')
          "
          :empty-message="
            bulkDialog === 'tag' ? t('clientProfile.noTagsYet') : t('clients.bulk.noStatic')
          "
        >
          <template v-if="bulkDialog === 'tag'" #option="{ option }">
            <span class="bulk-opt"
              ><span class="bulk-dot" :style="{ background: option.color }" />{{
                option.name
              }}</span
            >
          </template>
        </Select>
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.bulk-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.bulk-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.filter {
  min-width: 150px;
}
.more-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 12px 16px;
  width: min(480px, calc(100vw - 48px));
}
.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  font: 500 12px/1 var(--font-sans);
  color: var(--text-secondary);
  white-space: nowrap;
}
.chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.chip--more {
  background: var(--surface-sunken);
}
.nowrap {
  white-space: nowrap;
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
