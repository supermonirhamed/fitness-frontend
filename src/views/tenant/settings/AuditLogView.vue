<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import {
  tenantApi,
  type AuditEntry,
  type AuditFilterOptions,
  type AuditFilters,
} from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { actionKey, fieldChanges, isoDay } from '@/lib/audit'
import { useStaffAuth } from '@/stores/staffAuth'
import { useFormat } from '@/composables/useFormat'

const { t, te } = useI18n()
const fmt = useFormat()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const firstLoad = ref(true)
const entries = ref<AuditEntry[]>([])
const total = ref(0)
const perPage = ref(50)
const page = ref(1)
const options = ref<AuditFilterOptions>({ actors: [], actions: [], entity_types: [] })
const expanded = ref<Record<number, boolean>>({})

const actor = ref<number | null>(null)
const action = ref<string | null>(null)
const entityType = ref<string | null>(null)
const range = ref<(Date | null)[] | null>(null)

const filters = computed<AuditFilters>(() => ({
  actor: actor.value,
  action: action.value,
  entity_type: entityType.value,
  from: range.value?.[0] ? isoDay(range.value[0]) : null,
  to: range.value?.[1] ? isoDay(range.value[1]) : range.value?.[0] ? isoDay(range.value[0]) : null,
}))
const filtered = computed(() => Object.values(filters.value).some((v) => v !== null))

const actionLabel = (value: string) =>
  te(`audit.actions.${actionKey(value)}`) ? t(`audit.actions.${actionKey(value)}`) : value
const entityLabel = (value: string) =>
  te(`audit.entities.${value}`) ? t(`audit.entities.${value}`) : value
const fieldLabel = (value: string) =>
  te(`audit.fields.${value}`) ? t(`audit.fields.${value}`) : value

const actorOptions = computed(() =>
  options.value.actors.map((a) => ({ value: a.id, label: a.name })),
)
const actionOptions = computed(() =>
  options.value.actions.map((a) => ({ value: a, label: actionLabel(a) })),
)
const entityOptions = computed(() =>
  options.value.entity_types.map((e) => ({ value: e, label: entityLabel(e) })),
)

