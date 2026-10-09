<script setup lang="ts">
// Programs (US-02.09): term or rolling offerings clients enroll into.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ProgramFormDrawer from '@/components/services/ProgramFormDrawer.vue'
import {
  tenantApi,
  type Location,
  type Program,
  type ServiceCategory,
  type ServiceStatus,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

defineProps<{ categories: ServiceCategory[] }>()
const { t, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))
const canUpdate = computed(() => auth.can('services.update'))

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
  if (canCreate.value || canUpdate.value) {
    try {
      locations.value = await tenantApi.locations()
    } catch {
      locations.value = []
    }
  }
})

const day = (ymd: string) => format.date(`${ymd}T00:00:00Z`, 'UTC')
const enrollment = (p: Program) =>
  p.enrollment_mode === 'Term' && p.term_start && p.term_end
    ? `${t('programs.modes.Term')} · ${day(p.term_start)} – ${day(p.term_end)}`
    : t('programs.modes.Rolling')
const severity = (s: ServiceStatus) =>
  s === 'Published' ? 'success' : s === 'Draft' ? 'info' : 'secondary'

const drawerOpen = ref(false)
const editing = ref<Program | null>(null)
function open(program: Program | null = null) {
  editing.value = program
  drawerOpen.value = true
}
function onSaved(saved: Program, created: boolean) {
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
      <p class="note">{{ t('programs.intro') }}</p>
      <span class="spacer" />
      <Button
        v-if="canCreate"
        icon="pi pi-plus"
        :label="t('programs.new')"
        :disabled="!categories.length"
        @click="open()"
      />
    </div>
    <div v-if="state === 'loading'" class="stack">
      <Skeleton v-for="n in 3" :key="n" height="52px" />
    </div>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('catalog.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>
    <EmptyState
      v-else-if="!programs.length"
      icon="pi-sitemap"
      :title="t('programs.none')"
      :body="categories.length ? t('programs.noneHint') : t('catalog.categoryFirst')"
    >
      <Button
        v-if="canCreate && categories.length"
        icon="pi pi-plus"
        :label="t('programs.new')"
        @click="open()"
      />
    </EmptyState>
    <DataTable v-else :value="programs" data-key="id" size="small">
      <Column :header="t('programs.columns.program')">
        <template #body="{ data }">
          <div class="name">{{ data.display_name }}</div>
          <div class="sub">
            <i :class="['pi', data.category?.icon]" aria-hidden="true" />
            {{ data.category?.display_name }}
          </div>
        </template>
      </Column>
      <Column :header="t('programs.columns.enrollment')">
        <template #body="{ data }"
          ><span class="sub">{{ enrollment(data) }}</span></template
        >
      </Column>
      <Column :header="t('catalog.columns.branches')">
        <template #body="{ data }">
          <span class="sub">{{
            (data.locations ?? [])
              .map((l: { name: string }) => l.name)
              .join(locale === 'ar' ? '، ' : ', ')
          }}</span>
        </template>
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
    <ProgramFormDrawer
      v-model:visible="drawerOpen"
      :program="editing"
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
  gap: var(--space-4);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.name {
  font-weight: var(--fw-medium);
}
.sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
