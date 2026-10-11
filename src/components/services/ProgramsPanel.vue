<script setup lang="ts">
// Programs (US-02.09): term or rolling offerings clients enroll into. Table as in the design
// (ServicesScreen.jsx programs tab): whole-row click opens the program.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import BranchChips from '@/components/patterns/BranchChips.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import ProgramFormDrawer from '@/components/services/ProgramFormDrawer.vue'
import { tenantApi, type Location, type Program, type ServiceCategory } from '@/api/tenant'
import { programEnrollment } from '@/lib/catalog'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

defineProps<{ categories: ServiceCategory[] }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const format = useFormat()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const programs = ref<Program[]>([])
const locations = ref<Location[]>([])

async function load() {
  state.value = 'loading'
  try {
    programs.value = await tenantApi.programs.list()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  load()
  if (canCreate.value) {
    try {
      locations.value = await tenantApi.locations()
    } catch {
      locations.value = []
    }
  }
})

const enrollment = (p: Program) => programEnrollment(p, t, format)
const ages = (p: Program) =>
  p.age_min === null && p.age_max === null ? '—' : `${p.age_min ?? 0}–${p.age_max ?? '+'}`
const branchNames = (p: Program) => (p.locations ?? []).map((l) => l.name)
const open = (p: Program) => router.push({ name: 'tenant.programs.show', params: { id: p.id } })

const drawerOpen = ref(false)
function create() {
  drawerOpen.value = true
}
defineExpose({ create })
function onSaved(saved: Program) {
  toast.add({
    severity: 'success',
    summary: t('catalog.serviceCreated', { name: saved.display_name }),
    life: 3000,
  })
  load()
  emit('changed')
}
</script>
<template>
  <div class="panel">
    <div v-if="canCreate" class="toolbar">
      <Button
        icon="pi pi-plus"
        :label="t('programs.new')"
        severity="secondary"
        :disabled="!categories.length"
        @click="create"
      />
    </div>
    <div v-if="state === 'loading'" class="card" aria-busy="true" :aria-label="t('common.loading')">
      <div v-for="n in 3" :key="n" class="skeleton-row">
        <Skeleton width="40%" /><Skeleton width="20%" />
      </div>
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('catalog.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!programs.length"
      class="card"
      icon="pi-sitemap"
      :title="t('programs.none')"
      :body="categories.length ? t('programs.noneHint') : t('catalog.categoryFirst')"
    >
      <Button
        v-if="canCreate && categories.length"
        icon="pi pi-plus"
        :label="t('programs.new')"
        @click="create"
      />
    </EmptyState>
    <DataTable
      v-else
      :value="programs"
      data-key="id"
      :row-class="() => 'row-click'"
      @row-click="open($event.data)"
    >
      <Column :header="t('programs.columns.program')">
        <template #body="{ data }">
          <div class="name-cell">
            <span
              class="swatch"
              :style="{ background: data.category?.color ?? 'var(--border-strong)' }"
              aria-hidden="true"
            />
            <span class="name">{{ data.display_name }}</span>
          </div>
        </template>
      </Column>
      <Column :header="t('programs.columns.enrollment')">
        <template #body="{ data }">{{ enrollment(data) }}</template>
      </Column>
      <Column :header="t('programs.columns.ages')">
        <template #body="{ data }"
          ><span class="num" dir="ltr">{{ ages(data) }}</span></template
        >
      </Column>
      <Column :header="t('catalog.columns.branches')">
        <template #body="{ data }"><BranchChips :names="branchNames(data)" /></template>
      </Column>
      <Column :header="t('catalog.columns.status')">
        <template #body="{ data }"><StatusTag :status="data.status" /></template>
      </Column>
      <Column header-class="row-end" body-class="row-end">
        <template #body
          ><i class="pi pi-chevron-right pi-dir row-chevron" aria-hidden="true"
        /></template>
      </Column>
    </DataTable>
    <ProgramFormDrawer
      v-model:visible="drawerOpen"
      :program="null"
      :categories="categories"
      :locations="locations"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: flex-end;
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
  font: 500 14px var(--font-sans);
}
</style>
