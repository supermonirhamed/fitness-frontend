<script setup lang="ts">
// The service catalog (US-02.02/03, list & filters US-02.10), laid out as the design's services
// table (ui_kits/admin/ServicesScreen.jsx): filter bar above, whole-row click to the service,
// dark bulk bar for publish / add to branch / archive. Branch-limited staff see their branches' services.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import BranchChips from '@/components/patterns/BranchChips.vue'
import BulkActionBar from '@/components/patterns/BulkActionBar.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar from '@/components/patterns/FilterBar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  ACTIVITY_TYPES,
  tenantApi,
  type ActivityType,
  type Service,
  type ServiceCategory,
  type StaffOption,
} from '@/api/tenant'
import { ACTIVITY_ICONS, activityKey } from '@/lib/catalog'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ categories: ServiceCategory[]; locationId?: number | null }>()
const emit = defineEmits<{ create: [] }>()
const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))
const canUpdate = computed(() => auth.can('services.update'))

// "active" = not archived, the design's default status filter.
type StatusFilter = 'active' | 'Published' | 'Draft' | 'Archived'

const state = ref<'loading' | 'ready' | 'error'>('loading')
const services = ref<Service[]>([])
const search = ref('')
const category = ref<number | 'all'>('all')
const type = ref<ActivityType | 'all'>('all')
const status = ref<StatusFilter>('active')
const branch = ref<number | null>(null)
const coach = ref<number | null>(null)
const coaches = ref<StaffOption[]>([])
const branches = computed(() => auth.user?.switchable_locations ?? [])

async function load() {
  state.value = 'loading'
  try {
    const list = await tenantApi.services.list({
      ...(props.locationId ? { location_id: props.locationId } : {}),
      ...(category.value !== 'all' ? { category_id: category.value } : {}),
      ...(type.value !== 'all' ? { activity_type: type.value } : {}),
      ...(status.value !== 'active' ? { status: status.value } : {}),
      ...(!props.locationId && branch.value ? { location_id: branch.value } : {}),
      ...(coach.value ? { staff_id: coach.value } : {}),
      ...(search.value.trim() ? { search: search.value.trim() } : {}),
    })
    services.value = status.value === 'active' ? list.filter((s) => s.status !== 'Archived') : list
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  load()
  try {
    coaches.value = await tenantApi.services.staffOptions()
  } catch {
    coaches.value = []
  }
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
watch([category, type, status, branch, coach, () => props.locationId], load)
defineExpose({ load })

const categoryOptions = computed(() => [
  { value: 'all', label: t('catalog.allCategories') },
  ...props.categories.map((c) => ({ value: c.id, label: c.display_name ?? '' })),
])
const typeOptions = computed(() => [
  { value: 'all', label: t('catalog.allTypes'), icon: null as string | null },
  ...ACTIVITY_TYPES.map((v) => ({
    value: v,
    label: t(`catalog.types.${activityKey(v)}`),
    icon: ACTIVITY_ICONS[v],
  })),
])
const statusOptions = computed(() =>
  (['active', 'Published', 'Draft', 'Archived'] as const).map((v) => ({
    value: v,
    label: v === 'active' ? t('catalog.notArchived') : t(`catalog.status.${v}`),
  })),
)
const filtered = computed(
  () =>
    !!(
      search.value ||
      category.value !== 'all' ||
      type.value !== 'all' ||
      status.value !== 'active' ||
      branch.value ||
      coach.value
    ),
)

// "Branch, coach" sit behind one button (design: FilterBar onMoreFilters), with chips when set.
const more = ref<InstanceType<typeof Popover>>()
const moreCount = computed(() => (branch.value ? 1 : 0) + (coach.value ? 1 : 0))
const chips = computed(() => [
  ...(branch.value
    ? [
        {
          key: 'branch',
          label: branches.value.find((b) => b.id === branch.value)?.name ?? '',
          clear: () => (branch.value = null),
        },
      ]
    : []),
  ...(coach.value
    ? [
        {
          key: 'coach',
          label: coaches.value.find((c) => c.id === coach.value)?.name ?? '',
          clear: () => (coach.value = null),
        },
      ]
    : []),
])
function clearFilters() {
  search.value = ''
  category.value = 'all'
  type.value = 'all'
  status.value = 'active'
  branch.value = null
  coach.value = null
}

/** Name missing in one language (design: pi-language warning next to the name). */
const missingName = (s: Service) => !s.name.ar?.trim() || !s.name.en?.trim()
const branchNames = (s: Service) => (s.locations ?? []).map((l) => l.name ?? '')
function open(s: Service, event?: Event) {
  // The selection checkbox lives in the row; ticking it must not open the service.
  if ((event?.target as HTMLElement | null)?.closest('.no-click, .p-checkbox')) return
  router.push({ name: 'tenant.services.show', params: { id: s.id } })
}

// Bulk actions (US-02.10)
const selected = ref<Service[]>([])
watch(
  services,
  () => (selected.value = selected.value.filter((s) => services.value.some((x) => x.id === s.id))),
)
const bulkBusy = ref(false)
const archiveOpen = ref(false)
const branchMenu = ref<InstanceType<typeof Menu>>()
const branchItems = computed<MenuItem[]>(() =>
  branches.value.map((b) => ({
    label: b.name,
    icon: 'pi pi-building',
    command: () => bulk('add_location', b.id),
  })),
)
async function bulk(
  action: 'publish' | 'archive' | 'add_location',
  locationId: number | null = null,
) {
  bulkBusy.value = true
  try {
    const changed = await tenantApi.services.bulk(
      selected.value.map((s) => s.id),
      action,
      locationId,
    )
    toast.add({
      severity: 'success',
      summary: t(`catalog.bulk.done.${action}`, changed.length),
      life: 3000,
    })
    archiveOpen.value = false
    selected.value = []
    load()
  } catch (e) {
    // e.g. a selected service has upcoming sessions: it is archived on its own page (US-02.12).
    archiveOpen.value = false
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 7000 })
  } finally {
    bulkBusy.value = false
  }
}
</script>

