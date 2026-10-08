<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type RolesMatrix } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { STANDARD_ACTIONS, specialActions } from '@/lib/permissions'

const { t, te } = useI18n()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const matrix = ref<RolesMatrix | null>(null)
const selectedName = ref<string | null>(null)

const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)
const actionLabel = (action: string) =>
  te(`permissions.actions.${action}`) ? t(`permissions.actions.${action}`) : action

const selected = computed(
  () => matrix.value?.roles.find((r) => r.name === selectedName.value) ?? null,
)
const granted = computed(() => new Set(selected.value?.permissions ?? []))
const isOwner = computed(() => selected.value?.name === 'Organization Owner')
const rows = computed(() =>
  Object.entries(matrix.value?.modules ?? {}).map(([module, actions]) => ({
    module,
    actions,
    special: specialActions(actions),
    any: actions.some((a) => granted.value.has(`${module}.${a}`)),
  })),
)
const roleOptions = computed(() =>
  (matrix.value?.roles ?? []).map((r) => ({ value: r.name, label: roleLabel(r.name) })),
)

async function load() {
  state.value = 'loading'
  try {
    matrix.value = await tenantApi.roles()
    selectedName.value ??= matrix.value.roles[0]?.name ?? null
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)
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
    <!-- Role list (a select on narrow screens) -->
    <nav class="card list" :aria-label="t('permissions.rolesList')">
      <button
        v-for="role in matrix.roles"
        :key="role.name"
        type="button"
        :class="['role', { 'role--active': role.name === selectedName }]"
        :aria-current="role.name === selectedName ? 'true' : undefined"
        @click="selectedName = role.name"
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
      v-model="selectedName"
      :options="roleOptions"
      option-label="label"
      option-value="value"
      class="list-select"
      :aria-label="t('permissions.rolesList')"
      fluid
    />

    <section v-if="selected" class="card detail">
      <header class="detail__head">
        <div>
          <h2>{{ roleLabel(selected.name) }}</h2>
          <p>{{ t(`permissions.scopes.${selected.scope}`) }}</p>
        </div>
        <Tag
          v-if="selected.system"
          severity="secondary"
          icon="pi pi-lock"
          :value="t('permissions.systemRole')"
        />
      </header>

      <Message v-if="isOwner" severity="info" :closable="false">{{
        t('permissions.ownerNote')
      }}</Message>
      <Message v-else-if="selected.system" severity="secondary" :closable="false">{{
        t('permissions.systemNote')
      }}</Message>

      <div class="matrix-wrap">
        <table class="matrix">
          <caption class="sr-only">
            {{
              t('permissions.matrixCaption', { role: roleLabel(selected.name) })
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t('permissions.module') }}</th>
              <th
                v-for="action in STANDARD_ACTIONS"
                :key="action"
                scope="col"
                class="matrix__check"
              >
                {{ actionLabel(action) }}
              </th>
              <th scope="col">{{ t('permissions.special') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.module" :class="{ 'matrix__row--none': !row.any }">
              <th scope="row">{{ t(`permissions.modules.${row.module}`) }}</th>
              <td v-for="action in STANDARD_ACTIONS" :key="action" class="matrix__check">
                <template v-if="row.actions.includes(action)">
                  <i
                    v-if="granted.has(`${row.module}.${action}`)"
                    class="pi pi-check matrix__yes"
                    :aria-label="t('permissions.allowed')"
                  />
                  <i
                    v-else
                    class="pi pi-minus matrix__no"
                    :aria-label="t('permissions.notAllowed')"
                  />
                </template>
              </td>
              <td>
                <div class="matrix__special">
                  <span
                    v-for="action in row.special"
                    :key="action"
                    :class="[
                      'chip',
                      granted.has(`${row.module}.${action}`) ? 'chip--on' : 'chip--off',
                    ]"
                  >
                    <i
                      :class="[
                        'pi',
                        granted.has(`${row.module}.${action}`) ? 'pi-check' : 'pi-minus',
                      ]"
                      aria-hidden="true"
                    />
                    {{ actionLabel(action) }}
                    <span class="sr-only">{{
                      granted.has(`${row.module}.${action}`)
                        ? t('permissions.allowed')
                        : t('permissions.notAllowed')
                    }}</span>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.roles {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
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
.role:hover {
  background: var(--surface-hover);
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
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.detail__head h2 {
  margin: 0;
  font: var(--text-h3);
}
.detail__head p {
  margin: var(--space-1) 0 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.matrix-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.matrix {
  width: 100%;
  border-collapse: collapse;
  font: var(--text-small);
}
.matrix th,
.matrix td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  text-align: start;
  vertical-align: middle;
}
.matrix thead th {
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.matrix tbody th {
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.matrix tbody tr:last-child th,
.matrix tbody tr:last-child td {
  border-bottom: 0;
}
.matrix__row--none th {
  color: var(--text-muted);
}
.matrix__check {
  text-align: center !important;
  width: 72px;
}
.matrix__yes {
  color: var(--sev-success-fg);
}
.matrix__no {
  color: var(--border-strong);
  font-size: 11px;
}
.matrix__special {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font: var(--text-caption);
  white-space: nowrap;
}
.chip i {
  font-size: 9px;
}
.chip--on {
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
}
.chip--off {
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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
