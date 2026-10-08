<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Menu from 'primevue/menu'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import LocationAccessDialog from '@/components/roles/LocationAccessDialog.vue'
import { tenantApi, type Location, type StaffAccess } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'
import { useFormat } from '@/composables/useFormat'

const { t, te } = useI18n()
const fmt = useFormat()
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

// Deactivated staff stay in the list for history, hidden unless asked for (US-00.10).
const showDeactivated = ref(false)
const deactivatedCount = computed(
  () => users.value.filter((u) => u.status === 'Deactivated').length,
)
const visibleUsers = computed(() =>
  showDeactivated.value ? users.value : users.value.filter((u) => u.status !== 'Deactivated'),
)

function branchesOf(user: StaffAccess): string[] {
  return user.location_ids.map((id) => locationName.value.get(id) ?? `#${id}`)
}

// ---- Edit access ----
const editing = ref<StaffAccess | null>(null)
const dialogOpen = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const canEdit = computed(() => auth.can('staff.update'))
const canChangeStatus = (user: StaffAccess) =>
  auth.can('staff.delete') && !user.owner && !user.is_me

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

// ---- Deactivate / reactivate ----
const statusTarget = ref<StaffAccess | null>(null)
const statusOpen = ref(false)
const statusBusy = ref(false)
const statusError = ref<string | null>(null)

function askStatus(user: StaffAccess) {
  statusTarget.value = user
  statusError.value = null
  statusOpen.value = true
}

async function changeStatus() {
  const user = statusTarget.value
  if (!user) return
  statusBusy.value = true
  statusError.value = null
  try {
    const updated = await (user.status === 'Deactivated'
      ? tenantApi.reactivateUser(user.id)
      : tenantApi.deactivateUser(user.id))
    users.value = users.value.map((u) => (u.id === updated.id ? updated : u))
    statusOpen.value = false
    toast.add({
      severity: 'success',
      summary: t(
        updated.status === 'Deactivated' ? 'access.deactivatedToast' : 'access.reactivatedToast',
        {
          name: updated.name,
        },
      ),
      life: 4000,
    })
  } catch {
    statusError.value = t('common.genericError')
  } finally {
    statusBusy.value = false
  }
}

// ---- Row menu ----
const rowMenu = ref<InstanceType<typeof Menu>>()
const menuUser = ref<StaffAccess | null>(null)
const menuItems = computed(() => {
  const user = menuUser.value
  if (!user) return []
  return [
    ...(canEdit.value && user.status !== 'Deactivated'
      ? [{ label: t('access.edit'), icon: 'pi pi-map-marker', command: () => edit(user) }]
      : []),
    ...(canChangeStatus(user)
      ? [
          user.status === 'Deactivated'
            ? {
                label: t('access.reactivate'),
                icon: 'pi pi-replay pi-dir',
                command: () => askStatus(user),
              }
            : { label: t('access.deactivate'), icon: 'pi pi-ban', command: () => askStatus(user) },
        ]
      : []),
  ]
})
const hasActions = (user: StaffAccess) =>
  !user.owner && ((canEdit.value && user.status !== 'Deactivated') || canChangeStatus(user))

function openMenu(event: Event, user: StaffAccess) {
  menuUser.value = user
  rowMenu.value?.toggle(event)
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
        <label v-if="deactivatedCount" class="toggle">
          <Checkbox v-model="showDeactivated" binary input-id="show-deactivated" />
          <span>{{ t('access.showDeactivated', { count: deactivatedCount }) }}</span>
        </label>
      </div>

      <DataTable
        :value="visibleUsers"
        data-key="id"
        size="small"
        scrollable
        :row-class="(row: StaffAccess) => (row.status === 'Deactivated' ? 'row--deactivated' : '')"
      >
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
            <div v-if="data.deactivated_at" class="sub">
              {{ fmt.date(data.deactivated_at) }}
            </div>
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
                v-if="hasActions(data)"
                icon="pi pi-ellipsis-v"
                size="small"
                variant="text"
                severity="secondary"
                :aria-label="t('access.actions', { name: data.name })"
                aria-haspopup="true"
                aria-controls="user-row-menu"
                @click="openMenu($event, data)"
              />
              <span v-else-if="data.owner" class="muted small">{{ t('access.ownerLocked') }}</span>
              <span v-else-if="data.is_me" class="muted small">{{ t('access.you') }}</span>
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <Menu id="user-row-menu" ref="rowMenu" :model="menuItems" popup />
    <ConfirmActionDialog
      v-if="statusTarget"
      v-model:visible="statusOpen"
      :title="
        t(
          statusTarget.status === 'Deactivated'
            ? 'access.reactivateTitle'
            : 'access.deactivateTitle',
          {
            name: statusTarget.name,
          },
        )
      "
      :description="
        t(
          statusTarget.status === 'Deactivated'
            ? 'access.reactivateDescription'
            : 'access.deactivateDescription',
        )
      "
      :confirm-label="
        t(statusTarget.status === 'Deactivated' ? 'access.reactivate' : 'access.deactivate')
      "
      :destructive="statusTarget.status !== 'Deactivated'"
      :loading="statusBusy"
      :error="statusError"
      @confirm="changeStatus"
    />
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
.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  cursor: pointer;
}
:deep(.row--deactivated) td {
  color: var(--text-muted);
}
</style>
