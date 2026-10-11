<script setup lang="ts">
// Program page from the design (ServicesScreen.jsx ProgramDetails): header with enrollment and ages,
// the Academy note, and a facts card. Levels and groups come with the Academy module.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import BranchChips from '@/components/patterns/BranchChips.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import ProgramFormDrawer from '@/components/services/ProgramFormDrawer.vue'
import { tenantApi, type Location, type Program, type ServiceCategory } from '@/api/tenant'
import { programEnrollment } from '@/lib/catalog'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canUpdate = computed(() => auth.can('services.update'))

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const program = ref<Program | null>(null)
const categories = ref<ServiceCategory[]>([])
const locations = ref<Location[]>([])

async function load() {
  state.value = 'loading'
  try {
    program.value = await tenantApi.programs.get(props.id)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)

const ages = computed(() => {
  const p = program.value
  if (!p || (p.age_min === null && p.age_max === null)) return null
  return `${p.age_min ?? 0}–${p.age_max ?? '+'}`
})

const editOpen = ref(false)
async function edit() {
  if (!categories.value.length) {
    try {
      ;[categories.value, locations.value] = await Promise.all([
        tenantApi.serviceCategories.list(),
        tenantApi.locations(),
      ])
    } catch {
      toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
      return
    }
  }
  editOpen.value = true
}
function onSaved(saved: Program) {
  program.value = saved
  toast.add({
    severity: 'success',
    summary: t('catalog.serviceSaved', { name: saved.display_name }),
    life: 3000,
  })
}
</script>

<template>
  <div class="page">
    <div
      v-if="state === 'loading'"
      class="card pad"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton width="30%" height="28px" /><Skeleton width="50%" />
    </div>
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-search"
      :title="t('programs.notFound')"
    >
      <RouterLink :to="{ name: 'tenant.services', query: { tab: 'programs' } }">{{
        t('catalog.title')
      }}</RouterLink>
    </EmptyState>
    <ErrorState v-else-if="state === 'error' || !program" class="card" @retry="load" />

    <template v-else>
      <PageHeader
        :title="program.display_name ?? ''"
        :breadcrumb="[
          {
            label: t('catalog.title'),
            to: { name: 'tenant.services', query: { tab: 'programs' } },
          },
          { label: program.display_name ?? '' },
        ]"
      >
        <template #status><StatusTag :status="program.status" /></template>
        <template #meta>
          <span>{{ programEnrollment(program, t, format) }}</span>
          <span v-if="ages" dir="ltr">{{ t('programs.agesValue', { ages }) }}</span>
        </template>
        <template v-if="canUpdate" #primary>
          <Button :label="t('common.edit')" icon="pi pi-pencil" @click="edit" />
        </template>
      </PageHeader>

      <Message severity="info" icon="pi pi-sitemap" :closable="false">
        <strong>{{ t('programs.academyTitle') }}</strong>
        <div>{{ t('programs.academyNote') }}</div>
      </Message>

      <div class="card facts">
        <span class="facts__label">{{ t('catalog.columns.branches') }}</span>
        <BranchChips :names="(program.locations ?? []).map((l) => l.name)" :max="4" />
        <span class="facts__label">{{ t('catalog.genderLabel') }}</span>
        <span>{{ t(`catalog.gender.${program.gender}`) }}</span>
        <span class="facts__label">{{ t('programs.category') }}</span>
        <span class="facts__category">
          <i
            :class="['pi', program.category?.icon]"
            :style="{ color: program.category?.color }"
            aria-hidden="true"
          />{{ program.category?.display_name }}
        </span>
        <template v-if="program.description?.ar || program.description?.en">
          <span class="facts__label">{{ t('catalog.description') }}</span>
          <span>{{ program.description?.ar || program.description?.en }}</span>
        </template>
      </div>
    </template>

    <ProgramFormDrawer
      v-if="program"
      v-model:visible="editOpen"
      :program="program"
      :categories="categories"
      :locations="locations"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.facts {
  padding: 20px;
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px 24px;
  align-items: center;
}
.facts__label {
  color: var(--text-secondary);
}
.facts__category {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 560px) {
  .facts {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .facts__label:not(:first-child) {
    margin-top: 8px;
  }
}
</style>