<template>
  <div class="panel">
    <FilterBar v-model:search="search" :placeholder="t('catalog.searchBoth')">
      <Select
        v-model="category"
        :options="categoryOptions"
        option-label="label"
        option-value="value"
        class="filter"
        :aria-label="t('catalog.category')"
      />
      <Select
        v-model="type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        class="filter"
        :aria-label="t('catalog.activityType')"
      >
        <template #option="{ option }">
          <span class="option"
            ><i v-if="option.icon" :class="['pi', option.icon]" aria-hidden="true" />{{
              option.label
            }}</span
          >
        </template>
      </Select>
      <Select
        v-model="status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        class="filter filter--status"
        :aria-label="t('catalog.statusLabel')"
      />
      <Button
        v-if="(!locationId && branches.length > 1) || coaches.length"
        :label="t('catalog.moreFilters')"
        icon="pi pi-filter"
        severity="secondary"
        variant="outlined"
        :badge="moreCount ? String(moreCount) : undefined"
        @click="more?.toggle($event)"
      />
      <Popover ref="more">
        <div class="more">
          <label v-if="!locationId && branches.length > 1" class="more__field">
            <span>{{ t('catalog.columns.branches') }}</span>
            <Select
              v-model="branch"
              :options="branches"
              option-label="name"
              option-value="id"
              :placeholder="t('catalog.allBranches')"
              show-clear
              fluid
            />
          </label>
          <label v-if="coaches.length" class="more__field">
            <span>{{ t('catalog.coach') }}</span>
            <Select
              v-model="coach"
              :options="coaches"
              option-label="name"
              option-value="id"
              :placeholder="t('catalog.anyCoach')"
              show-clear
              filter
              fluid
            />
          </label>
        </div>
      </Popover>
    </FilterBar>

    <div v-if="chips.length" class="chips">
      <span v-for="chip in chips" :key="chip.key" class="chip">
        {{ chip.label }}
        <button type="button" :aria-label="t('catalog.removeFilter')" @click="chip.clear">
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </span>
      <Button
        size="small"
        variant="text"
        severity="secondary"
        :label="t('catalog.clearAll')"
        @click="clearFilters"
      />
    </div>

    <BulkActionBar
      v-if="canUpdate && selected.length"
      :label="t('catalog.bulk.selected', selected.length)"
      @clear="selected = []"
    >
      <Button
        size="small"
        icon="pi pi-send"
        :label="t('catalog.bulk.publish')"
        :loading="bulkBusy"
        @click="bulk('publish')"
      />
      <template v-if="!locationId && branches.length">
        <Button
          size="small"
          icon="pi pi-building"
          :label="t('catalog.bulk.addToBranch')"
          :disabled="bulkBusy"
          aria-haspopup="true"
          @click="branchMenu?.toggle($event)"
        />
        <Menu ref="branchMenu" :model="branchItems" popup />
      </template>
      <Button
        size="small"
        icon="pi pi-inbox"
        :label="t('catalog.bulk.archive')"
        :disabled="bulkBusy"
        @click="archiveOpen = true"
      />
    </BulkActionBar>

    <div v-if="state === 'loading'" class="card" aria-busy="true" :aria-label="t('common.loading')">
      <div v-for="n in 5" :key="n" class="skeleton-row">
        <Skeleton width="40%" /><Skeleton width="15%" /><Skeleton width="15%" />
      </div>
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('catalog.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!services.length && filtered"
      class="card"
      compact
      icon="pi-search"
      :title="t('catalog.noMatches')"
    >
      <Button severity="secondary" :label="t('catalog.clearAll')" @click="clearFilters" />
    </EmptyState>
    <EmptyState
      v-else-if="!services.length"
      class="card"
      icon="pi-th-large"
      :title="t('catalog.noServices')"
      :body="categories.length ? t('catalog.noServicesHint') : t('catalog.categoryFirst')"
    >
      <Button
        v-if="canCreate && categories.length"
        icon="pi pi-plus"
        :label="t('catalog.newService')"
        @click="emit('create')"
      />
    </EmptyState>

    <DataTable
      v-else
      v-model:selection="selected"
      :value="services"
      data-key="id"
      :row-class="() => 'row-click'"
      @row-click="open($event.data, $event.originalEvent)"
    >
      <Column
        v-if="canUpdate"
        selection-mode="multiple"
        header-style="width: 44px"
        body-class="no-click"
      />
      <Column :header="t('catalog.columns.service')">
        <template #body="{ data }">
          <div class="name-cell">
            <span
              class="swatch"
              :style="{ background: data.color ?? 'var(--border-strong)' }"
              aria-hidden="true"
            />
            <span class="name">{{ data.display_name }}</span>
            <i
              v-if="missingName(data)"
              v-tooltip.top="t('catalog.nameMissing')"
              class="pi pi-language missing"
              :aria-label="t('catalog.nameMissing')"
            />
          </div>
        </template>
      </Column>
      <Column :header="t('catalog.category')">
        <template #body="{ data }">
          <span class="nowrap">{{ data.category?.display_name }}</span>
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
      <Column :header="t('catalog.columns.duration')" header-class="end" body-class="end">
        <template #body="{ data }">
          <span v-if="data.activity_type !== 'Open Access'" class="num nowrap">{{
            t('catalog.minShort', { n: data.default_duration })
          }}</span>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column :header="t('catalog.columns.capacity')" header-class="end" body-class="end">
        <template #body="{ data }">
          <span v-if="data.default_capacity" class="num">{{ data.default_capacity }}</span>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column v-if="!locationId" :header="t('catalog.columns.branches')">
        <template #body="{ data }"><BranchChips :names="branchNames(data)" /></template>
      </Column>
      <Column :header="t('catalog.columns.status')">
        <template #body="{ data }"><StatusTag :status="data.status" /></template>
      </Column>
    </DataTable>

    <ConfirmActionDialog
      v-model:visible="archiveOpen"
      :title="t('catalog.bulk.archiveTitle', selected.length)"
      :description="t('catalog.bulk.archiveBody')"
      :confirm-label="t('catalog.bulk.archive')"
      :loading="bulkBusy"
      destructive
      @confirm="bulk('archive')"
    />
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter {
  width: 160px;
}
.filter--status {
  width: 150px;
}
.option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.option i {
  color: var(--text-muted);
}
.more {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 260px;
}
.more__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: var(--text-small);
  font-weight: 500;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding-inline: 10px 6px;
  border-radius: 999px;
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  font: 500 12px/1 var(--font-sans);
}
.chip button {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chip i {
  font-size: 9px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.skeleton-row {
  display: flex;
  gap: 24px;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.name {
  font: 500 14px/1.4 var(--font-sans);
}
.missing {
  font-size: 12px;
  color: var(--sev-warn-fg);
}
.type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  color: var(--text-secondary);
}
.type i {
  font-size: 13px;
}
.nowrap {
  white-space: nowrap;
}
.muted {
  color: var(--text-muted);
}
</style>
