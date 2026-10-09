<script setup lang="ts">
// The Facilities tab of a branch (US-01.08): its rooms, studios, fields, pools… with sub-areas.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import FacilityFormDrawer from '@/components/locations/FacilityFormDrawer.vue'
import { tenantApi, type Facility } from '@/api/tenant'
import { FACILITY_ICONS, typeKey } from '@/lib/facilities'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const toast = useToast()

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

const subAreaNames = (f: Facility) =>
  (f.sub_areas ?? []).map((s) => s.name).join(locale.value === 'ar' ? '، ' : ', ')

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
      <p class="note">{{ t('facilities.intro') }}</p>
      <span class="spacer" />
      <ArchiveFilter v-if="canEdit" v-model="archived" />
      <Button
        v-if="canEdit && !archived"
        icon="pi pi-plus"
        :label="t('facilities.add')"
        @click="openDrawer()"
      />
    </div>

    <div v-if="state === 'loading'" class="stack">
      <Skeleton v-for="n in 3" :key="n" height="48px" />
    </div>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('facilities.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>
    <EmptyState
      v-else-if="!facilities.length"
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
    <DataTable v-else :value="facilities" data-key="id" size="small">
      <Column :header="t('facilities.columns.name')">
        <template #body="{ data }">
          <div class="name-cell">
            <i
              :class="['pi', FACILITY_ICONS[data.type as Facility['type']], 'type-icon']"
              aria-hidden="true"
            />
            <div>
              <div class="name">{{ data.name }}</div>
              <div v-if="data.sub_areas?.length" class="sub">
                {{ t('facilities.subAreas', data.sub_areas.length) }}: {{ subAreaNames(data) }}
              </div>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('facilities.columns.type')">
        <template #body="{ data }">{{ t(`facilityTypes.${typeKey(data.type)}`) }}</template>
      </Column>
      <Column :header="t('facilities.columns.capacity')" class="num-col">
        <template #body="{ data }"
          ><span class="num">{{ data.capacity }}</span></template
        >
      </Column>
      <Column :header="t('facilities.columns.status')">
        <template #body="{ data }"><StatusTag :status="data.status" /></template>
      </Column>
      <Column v-if="canEdit" class="actions-col">
        <template #body="{ data }">
          <div class="actions">
            <Button
              v-if="!archived"
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :aria-label="t('facilities.edit', { name: data.name })"
              @click="openDrawer(data)"
            />
            <Button
              :icon="archived ? 'pi pi-replay pi-dir' : 'pi pi-box'"
              :label="archived ? t('archive.restore') : undefined"
              :severity="archived ? undefined : 'secondary'"
              variant="text"
              :rounded="!archived"
              size="small"
              :aria-label="archived ? t('archive.restore') : t('archive.archive')"
              @click="ask(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <FacilityFormDrawer
      v-model:visible="drawerOpen"
      :location-id="locationId"
      :facility="editing"
      @saved="onSaved"
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
  gap: var(--space-4);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.name-cell {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.type-icon {
  margin-top: 3px;
  color: var(--primary);
}
.name {
  font-weight: var(--fw-medium);
}
.sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1);
}
</style>
