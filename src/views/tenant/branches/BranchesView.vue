<script setup lang="ts">
// Branches list (US-01.03/04) as in the design (ui_kits/admin/BranchesScreen.jsx): counts in the
// header, search + one status switch (Archived included), building tile per row, zone badge,
// figures, whole-row click to the branch; archived rows get Restore.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar from '@/components/patterns/FilterBar.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import ZoneBadge from '@/components/patterns/ZoneBadge.vue'
import LocationFormDrawer from '@/components/locations/LocationFormDrawer.vue'
import { tenantApi, type Location, type LocationDetails, type LocationStatus } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

type Filter = 'all' | LocationStatus | 'archived'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const route = useRoute()
const router = useRouter()
const canCreate = computed(() => auth.can('locations.create'))
const canArchive = computed(() => auth.can('locations.delete'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const locations = ref<Location[]>([])
const archivedCount = ref<number | null>(null)
const filter = ref<Filter>('all')
const search = ref('')
const archived = computed(() => filter.value === 'archived')

const FIGURES = ['facilities', 'active_services', 'staff', 'today_sessions'] as const

async function load() {
  state.value = 'loading'
  try {
    locations.value = await tenantApi.locations(archived.value)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
async function loadArchivedCount() {
  if (!canArchive.value) return
  try {
    archivedCount.value = (await tenantApi.locations(true)).length
  } catch {
    archivedCount.value = null
  }
}
onMounted(async () => {
  await load()
  loadArchivedCount()
  // "Create your first branch" from Today opens the form straight away.
  if (route.query.new === '1' && canCreate.value) {
    openNew()
    router.replace({ query: {} })
  }
})
watch(archived, load)

const filterOptions = computed(() => [
  { value: 'all', label: t('branches.filters.all') },
  { value: 'Active', label: t('locationStatus.Active') },
  { value: 'Draft', label: t('locationStatus.Draft') },
  { value: 'Inactive', label: t('locationStatus.Inactive') },
  ...(canArchive.value
    ? [{ value: 'archived', label: t('archive.archived'), icon: 'pi pi-inbox' }]
    : []),
])
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return locations.value.filter(
    (l) =>
      (archived.value || filter.value === 'all' || l.status === filter.value) &&
      (!q || l.name.toLowerCase().includes(q)),
  )
})
const activeCount = computed(() => (archived.value ? null : locations.value.length))
const open = (l: Location) =>
  !archived.value && router.push({ name: 'tenant.locations.show', params: { id: l.id } })

// New branch (US-01.03). Editing happens on the branch page.
const formOpen = ref(false)
function openNew() {
  formOpen.value = true
}
async function onSaved(location: LocationDetails) {
  toast.add({
    severity: 'success',
    summary: t('branches.createdDraft', { name: location.name }),
    detail: t('branches.createdHint'),
    life: 5000,
  })
  if (auth.user?.location_ids !== null) await auth.check(true) // now one of their branches
  router.push({ name: 'tenant.locations.show', params: { id: location.id } })
}

// Restore an archived branch
const target = ref<Location | null>(null)
const dialogOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
function askRestore(location: Location) {
  target.value = location
  error.value = null
  dialogOpen.value = true
}
async function restore() {
  const location = target.value
  if (!location) return
  busy.value = true
  try {
    await tenantApi.restoreLocation(location.id)
    locations.value = locations.value.filter((l) => l.id !== location.id)
    archivedCount.value = archivedCount.value === null ? null : archivedCount.value - 1
    dialogOpen.value = false
    toast.add({
      severity: 'success',
      summary: t('archive.restoredToast', { name: location.name }),
      life: 4000,
    })
    if (auth.user?.location_ids !== null) await auth.check(true)
  } catch (e) {
    error.value =
      errorCode(e) === 'last_location' ? t('locationsPage.lastLocation') : t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('branches.title')">
      <template v-if="activeCount !== null && state === 'ready'" #meta>
        <span
          >{{ t('branches.count', activeCount)
          }}<template v-if="archivedCount">
            · {{ t('branches.archivedCount', archivedCount) }}</template
          ></span
        >
      </template>
      <template v-if="canCreate" #primary>
        <Button icon="pi pi-plus" :label="t('locationForm.newTitle')" @click="openNew" />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />

    <template v-else>
      <FilterBar
        v-if="locations.length || archived || search"
        v-model:search="search"
        :placeholder="t('branches.search')"
      >
        <SelectButton
          v-model="filter"
          :options="filterOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('locationsPage.columns.status')"
        >
          <template #option="{ option }">
            <i v-if="option.icon" :class="option.icon" aria-hidden="true" />{{ option.label }}
          </template>
        </SelectButton>
      </FilterBar>

      <Message v-if="archived" severity="secondary" icon="pi pi-inbox" :closable="false">{{
        t('branches.archivedNote')
      }}</Message>

      <div
        v-if="state === 'loading'"
        class="card"
        aria-busy="true"
        :aria-label="t('common.loading')"
      >
        <div v-for="n in 3" :key="n" class="skeleton-row">
          <Skeleton width="36px" height="36px" /><Skeleton width="30%" /><Skeleton width="15%" />
        </div>
      </div>
      <ErrorState
        v-else-if="state === 'error'"
        class="card"
        :title="t('locationsPage.loadError')"
        @retry="load"
      />

      <!-- Onboarding: no branch yet -->
      <EmptyState
        v-else-if="!locations.length && !archived"
        class="card card--tall"
        icon="pi-building"
        :title="t('locationForm.firstBranch')"
        :body="t('branches.firstHint')"
      >
        <Button
          v-if="canCreate"
          icon="pi pi-plus"
          :label="t('branches.createBranch')"
          @click="openNew"
        />
      </EmptyState>

      <DataTable
        v-else
        :value="rows"
        data-key="id"
        :row-class="() => (archived ? '' : 'row-click')"
        @row-click="open($event.data)"
      >
        <template #empty>
          <EmptyState
            compact
            :icon="archived ? 'pi-inbox' : 'pi-search'"
            :title="archived ? t('branches.noArchived') : t('branches.noMatch')"
          />
        </template>
        <Column :header="t('locationsPage.columns.name')">
          <template #body="{ data }">
            <div class="branch">
              <span class="tile" aria-hidden="true"><i class="pi pi-building" /></span>
              <span class="branch__name">{{ data.name }}</span>
            </div>
          </template>
        </Column>
        <Column :header="t('locationsPage.columns.status')">
          <template #body="{ data }"><StatusTag :status="data.status" /></template>
        </Column>
        <Column :header="t('locationsPage.columns.timezone')">
          <template #body="{ data }"><ZoneBadge :timezone="data.timezone" with-name /></template>
        </Column>
        <Column
          v-for="key in FIGURES"
          :key="key"
          :header="t(`locationDetails.figures.${key}`)"
          header-class="end"
          body-class="end"
        >
          <template #body="{ data }">
            <span class="num">{{ data.stats?.[key] ?? '—' }}</span>
          </template>
        </Column>
        <Column header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <Button
              v-if="archived"
              size="small"
              variant="outlined"
              icon="pi pi-replay pi-dir"
              :label="t('archive.restore')"
              @click.stop="askRestore(data)"
            />
            <i v-else class="pi pi-chevron-right pi-dir row-chevron" aria-hidden="true" />
          </template>
        </Column>
      </DataTable>
    </template>

    <LocationFormDrawer v-model:visible="formOpen" :location="null" @saved="onSaved" />
    <ConfirmActionDialog
      v-model:visible="dialogOpen"
      :title="target ? t('archive.restoreTitle', { name: target.name }) : ''"
      :description="t('locationsPage.restoreDescription')"
      :confirm-label="t('archive.restore')"
      :loading="busy"
      :error="error"
      @confirm="restore"
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
.card--tall {
  padding: 40px 0;
}
.skeleton-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.branch {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tile {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 8px;
  background: var(--surface-sunken);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.branch__name {
  font: 500 14px/1.4 var(--font-sans);
}
:deep(.p-togglebutton-content) i {
  font-size: 12px;
}
</style>
