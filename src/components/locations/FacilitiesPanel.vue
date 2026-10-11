<script setup lang="ts">
// The Facilities tab of a branch (US-01.08): its rooms, studios, fields, pools… with sub-areas.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import FacilityFormDrawer from '@/components/locations/FacilityFormDrawer.vue'
import { tenantApi, type Facility } from '@/api/tenant'
import { FACILITY_ICONS, typeKey } from '@/lib/facilities'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const router = useRouter()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const facilities = ref<Facility[]>([])
const archived = ref(false)

async function load() {
  state.value = 'loading'
  try {
    facilities.value = await tenantApi.facilities.list({
      location_id: props.locationId,
      archived: archived.value,
    })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(archived, load)

// Create / edit
const drawerOpen = ref(false)
const editing = ref<Facility | null>(null)
function openDrawer(f: Facility | null = null) {
  editing.value = f
  drawerOpen.value = true
}
function onSaved(saved: Facility, created: boolean) {
  facilities.value = created
    ? [...facilities.value, saved].sort((a, b) => a.name.localeCompare(b.name))
    : facilities.value.map((f) => (f.id === saved.id ? saved : f))
  toast.add({
    severity: 'success',
    summary: t(created ? 'facilityForm.created' : 'facilityForm.saved', { name: saved.name }),
    life: 3000,
  })
  emit('changed')
}

// Archive / restore
const target = ref<Facility | null>(null)
const confirmOpen = ref(false)
const busy = ref(false)
const confirmError = ref<string | null>(null)
const confirmTitle = computed(() =>
  t(archived.value ? 'archive.restoreTitle' : 'archive.archiveTitle', {
    name: target.value?.name ?? '',
  }),
)
function onRow(f: Facility, event: Event) {
  if (archived.value || (event.target as HTMLElement).closest('.no-click')) return
  if (props.canEdit) openDrawer(f)
  else router.push({ name: 'tenant.facilities.availability', params: { id: f.id } })
}
function onArchiveFromDrawer(f: Facility) {
  drawerOpen.value = false
  ask(f)
}
function ask(f: Facility) {
  target.value = f
  confirmError.value = null
  confirmOpen.value = true
}
async function toggleArchive() {
  const f = target.value
  if (!f) return
  busy.value = true
  try {
    if (archived.value) await tenantApi.facilities.restore(f.id)
    else await tenantApi.facilities.archive(f.id)
    facilities.value = facilities.value.filter((x) => x.id !== f.id)
    confirmOpen.value = false
    toast.add({
      severity: 'success',
      summary: t(archived.value ? 'archive.restoredToast' : 'archive.archivedToast', {
        name: f.name,
      }),
      life: 3000,
    })
    emit('changed')
  } catch {
    confirmError.value = t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <ArchiveFilter v-if="canEdit" v-model="archived" />
      <span class="spacer" />
      <Button
        v-if="canEdit && !archived"
        icon="pi pi-plus"
        :label="t('facilities.add')"
        @click="openDrawer()"
      />
    </div>

    <div v-if="state === 'loading'" class="card pad">
      <Skeleton v-for="n in 3" :key="n" height="40px" />
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('facilities.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!facilities.length"
      class="card"
      :icon="archived ? 'pi-inbox' : 'pi-th-large'"
      :title="archived ? t('archive.noneArchived') : t('facilities.empty')"
      :body="archived ? t('archive.noneArchivedHint') : t('facilities.emptyHint')"
    >
      <Button
        v-if="canEdit && !archived"
        icon="pi pi-plus"
        :label="t('facilities.add')"
        @click="openDrawer()"
      />
    </EmptyState>
    <DataTable
      v-else
      :value="facilities"
      data-key="id"
      :row-class="() => (archived ? '' : 'row-click')"
      @row-click="onRow($event.data, $event.originalEvent)"
    >
      <Column :header="t('facilities.columns.name')">
        <template #body="{ data }">
          <div class="name-cell">
            <span class="tile" aria-hidden="true"
              ><i :class="['pi', FACILITY_ICONS[data.type as Facility['type']]]"
            /></span>
            <div>
              <div class="name">{{ data.name }}</div>
              <div class="sub">
                {{ t(`facilityTypes.${typeKey(data.type)}`)
                }}<template v-if="data.sub_areas?.length">
                  · {{ t('facilities.subAreas', data.sub_areas.length) }}</template
                >
              </div>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('facilities.columns.capacity')" header-class="end" body-class="end">
        <template #body="{ data }"
          ><span class="num strong">{{ data.capacity }}</span></template
        >
      </Column>
      <Column :header="t('facilities.columns.allowed')">
        <template #body="{ data }">
          <span v-if="data.allowed_services?.length" class="num">{{
            data.allowed_services.length
          }}</span>
          <span v-else class="muted">{{ t('facilities.allServices') }}</span>
        </template>
      </Column>
      <Column :header="t('facilities.columns.status')">
        <template #body="{ data }"><StatusTag :status="data.status" /></template>
      </Column>
      <Column header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <div v-if="!archived" class="actions">
            <Button
              v-tooltip.top="t('facilities.availabilityShort')"
              as="router-link"
              :to="{ name: 'tenant.facilities.availability', params: { id: data.id } }"
              icon="pi pi-calendar"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('facilities.availability', { name: data.name })"
              class="no-click"
            />
            <i class="pi pi-chevron-right pi-dir row-chevron" aria-hidden="true" />
          </div>
          <Button
            v-else-if="canEdit"
            icon="pi pi-replay pi-dir"
            :label="t('archive.restore')"
            variant="outlined"
            size="small"
            @click="ask(data)"
          />
        </template>
      </Column>
    </DataTable>

    <FacilityFormDrawer
      v-model:visible="drawerOpen"
      :location-id="locationId"
      :facility="editing"
      :can-archive="canEdit"
      @saved="onSaved"
      @archive="onArchiveFromDrawer"
    />
    <ConfirmActionDialog
      v-model:visible="confirmOpen"
      :title="confirmTitle"
      :description="
        archived ? t('facilities.restoreDescription') : t('facilities.archiveDescription')
      "
      :confirm-label="archived ? t('archive.restore') : t('archive.archive')"
      :destructive="!archived"
      :loading="busy"
      :error="confirmError"
      @confirm="toggleArchive"
    />
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tile {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
  background: var(--primary-subtle);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.name {
  font: 500 14px var(--font-sans);
}
.sub {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.strong {
  font-weight: 600;
}
.muted {
  color: var(--text-muted);
}
.actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
