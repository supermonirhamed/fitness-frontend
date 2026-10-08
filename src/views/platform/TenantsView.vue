<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { watchDebounced } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import CreateTenantDrawer from './CreateTenantDrawer.vue'
import { platformApi, type Tenant, type TenantStatus } from '@/api/platform'
import { validationErrors } from '@/lib/http'

const { t, d } = useI18n()
const toast = useToast()

const PER_PAGE = 25
const tenants = ref<Tenant[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const status = ref<TenantStatus | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const firstLoad = ref(true)

const statusOptions = computed(() =>
  (['Active', 'Provisioning', 'Failed', 'Suspended'] as const).map((value) => ({
    value,
    label: t(`status.${value}`),
  })),
)
const filtered = computed(() => search.value.trim() !== '' || status.value !== null)

async function load() {
  state.value = 'loading'
  try {
    const result = await platformApi.tenants({
      page: page.value,
      per_page: PER_PAGE,
      search: search.value.trim() || undefined,
      status: status.value,
    })
    tenants.value = result.data
    total.value = result.meta.total
    state.value = 'ready'
    firstLoad.value = false
  } catch {
    state.value = 'error'
  }
}

watchDebounced(search, () => resetAndLoad(), { debounce: 300 })
watch(status, () => resetAndLoad())

function resetAndLoad() {
  page.value = 1
  load()
}

function onPage(event: DataTablePageEvent) {
  page.value = event.page + 1
  load()
}

function clearFilters() {
  search.value = ''
  status.value = null
}

// Create / provisioning drawer
const drawerOpen = ref(false)
const drawerTenant = ref<Tenant | null>(null)

function openCreate() {
  drawerTenant.value = null
  drawerOpen.value = true
}

function openProgress(tenant: Tenant) {
  drawerTenant.value = tenant
  drawerOpen.value = true
}

function upsert(tenant: Tenant) {
  const i = tenants.value.findIndex((x) => x.id === tenant.id)
  if (i === -1) {
    tenants.value.unshift(tenant)
    total.value++
  } else {
    tenants.value[i] = tenant
  }
}

// Suspend / reactivate (required reason, audited)
const action = ref<{ kind: 'suspend' | 'reactivate'; tenant: Tenant } | null>(null)
const actionOpen = ref(false)
const actionBusy = ref(false)
const actionError = ref<string | null>(null)

function openAction(kind: 'suspend' | 'reactivate', tenant: Tenant) {
  action.value = { kind, tenant }
  actionError.value = null
  actionOpen.value = true
}

async function confirmAction(reason: string) {
  if (!action.value) return
  const { kind, tenant } = action.value
  actionBusy.value = true
  actionError.value = null
  try {
    const updated = await (kind === 'suspend'
      ? platformApi.suspend(tenant.id, reason)
      : platformApi.reactivate(tenant.id, reason))
    upsert(updated)
    actionOpen.value = false
    toast.add({
      severity: 'success',
      summary: t(`platform.tenants.${kind}Done`, { name: tenant.name }),
      life: 4000,
    })
  } catch (e) {
    actionError.value = validationErrors(e).reason?.[0] ?? t('common.genericError')
  } finally {
    actionBusy.value = false
  }
}

const count = (n: number | null) => (n === null ? '—' : n)

onMounted(load)
</script>

<template>
  <div class="tenants">
    <PageHeader :title="t('platform.tenants.title')" :subtitle="t('platform.tenants.subtitle')">
      <template #actions>
        <Button icon="pi pi-plus" :label="t('platform.tenants.new')" @click="openCreate" />
      </template>
    </PageHeader>

    <section class="card">
      <div class="filters" role="search">
        <IconField class="filters__search">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="search"
            :placeholder="t('platform.tenants.searchPlaceholder')"
            :aria-label="t('platform.tenants.searchPlaceholder')"
            fluid
          />
        </IconField>
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('platform.tenants.allStatuses')"
          show-clear
          class="filters__status"
          :aria-label="t('platform.tenants.columns.status')"
        />
      </div>

      <div
        v-if="state === 'loading' && firstLoad"
        class="skeleton"
        aria-busy="true"
        :aria-label="t('common.loading')"
      >
        <Skeleton v-for="n in 5" :key="n" height="40px" />
      </div>

      <EmptyState
        v-else-if="state === 'error'"
        icon="pi-exclamation-triangle"
        :title="t('platform.tenants.loadError')"
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
        v-else-if="total === 0 && filtered"
        icon="pi-search"
        :title="t('platform.tenants.noResults')"
      >
        <Button
          severity="secondary"
          variant="outlined"
          :label="t('platform.tenants.clearFilters')"
          @click="clearFilters"
        />
      </EmptyState>

      <EmptyState
        v-else-if="total === 0"
        icon="pi-building"
        :title="t('platform.tenants.empty')"
        :body="t('platform.tenants.emptyHint')"
      >
        <Button icon="pi pi-plus" :label="t('platform.tenants.new')" @click="openCreate" />
      </EmptyState>

      <DataTable
        v-else
        :value="tenants"
        data-key="id"
        size="small"
        lazy
        :loading="state === 'loading'"
        :paginator="total > PER_PAGE"
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        scrollable
        @page="onPage"
      >
        <Column :header="t('platform.tenants.columns.name')">
          <template #body="{ data }">
            <div class="tenants__name">{{ data.name }}</div>
            <a
              v-if="data.status === 'Active'"
              :href="data.url"
              target="_blank"
              rel="noopener"
              class="tenants__sub ltr-isolate"
              >{{ data.domain }}</a
            >
            <span v-else class="tenants__sub ltr-isolate">{{ data.domain }}</span>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.owner')">
          <template #body="{ data }">
            <div>{{ data.owner_name }}</div>
            <div class="tenants__sub ltr-isolate">{{ data.owner_email }}</div>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.plan')">
          <template #body="{ data }">
            <span :class="{ tenants__muted: !data.plan }">{{ data.plan ?? '—' }}</span>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.status')">
          <template #body="{ data }">
            <div class="tenants__status">
              <StatusTag :status="data.status" />
              <i
                v-if="data.status === 'Suspended' && data.suspension_reason"
                v-tooltip.top="data.suspension_reason"
                class="pi pi-info-circle tenants__muted"
                tabindex="0"
                :aria-label="data.suspension_reason"
              />
            </div>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.locations')" class="num-col">
          <template #body="{ data }">
            <span class="num">{{ count(data.locations_count) }}</span>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.clients')" class="num-col">
          <template #body="{ data }">
            <span class="num">{{ count(data.active_clients_count) }}</span>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.created')">
          <template #body="{ data }">
            <span class="num">{{ d(new Date(data.created_at), 'short') }}</span>
          </template>
        </Column>
        <Column class="actions-col">
          <template #body="{ data }">
            <div class="tenants__actions">
              <Button
                v-if="data.status === 'Active'"
                size="small"
                variant="text"
                severity="danger"
                icon="pi pi-ban"
                :label="t('platform.tenants.suspend')"
                @click="openAction('suspend', data)"
              />
              <Button
                v-else-if="data.status === 'Suspended'"
                size="small"
                variant="text"
                icon="pi pi-check-circle"
                :label="t('platform.tenants.reactivate')"
                @click="openAction('reactivate', data)"
              />
              <Button
                v-else-if="data.status === 'Failed'"
                size="small"
                variant="text"
                icon="pi pi-replay pi-dir"
                :label="t('common.retry')"
                @click="openProgress(data)"
              />
              <Button
                v-else
                size="small"
                variant="text"
                severity="secondary"
                icon="pi pi-eye"
                :label="t('platform.tenants.viewProgress')"
                @click="openProgress(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <CreateTenantDrawer v-model:visible="drawerOpen" :tenant="drawerTenant" @updated="upsert" />

    <OverrideDialog
      v-model:visible="actionOpen"
      :title="action ? t(`platform.tenants.${action.kind}Title`, { name: action.tenant.name }) : ''"
      :description="action ? t(`platform.tenants.${action.kind}Description`) : ''"
      :confirm-label="action ? t(`platform.tenants.${action.kind}`) : ''"
      :destructive="action?.kind === 'suspend'"
      :loading="actionBusy"
      :error="actionError"
      @confirm="confirmAction"
    />
  </div>
</template>

<style scoped>
.tenants {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
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
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.filters__search {
  flex: 1;
  min-width: 220px;
  max-width: 360px;
}
.filters__status {
  width: 180px;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.tenants__name {
  font-weight: var(--fw-semibold);
}
.tenants__sub {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.tenants__muted {
  color: var(--text-muted);
}
.tenants__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.tenants__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
