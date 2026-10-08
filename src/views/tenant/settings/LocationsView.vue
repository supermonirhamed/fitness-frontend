<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type Location } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, d } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const archived = ref(false)
const locations = ref<Location[]>([])
const canArchive = () => auth.can('locations.delete')

async function load() {
  state.value = 'loading'
  try {
    locations.value = await tenantApi.locations(archived.value)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)
watch(archived, load)

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
  } catch {
    error.value = t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <div class="toolbar">
      <p>{{ t('locationsPage.intro') }}</p>
      <ArchiveFilter v-if="canArchive()" v-model="archived" />
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
    />

    <DataTable v-else :value="locations" data-key="id" size="small">
      <Column :header="t('locationsPage.columns.name')">
        <template #body="{ data }">
          <span class="name">{{ data.name }}</span>
        </template>
      </Column>
      <Column v-if="archived" :header="t('archive.archivedOn')">
        <template #body="{ data }">
          <span class="num">{{
            data.archived_at ? d(new Date(data.archived_at), 'dateTime') : '—'
          }}</span>
        </template>
      </Column>
      <Column v-if="canArchive()" class="actions-col">
        <template #body="{ data }">
          <div class="actions">
            <Button
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
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
