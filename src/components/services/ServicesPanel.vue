<script setup lang="ts">
// The service catalog (US-02.02/03): filters, list, create and edit. Branch-limited staff see
// the services of their branches.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ServiceFormDrawer from '@/components/services/ServiceFormDrawer.vue'
import {
  ACTIVITY_TYPES,
  tenantApi,
  type ActivityType,
  type Location,
  type Service,
  type ServiceCategory,
  type ServiceStatus,
} from '@/api/tenant'
import { ACTIVITY_ICONS, activityKey, durationParts } from '@/lib/catalog'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ categories: ServiceCategory[]; locationId?: number | null }>()
const { t, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))
const canUpdate = computed(() => auth.can('services.update'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const services = ref<Service[]>([])
const locations = ref<Location[]>([])
const search = ref('')
const category = ref<number | null>(null)
const type = ref<ActivityType | null>(null)
const status = ref<ServiceStatus | null>(null)

async function load() {
  state.value = 'loading'
  try {
    services.value = await tenantApi.services.list({
      ...(props.locationId ? { location_id: props.locationId } : {}),
      ...(category.value ? { category_id: category.value } : {}),
      ...(type.value ? { activity_type: type.value } : {}),
      ...(status.value ? { status: status.value } : {}),
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
    })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
async function loadLocations() {
  try {
    locations.value = await tenantApi.locations()
  } catch {
    locations.value = []
  }
}
onMounted(() => {
  load()
  if (canCreate.value || canUpdate.value) loadLocations()
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
watch([category, type, status, () => props.locationId], load)

const typeOptions = computed(() =>
  ACTIVITY_TYPES.map((v) => ({ value: v, label: t(`catalog.types.${activityKey(v)}`) })),
)
const statusOptions = computed(() =>
  (['Draft', 'Published', 'Archived'] as const).map((v) => ({
    value: v,
    label: t(`catalog.status.${v}`),
  })),
)
const severity = (s: ServiceStatus) =>
  s === 'Published' ? 'success' : s === 'Draft' ? 'info' : 'secondary'
const duration = (minutes: number) => {
  const { h, m } = durationParts(minutes)
  return [h ? t('catalog.hours', { n: h }) : null, m ? t('catalog.mins', { n: m }) : null]
    .filter(Boolean)
    .join(' ')
}
const branchNames = (s: Service) =>
  (s.locations ?? []).map((l) => l.name).join(locale.value === 'ar' ? '، ' : ', ')
const filtered = computed(() => !!(search.value || category.value || type.value || status.value))

const drawerOpen = ref(false)
const editing = ref<Service | null>(null)
function open(service: Service | null = null) {
  editing.value = service
  drawerOpen.value = true
}
function onSaved(saved: Service, created: boolean) {
  toast.add({
    severity: 'success',
    summary: t(created ? 'catalog.serviceCreated' : 'catalog.serviceSaved', {
      name: saved.display_name,
    }),
    life: 3000,
  })
  load()
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <IconField class="search">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="search"
          :placeholder="t('catalog.search')"
          :aria-label="t('catalog.search')"
          fluid
        />
      </IconField>
      <Select
        v-model="category"
        :options="categories"
        option-label="display_name"
        option-value="id"
        :placeholder="t('catalog.allCategories')"
        show-clear
        class="filter"
        :aria-label="t('catalog.category')"
      />
      <Select
        v-model="type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('catalog.allTypes')"
        show-clear
        class="filter"
        :aria-label="t('catalog.activityType')"
      />
      <Select
        v-model="status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('catalog.allStatuses')"
        show-clear
        class="filter"
        :aria-label="t('catalog.statusLabel')"
      />
      <span class="spacer" />
      <Button
        v-if="canCreate"
        icon="pi pi-plus"
        :label="t('catalog.newService')"
        :disabled="!categories.length"
        @click="open()"
      />
    </div>

    <div v-if="state === 'loading'" class="stack">
      <Skeleton v-for="n in 4" :key="n" height="52px" />
    </div>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('catalog.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>
    <EmptyState
      v-else-if="!services.length"
      :icon="filtered ? 'pi-filter-slash' : 'pi-tags'"
      :title="filtered ? t('catalog.noMatches') : t('catalog.noServices')"
      :body="
        filtered ? '' : categories.length ? t('catalog.noServicesHint') : t('catalog.categoryFirst')
      "
    >
      <Button
        v-if="canCreate && !filtered && categories.length"
        icon="pi pi-plus"
        :label="t('catalog.newService')"
        @click="open()"
      />
    </EmptyState>
    <DataTable v-else :value="services" data-key="id" size="small" class="table">
      <Column :header="t('catalog.columns.service')">
        <template #body="{ data }">
          <div class="name-cell">
            <span
              class="swatch"
              :style="{ background: data.color ?? 'var(--border-default)' }"
              aria-hidden="true"
            />
            <div>
              <div class="name">{{ data.display_name }}</div>
              <div class="sub">
                <i :class="['pi', data.category?.icon]" aria-hidden="true" />
                {{ data.category?.display_name }}
              </div>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('catalog.columns.type')">
        <template #body="{ data }">
          <span class="type"
            ><i
              :class="['pi', ACTIVITY_ICONS[data.activity_type as ActivityType]]"
              aria-hidden="true"
            />{{ t(`catalog.types.${activityKey(data.activity_type)}`) }}</span
          >
        </template>
      </Column>
      <Column :header="t('catalog.columns.defaults')">
        <template #body="{ data }">
          <span class="num">{{ duration(data.default_duration) }}</span>
          <span v-if="data.default_capacity" class="sub">
            · {{ t('catalog.people', data.default_capacity) }}</span
          >
        </template>
      </Column>
      <Column v-if="!locationId" :header="t('catalog.columns.branches')">
        <template #body="{ data }"
          ><span class="sub">{{ branchNames(data) || '—' }}</span></template
        >
      </Column>
      <Column :header="t('catalog.columns.status')">
        <template #body="{ data }"
          ><Tag :severity="severity(data.status)" :value="t(`catalog.status.${data.status}`)"
        /></template>
      </Column>
      <Column v-if="canUpdate" class="actions-col">
        <template #body="{ data }">
          <Button
            icon="pi pi-pencil"
            severity="secondary"
            variant="text"
            rounded
            size="small"
            :aria-label="t('catalog.edit', { name: data.display_name })"
            @click="open(data)"
          />
        </template>
      </Column>
    </DataTable>

    <ServiceFormDrawer
      v-model:visible="drawerOpen"
      :service="editing"
      :categories="categories"
      :locations="locations"
      :location-id="locationId"
      @saved="onSaved"
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
  gap: var(--space-2);
  flex-wrap: wrap;
}
.search {
  min-width: 200px;
  flex: 1;
  max-width: 300px;
}
.filter {
  min-width: 150px;
}
.spacer {
  flex: 1;
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
.swatch {
  width: 10px;
  height: 36px;
  border-radius: 3px;
  flex-shrink: 0;
}
.name {
  font-weight: var(--fw-medium);
}
.sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
.type {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
