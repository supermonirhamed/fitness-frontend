<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import LocationAccessDialog from '@/components/roles/LocationAccessDialog.vue'
import { tenantApi, type Location, type StaffAccess } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const users = ref<StaffAccess[]>([])
const locations = ref<Location[]>([])
const locationName = computed(() => new Map(locations.value.map((l) => [l.id, l.name])))

const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)
const STATUS_SEVERITY = { Active: 'success', Invited: 'info', Deactivated: 'secondary' } as const

async function load() {
  state.value = 'loading'
  try {
    ;[users.value, locations.value] = await Promise.all([
      tenantApi.users(),
      auth.can('locations.view') ? tenantApi.locations() : Promise.resolve([]),
    ])
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function branchesOf(user: StaffAccess): string[] {
  return user.location_ids.map((id) => locationName.value.get(id) ?? `#${id}`)
}

// ---- Edit access ----
const editing = ref<StaffAccess | null>(null)
const dialogOpen = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const canEdit = computed(() => auth.can('staff.update'))

function edit(user: StaffAccess) {
  editing.value = user
  saveError.value = null
  dialogOpen.value = true
}

async function save(access: { all_locations: boolean; location_ids: number[] }) {
  if (!editing.value) return
  saving.value = true
  saveError.value = null
  try {
    const updated = await tenantApi.updateUserLocations(editing.value.id, access)
    users.value = users.value.map((u) => (u.id === updated.id ? updated : u))
    dialogOpen.value = false
    toast.add({
      severity: 'success',
      summary: t('access.savedToast', { name: updated.name }),
      life: 4000,
    })
    if (updated.id === auth.user?.id) await auth.check(true)
  } catch (e) {
    saveError.value =
      errorCode(e) === 'location_not_allowed' ? t('access.notAllowed') : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="card">
    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton v-for="n in 5" :key="n" height="40px" />
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
      :title="t('access.loadError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>

    <template v-else>
      <div class="intro">
        <p>{{ t('access.intro') }}</p>
        <Message v-if="!locations.length" severity="info" :closable="false">{{
          t('access.noLocations')
        }}</Message>
      </div>

      <DataTable :value="users" data-key="id" size="small" scrollable>
        <template #empty>
          <EmptyState icon="pi-users" :title="t('access.empty')" />
        </template>
        <Column :header="t('access.columns.person')">
          <template #body="{ data }">
            <div class="person">{{ data.name }}</div>
            <div class="sub ltr-isolate">{{ data.email }}</div>
          </template>
        </Column>
        <Column :header="t('access.columns.roles')">
          <template #body="{ data }">
            <div class="tags">
              <Tag
                v-for="role in data.roles"
                :key="role"
                severity="secondary"
                :value="roleLabel(role)"
              />
            </div>
          </template>
        </Column>
        <Column :header="t('access.columns.status')">
          <template #body="{ data }">
            <Tag
              :severity="STATUS_SEVERITY[data.status as keyof typeof STATUS_SEVERITY]"
              :value="t(`access.status.${data.status}`)"
            />
          </template>
        </Column>
        <Column :header="t('access.columns.locations')">
          <template #body="{ data }">
            <span v-if="data.owner || data.all_locations || !data.location_limited" class="all">
              <i class="pi pi-globe" aria-hidden="true" />{{ t('access.all') }}
              <i
                v-if="!data.owner && !data.all_locations && !data.location_limited"
                v-tooltip.top="t('access.orgWideRole')"
                class="pi pi-info-circle muted"
                tabindex="0"
                :aria-label="t('access.orgWideRole')"
              />
            </span>
            <div v-else-if="data.location_ids.length" class="tags">
              <Tag v-for="name in branchesOf(data)" :key="name" :value="name" severity="info" />
            </div>
            <span v-else class="none"
              ><i class="pi pi-exclamation-circle" aria-hidden="true" />{{ t('access.none') }}</span
            >
          </template>
        </Column>
        <Column class="actions-col">
          <template #body="{ data }">
            <div class="actions">
              <Button
                v-if="canEdit && !data.owner"
                size="small"
                variant="text"
                icon="pi pi-map-marker"
                :label="t('access.edit')"
                @click="edit(data)"
              />
              <span v-else-if="data.owner" class="muted small">{{ t('access.ownerLocked') }}</span>
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <LocationAccessDialog
      v-model:visible="dialogOpen"
      :user="editing"
      :locations="locations"
      :can-grant-all="auth.user?.location_ids === null"
      :loading="saving"
      :error="saveError"
      @save="save"
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
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.intro p {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.person {
  font-weight: var(--fw-semibold);
}
.sub,
.muted {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.small {
  white-space: nowrap;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.all,
.none {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
}
.none {
  color: var(--sev-warn-fg);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
