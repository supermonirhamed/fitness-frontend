<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import PermissionMatrix from '@/components/roles/PermissionMatrix.vue'
import RoleDiffDialog from '@/components/roles/RoleDiffDialog.vue'
import RoleFormDialog from '@/components/roles/RoleFormDialog.vue'
import { tenantApi, type AccessScope, type RoleSummary, type RolesMatrix } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf, validationErrors } from '@/lib/http'
import { permissionDiff } from '@/lib/permissions'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const matrix = ref<RolesMatrix | null>(null)
const selectedId = ref<number | null>(null)

const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)
const selected = computed(() => matrix.value?.roles.find((r) => r.id === selectedId.value) ?? null)
const roleOptions = computed(() =>
  (matrix.value?.roles ?? []).map((r) => ({ value: r.id, label: roleLabel(r.name) })),
)

async function load() {
  state.value = 'loading'
  try {
    matrix.value = await tenantApi.roles()
    selectedId.value ??= matrix.value.roles[0]?.id ?? null
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

/** Put the API's copy of a role in the list; refresh the signed-in user when it is one of theirs. */
async function upsert(role: RoleSummary, previousName?: string) {
  if (!matrix.value) return
  const i = matrix.value.roles.findIndex((r) => r.id === role.id)
  if (i === -1) matrix.value.roles.push(role)
  else matrix.value.roles[i] = role
  const mine = auth.user?.roles ?? []
  if (mine.includes(role.name) || (previousName && mine.includes(previousName)))
    await auth.check(true)
}

// ---- Editing permissions (and scope, for custom roles) ----
const editing = ref(false)
const draft = ref(new Set<string>())
const draftScope = ref<AccessScope>('organization')

const canEdit = computed(() => !!selected.value?.editable && auth.can('roles.update'))
const diff = computed(() =>
  selected.value && matrix.value
    ? permissionDiff(selected.value.permissions, [...draft.value], matrix.value.modules)
    : { added: [], removed: [] },
)
const scopeChanged = computed(
  () => !!selected.value && !selected.value.system && draftScope.value !== selected.value.scope,
)
const dirty = computed(
  () => diff.value.added.length + diff.value.removed.length > 0 || scopeChanged.value,
)
const scopeOptions = computed(() =>
  (matrix.value?.scopes ?? []).map((s) => ({ value: s, label: t(`permissions.scopeNames.${s}`) })),
)

function startEdit() {
  if (!selected.value) return
  draft.value = new Set(selected.value.permissions)
  draftScope.value = selected.value.scope
  editing.value = true
}
function cancelEdit() {
  editing.value = false
}
function toggle(permission: string) {
  const next = new Set(draft.value)
  if (next.has(permission)) next.delete(permission)
  else next.add(permission)
  draft.value = next
}

const diffOpen = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

function review() {
  saveError.value = null
  diffOpen.value = true
}

async function save() {
  if (!selected.value) return
  saving.value = true
  saveError.value = null
  try {
    const role = await tenantApi.updateRole(selected.value.id, {
      permissions: [...draft.value],
      ...(scopeChanged.value ? { scope: draftScope.value } : {}),
    })
    await upsert(role)
    diffOpen.value = false
    editing.value = false
    toast.add({
      severity: 'success',
      summary: t('permissions.savedToast', { role: roleLabel(role.name) }),
      life: 4000,
    })
  } catch (e) {
    saveError.value =
      errorCode(e) === 'cannot_grant' ? t('permissions.cannotGrant') : t('common.genericError')
  } finally {
    saving.value = false
  }
}

// ---- New role / rename ----
const formOpen = ref(false)
const formMode = ref<'create' | 'rename'>('create')
const formBusy = ref(false)
const formError = ref<string | null>(null)

function openForm(mode: 'create' | 'rename') {
  formMode.value = mode
  formError.value = null
  formOpen.value = true
}

async function submitForm(value: { name: string; source: RoleSummary | null; scope: AccessScope }) {
  formBusy.value = true
  formError.value = null
  try {
    if (formMode.value === 'create') {
      const role = await tenantApi.createRole({
        name: value.name,
        scope: value.scope,
        permissions: value.source?.permissions ?? [],
      })
      await upsert(role)
      selectedId.value = role.id
      formOpen.value = false
      toast.add({
        severity: 'success',
        summary: t('permissions.createdToast', { role: role.name }),
        life: 4000,
      })
      if (auth.can('roles.update')) startEdit()
    } else if (selected.value) {
      const previous = selected.value.name
      await upsert(await tenantApi.updateRole(selected.value.id, { name: value.name }), previous)
      formOpen.value = false
    }
  } catch (e) {
    formError.value = validationErrors(e).name
      ? t('permissions.nameTaken')
      : errorCode(e) === 'cannot_grant'
        ? t('permissions.cannotGrantCopy')
        : t('common.genericError')
  } finally {
    formBusy.value = false
  }
}

// ---- Reset to defaults / delete ----
const confirmKind = ref<'reset' | 'delete' | null>(null)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmError = ref<string | null>(null)

function openConfirm(kind: 'reset' | 'delete') {
  confirmKind.value = kind
  confirmError.value = null
  confirmOpen.value = true
}

async function confirmAction() {
  const role = selected.value
  if (!role || !matrix.value) return
  confirmBusy.value = true
  confirmError.value = null
  try {
    if (confirmKind.value === 'reset') {
      await upsert(await tenantApi.resetRole(role.id))
      toast.add({
        severity: 'success',
        summary: t('permissions.resetToast', { role: roleLabel(role.name) }),
        life: 4000,
      })
    } else {
      await tenantApi.deleteRole(role.id)
      matrix.value.roles = matrix.value.roles.filter((r) => r.id !== role.id)
      selectedId.value = matrix.value.roles[0]?.id ?? null
      toast.add({
        severity: 'success',
        summary: t('permissions.deletedToast', { role: role.name }),
        life: 4000,
      })
    }
    confirmOpen.value = false
  } catch (e) {
    confirmError.value =
      errorCode(e) === 'role_in_use'
        ? t('permissions.inUse', { count: role.users_count }, role.users_count)
        : t('common.genericError')
  } finally {
    confirmBusy.value = false
  }
}

// ---- Header menu ----
const menu = ref<InstanceType<typeof Menu>>()
const menuItems = computed(() => {
  const role = selected.value
  if (!role) return []
  const items = []
  if (!role.system && auth.can('roles.update'))
    items.push({
      label: t('permissions.renameRole'),
      icon: 'pi pi-pencil',
      command: () => openForm('rename'),
    })
  if (role.system && role.editable && auth.can('roles.update'))
    items.push({
      label: t('permissions.resetDefaults'),
      icon: 'pi pi-replay pi-dir',
      command: () => openConfirm('reset'),
    })
  if (!role.system && auth.can('roles.delete'))
    items.push({
      label: t('permissions.deleteRole'),
      icon: 'pi pi-trash',
      command: () => openConfirm('delete'),
    })
  return items
})
</script>

<template>
  <div v-if="state === 'loading'" class="roles" aria-busy="true" :aria-label="t('common.loading')">
    <div class="card list"><Skeleton v-for="n in 6" :key="n" height="44px" /></div>
    <div class="card detail"><Skeleton v-for="n in 8" :key="n" height="28px" /></div>
  </div>

  <section v-else-if="state === 'forbidden'" class="card">
    <EmptyState
      icon="pi-lock"
      :title="t('permissions.forbidden')"
      :body="t('permissions.forbiddenHint')"
    />
  </section>

  <section v-else-if="state === 'error' || !matrix" class="card">
    <EmptyState icon="pi-exclamation-triangle" :title="t('permissions.loadError')">
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>
  </section>

  <div v-else class="roles">
    <div class="side">
      <Button
        v-if="auth.can('roles.create')"
        icon="pi pi-plus"
        :label="t('permissions.newRole')"
        :disabled="editing"
        fluid
        @click="openForm('create')"
      />
      <!-- Role list (a select on narrow screens) -->
      <nav class="card list" :aria-label="t('permissions.rolesList')">
        <button
          v-for="role in matrix.roles"
          :key="role.id"
          type="button"
          :class="['role', { 'role--active': role.id === selectedId }]"
          :aria-current="role.id === selectedId ? 'true' : undefined"
          :disabled="editing && role.id !== selectedId"
          @click="selectedId = role.id"
        >
          <span class="role__name">
            <i
              v-if="role.system"
              class="pi pi-lock"
              :title="t('permissions.systemRole')"
              aria-hidden="true"
            />
            {{ roleLabel(role.name) }}
          </span>
          <span class="role__count num">{{
            t('permissions.usersCount', { count: role.users_count }, role.users_count)
          }}</span>
        </button>
      </nav>
      <Select
        v-model="selectedId"
        :options="roleOptions"
        option-label="label"
        option-value="value"
        class="list-select"
        :aria-label="t('permissions.rolesList')"
        :disabled="editing"
        fluid
      />
    </div>

    <section v-if="selected" class="card detail">
      <header class="detail__head">
        <div class="detail__title">
          <h2>{{ roleLabel(selected.name) }}</h2>
          <p v-if="!(editing && !selected.system)">
            {{ t(`permissions.scopes.${selected.scope}`) }}
          </p>
        </div>
        <Tag
          :severity="selected.system ? 'secondary' : 'info'"
          :icon="selected.system ? 'pi pi-lock' : undefined"
          :value="selected.system ? t('permissions.systemRole') : t('permissions.customRole')"
        />
        <template v-if="!editing">
          <Button
            v-if="canEdit"
            icon="pi pi-sliders-h"
            :label="t('permissions.editPermissions')"
            severity="secondary"
            variant="outlined"
            size="small"
            @click="startEdit"
          />
          <Button
            v-if="menuItems.length"
            icon="pi pi-ellipsis-v"
            severity="secondary"
            variant="text"
            size="small"
            :aria-label="t('permissions.moreActions')"
            aria-haspopup="true"
            aria-controls="role-menu"
            @click="menu?.toggle($event)"
          />
          <Menu id="role-menu" ref="menu" :model="menuItems" popup />
        </template>
      </header>

      <Message v-if="!selected.editable" severity="info" :closable="false">{{
        t('permissions.ownerNote')
      }}</Message>
      <Message v-else-if="selected.system && !editing" severity="secondary" :closable="false">{{
        t('permissions.systemNote')
      }}</Message>

      <div
        v-if="editing"
        class="editbar"
        role="region"
        :aria-label="t('permissions.editPermissions')"
      >
        <div class="editbar__text">
          <strong>{{ t('permissions.editingTitle') }}</strong>
          <span>{{
            t('permissions.editingHint', { count: selected.users_count }, selected.users_count)
          }}</span>
        </div>
        <Select
          v-if="!selected.system"
          v-model="draftScope"
          :options="scopeOptions"
          option-label="label"
          option-value="value"
          size="small"
          :aria-label="t('permissions.scope')"
        />
        <div class="editbar__actions">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            variant="text"
            size="small"
            @click="cancelEdit"
          />
          <Button
            :label="
              dirty
                ? t('permissions.reviewChanges', { count: diff.added.length + diff.removed.length })
                : t('permissions.noChanges')
            "
            size="small"
            :disabled="!dirty"
            @click="review"
          />
        </div>
      </div>

      <PermissionMatrix
        :modules="matrix.modules"
        :granted="editing ? draft : new Set(selected.permissions)"
        :editing="editing"
        :can-grant="(p) => auth.can(p)"
        :caption="t('permissions.matrixCaption', { role: roleLabel(selected.name) })"
        @toggle="toggle"
      />
    </section>

    <RoleFormDialog
      v-model:visible="formOpen"
      :mode="formMode"
      :roles="matrix.roles"
      :scopes="matrix.scopes"
      :role="selected"
      :loading="formBusy"
      :error="formError"
      @submit="submitForm"
    />
    <RoleDiffDialog
      v-if="selected"
      v-model:visible="diffOpen"
      :role-name="roleLabel(selected.name)"
      :diff="diff"
      :scope-change="
        scopeChanged
          ? t('permissions.scopeChange', { scope: t(`permissions.scopeNames.${draftScope}`) })
          : null
      "
      :users-count="selected.users_count"
      :loading="saving"
      :error="saveError"
      @confirm="save"
    />
    <ConfirmActionDialog
      v-if="selected"
      v-model:visible="confirmOpen"
      :title="
        confirmKind === 'delete'
          ? t('permissions.deleteTitle', { role: selected.name })
          : t('permissions.resetTitle', { role: roleLabel(selected.name) })
      "
      :description="
        confirmKind === 'delete'
          ? t('permissions.deleteDescription')
          : t('permissions.resetDescription')
      "
      :confirm-label="
        confirmKind === 'delete' ? t('permissions.deleteRole') : t('permissions.resetDefaults')
      "
      :destructive="confirmKind === 'delete'"
      :loading="confirmBusy"
      :error="confirmError"
      @confirm="confirmAction"
    />
  </div>
</template>

<style scoped>
.roles {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.list {
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  gap: 2px;
}
.list-select {
  display: none;
}
.role {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-primary);
  text-align: start;
  font: inherit;
  cursor: pointer;
}
.role:hover:not(:disabled) {
  background: var(--surface-hover);
}
.role:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.role--active,
.role--active:hover {
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
}
.role__name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--fw-medium);
}
.role__name i {
  font-size: 11px;
  color: var(--text-muted);
}
.role__count {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  min-width: 0;
}
.detail__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.detail__title {
  flex: 1;
  min-width: 200px;
}
.detail__title h2 {
  margin: 0;
  font: var(--text-h3);
}
.detail__title p {
  margin: var(--space-1) 0 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.editbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3);
  background: var(--primary-subtle);
  border-radius: var(--radius-card);
}
.editbar__text {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  font: var(--text-small);
  color: var(--primary-subtle-text);
}
.editbar__actions {
  display: flex;
  gap: var(--space-2);
}
@media (max-width: 860px) {
  .roles {
    grid-template-columns: minmax(0, 1fr);
  }
  .list {
    display: none;
  }
  .list-select {
    display: flex;
  }
}
</style>