async function load() {
  state.value = firstLoad.value ? 'loading' : state.value
  try {
    const result = await tenantApi.auditLogs(filters.value, page.value)
    entries.value = result.data
    total.value = result.meta.total
    perPage.value = result.meta.per_page
    state.value = 'ready'
    firstLoad.value = false
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}

onMounted(async () => {
  try {
    options.value = await tenantApi.auditFilterOptions()
  } catch {
    // The list below reports the error.
  }
  await load()
})

watch(filters, () => {
  // A half-picked range waits for the second date.
  if (range.value && range.value[0] && range.value.length === 2 && !range.value[1]) return
  page.value = 1
  load()
})

function onPage(event: DataTablePageEvent) {
  page.value = event.page + 1
  load()
}

function clearFilters() {
  actor.value = null
  action.value = null
  entityType.value = null
  range.value = null
}

function exportCsv() {
  window.location.href = tenantApi.auditExportUrl(filters.value)
}

/** A value in the user's language where we know what it is (scopes, roles, permissions, statuses). */
function label(field: string, value: unknown): string {
  const text = String(value)
  const known = (key: string) => (te(key) ? t(key) : text)
  switch (field) {
    case 'scope':
      return known(`permissions.scopeNames.${text}`)
    case 'status':
      return known(`access.status.${text}`)
    case 'two_factor_required_roles':
      return known(`roles.${text}`)
    case 'permissions': {
      const [module, action] = text.split('.')
      if (!module || !action) return text
      const moduleText = te(`permissions.modules.${module}`)
        ? t(`permissions.modules.${module}`)
        : module
      const actionText = te(`permissions.actions.${action}`)
        ? t(`permissions.actions.${action}`)
        : action
      return `${moduleText}: ${actionText}`
    }
    default:
      return text
  }
}

/** A short, readable value: lists joined, objects as JSON. */
function show(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.map((v) => label(field, v)).join('، ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? t('audit.yes') : t('audit.no')
  return label(field, value)
}

function summary(entry: AuditEntry): string {
  const fields = fieldChanges(entry.old_values, entry.new_values).map((c) => fieldLabel(c.field))
  return fields.join(' · ')
}
</script>

<template>
  <section class="card">
    <div class="filters" role="search">
      <Select
        v-model="actor"
        :options="actorOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('audit.allActors')"
        show-clear
        filter
        class="filters__item"
        :aria-label="t('audit.columns.actor')"
      />
      <Select
        v-model="action"
        :options="actionOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('audit.allActions')"
        show-clear
        class="filters__item"
        :aria-label="t('audit.columns.action')"
      />
      <Select
        v-model="entityType"
        :options="entityOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('audit.allEntities')"
        show-clear
        class="filters__item"
        :aria-label="t('audit.columns.entity')"
      />
      <DatePicker
        v-model="range"
        selection-mode="range"
        :manual-input="false"
        :placeholder="t('audit.dateRange')"
        show-button-bar
        date-format="yy-mm-dd"
        class="filters__item"
        :aria-label="t('audit.dateRange')"
      />
      <span class="filters__spacer" />
      <Button
        v-if="auth.can('audit.export')"
        icon="pi pi-download"
        :label="t('audit.export')"
        severity="secondary"
        variant="outlined"
        :disabled="state !== 'ready' || total === 0"
        @click="exportCsv"
      />
    </div>

    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton v-for="n in 6" :key="n" height="40px" />
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
      :title="t('audit.loadError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>

    <EmptyState v-else-if="total === 0 && filtered" icon="pi-search" :title="t('audit.noResults')">
      <Button
        severity="secondary"
        variant="outlined"
        :label="t('platform.tenants.clearFilters')"
        @click="clearFilters"
      />
    </EmptyState>

    <EmptyState
      v-else-if="total === 0"
      icon="pi-history"
      :title="t('audit.empty')"
      :body="t('audit.emptyHint')"
    />

    <DataTable
      v-else
      v-model:expanded-rows="expanded"
      :value="entries"
      data-key="id"
      size="small"
      lazy
      :paginator="total > perPage"
      :rows="perPage"
      :total-records="total"
      :first="(page - 1) * perPage"
      scrollable
      @page="onPage"
    >
      <Column expander class="expander-col" />
      <Column :header="t('audit.columns.time')">
        <template #body="{ data }">
          <span class="num nowrap">{{ fmt.dateTime(data.created_at) }}</span>
        </template>
      </Column>
      <Column :header="t('audit.columns.actor')">
        <template #body="{ data }">
          <template v-if="data.actor">
            <div>{{ data.actor.name }}</div>
            <div class="sub ltr-isolate">{{ data.actor.email }}</div>
          </template>
          <span v-else class="sub">{{ t('audit.system') }}</span>
        </template>
      </Column>
      <Column :header="t('audit.columns.action')">
        <template #body="{ data }">{{ actionLabel(data.action) }}</template>
      </Column>
      <Column :header="t('audit.columns.entity')">
        <template #body="{ data }">
          <template v-if="data.entity_type">
            <div>{{ data.entity_label ?? `#${data.entity_id}` }}</div>
            <div class="sub">{{ entityLabel(data.entity_type) }}</div>
          </template>
          <span v-else class="sub">—</span>
        </template>
      </Column>
      <Column :header="t('audit.columns.changes')">
        <template #body="{ data }"
          ><span class="sub">{{ summary(data) }}</span></template
        >
      </Column>

      <template #expansion="{ data }">
        <div class="details">
          <table v-if="data.old_values || data.new_values" class="changes">
            <thead>
              <tr>
                <th scope="col">{{ t('audit.field') }}</th>
                <th scope="col">{{ t('audit.before') }}</th>
                <th scope="col">{{ t('audit.after') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="change in fieldChanges(data.old_values, data.new_values)"
                :key="change.field"
              >
                <th scope="row">{{ fieldLabel(change.field) }}</th>
                <template v-if="change.added">
                  <td colspan="2">
                    <div class="chips">
                      <span v-for="v in change.added" :key="`+${v}`" class="chip chip--added"
                        >+ {{ label(change.field, v) }}</span
                      >
                      <span v-for="v in change.removed" :key="`-${v}`" class="chip chip--removed"
                        >− {{ label(change.field, v) }}</span
                      >
                      <span v-if="!change.added.length && !change.removed?.length" class="sub">{{
                        t('audit.noListChange')
                      }}</span>
                    </div>
                  </td>
                </template>
                <template v-else>
                  <td class="before">{{ show(change.field, change.before) }}</td>
                  <td class="after">{{ show(change.field, change.after) }}</td>
                </template>
              </tr>
            </tbody>
          </table>
          <div class="meta">
            <span v-if="data.ip_address"
              >{{ t('audit.ip') }}: <span class="ltr-isolate num">{{ data.ip_address }}</span></span
            >
            <span v-if="data.entity_id"
              >{{ t('audit.entityId') }}: <span class="num">{{ data.entity_id }}</span></span
            >
          </div>
        </div>
      </template>
    </DataTable>
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.filters__item {
  width: 200px;
  max-width: 100%;
}
.filters__spacer {
  flex: 1;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.sub {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.nowrap {
  white-space: nowrap;
}
.details {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4) var(--space-4);
}
.changes {
  border-collapse: collapse;
  font: var(--text-small);
  max-width: 100%;
}
.changes th,
.changes td {
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  text-align: start;
  vertical-align: top;
}
.changes thead th {
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
}
.before {
  color: var(--sev-danger-fg);
}
.after {
  color: var(--sev-success-fg);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.chip {
  padding: 1px 8px;
  border-radius: 999px;
  font: var(--text-caption);
}
.chip--added {
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
}
.chip--removed {
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
}
.meta {
  display: flex;
  gap: var(--space-4);
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 640px) {
  .filters__item {
    width: 100%;
  }
}
</style>
