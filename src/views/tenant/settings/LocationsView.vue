<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import LocationFormDrawer from '@/components/locations/LocationFormDrawer.vue'
import { tenantApi, type Location, type LocationDetails } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'
import { useFormat } from '@/composables/useFormat'
import { mixesZones, zoneAbbreviation } from '@/lib/datetime'

const { t, locale } = useI18n()
const fmt = useFormat()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const archived = ref(false)
const locations = ref<Location[]>([])
const canArchive = () => auth.can('locations.delete')
const canCreate = () => auth.can('locations.create')
const canEdit = () => auth.can('locations.update')
const route = useRoute()
const router = useRouter()
// Branches in different timezones: show the zone next to times (US-00.14).
const mixed = computed(() => mixesZones(locations.value.map((l) => l.timezone)))

async function load() {
  state.value = 'loading'
  try {
    locations.value = await tenantApi.locations(archived.value)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(async () => {
  await load()
  // "Create your first branch" from Today opens the form straight away.
  if (route.query.new === '1' && canCreate()) {
    openForm(null)
    router.replace({ query: {} })
  }
})
watch(archived, load)

// Create / edit (US-01.03)
const formOpen = ref(false)
const editing = ref<LocationDetails | null>(null)
const loadingEdit = ref<number | null>(null)

async function openForm(location: Location | null) {
  if (!location) {
    editing.value = null
    formOpen.value = true
    return
  }
  loadingEdit.value = location.id
  try {
    editing.value = await tenantApi.location(location.id)
    formOpen.value = true
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    loadingEdit.value = null
  }
}

async function onSaved(location: LocationDetails, created: boolean) {
  toast.add({
    severity: 'success',
    summary: t(created ? 'locationForm.created' : 'locationForm.saved', { name: location.name }),
    life: 4000,
  })
  if (archived.value) archived.value = false
  else await load()
  if (created && auth.user?.location_ids !== null) await auth.check(true) // now one of their branches
}

// Archive / restore
const target = ref<Location | null>(null)
const dialogOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

function ask(location: Location) {
  target.value = location
  error.value = null
  dialogOpen.value = true
}

async function confirm() {
  const location = target.value
  if (!location) return
  busy.value = true
  error.value = null
  try {
    if (archived.value) await tenantApi.restoreLocation(location.id)
    else await tenantApi.archiveLocation(location.id)
    locations.value = locations.value.filter((l) => l.id !== location.id)
    dialogOpen.value = false
    toast.add({
      severity: 'success',
      summary: t(archived.value ? 'archive.restoredToast' : 'archive.archivedToast', {
        name: location.name,
      }),
      life: 4000,
    })
    if (auth.user?.location_ids !== null) await auth.check(true) // their own branches may have changed
  } catch (e) {
    error.value =
      errorCode(e) === 'last_location' ? t('locationsPage.lastLocation') : t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <div class="toolbar">
      <p>{{ t('locationsPage.intro') }}</p>
      <div class="tools">
        <ArchiveFilter v-if="canArchive()" v-model="archived" />
        <Button
          v-if="canCreate()"
          icon="pi pi-plus"
          :label="t('locationForm.newTitle')"
          @click="openForm(null)"
        />
      </div>
    </div>

    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton v-for="n in 3" :key="n" height="40px" />
    </div>

    <EmptyState
      v-else-if="state === 'forbidden'"
      icon="pi-lock"
      :title="t('permissions.forbidden')"
      :body="t('permissions.forbiddenHint')"
    />

    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('locationsPage.loadError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>

    <EmptyState
      v-else-if="!locations.length"
      :icon="archived ? 'pi-inbox' : 'pi-building'"
      :title="archived ? t('archive.noneArchived') : t('locationsPage.empty')"
      :body="archived ? t('archive.noneArchivedHint') : t('locationsPage.emptyHint')"
    >
      <Button
        v-if="!archived && canCreate()"
        icon="pi pi-plus"
        :label="t('locationForm.firstBranch')"
        @click="openForm(null)"
      />
    </EmptyState>

    <DataTable v-else :value="locations" data-key="id" size="small">
      <Column :header="t('locationsPage.columns.name')">
        <template #body="{ data }">
          <span class="name">{{ data.name }}</span>
        </template>
      </Column>
      <Column :header="t('locationsPage.columns.status')">
        <template #body="{ data }">
          <StatusTag :status="data.status" />
        </template>
      </Column>
      <Column :header="t('locationsPage.columns.timezone')">
        <template #body="{ data }">
          <div class="ltr-isolate" dir="ltr">{{ data.timezone }}</div>
          <div class="zone">{{ zoneAbbreviation(data.timezone, locale) }}</div>
        </template>
      </Column>
      <Column v-if="archived" :header="t('archive.archivedOn')">
        <template #body="{ data }">
          <span class="num">{{
            data.archived_at ? fmt.dateTime(data.archived_at, data.timezone, mixed) : '—'
          }}</span>
        </template>
      </Column>
      <Column v-if="canArchive() || canEdit()" class="actions-col">
        <template #body="{ data }">
          <div class="actions">
            <Button
              v-if="canEdit() && !archived"
              size="small"
              variant="text"
              severity="secondary"
              icon="pi pi-pencil"
              :label="t('locationForm.edit')"
              :loading="loadingEdit === data.id"
              @click="openForm(data)"
            />
            <Button
              v-if="canArchive()"
              size="small"
              variant="text"
              :severity="archived ? undefined : 'secondary'"
              :icon="archived ? 'pi pi-replay pi-dir' : 'pi pi-box'"
              :label="archived ? t('archive.restore') : t('archive.archive')"
              @click="ask(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <LocationFormDrawer v-model:visible="formOpen" :location="editing" @saved="onSaved" />

    <ConfirmActionDialog
      v-if="target"
      v-model:visible="dialogOpen"
      :title="t(archived ? 'archive.restoreTitle' : 'archive.archiveTitle', { name: target.name })"
      :description="
        t(archived ? 'locationsPage.restoreDescription' : 'locationsPage.archiveDescription')
      "
      :confirm-label="archived ? t('archive.restore') : t('archive.archive')"
      :loading="busy"
      :error="error"
      @confirm="confirm"
    />
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.tools {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.toolbar p {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.name {
  font-weight: var(--fw-medium);
}
.zone {
  font: var(--text-caption);
  color: var(--text-muted);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
