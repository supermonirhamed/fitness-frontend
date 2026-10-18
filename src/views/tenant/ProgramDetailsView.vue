<script setup lang="ts">
// Program page from the design (ServicesScreen.jsx ProgramDetails): header with enrollment and ages
// and a facts card, then the Academy (EP-10): levels, age groups, terms (term programs) and groups.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import AgeGroupsPanel from '@/components/academy/AgeGroupsPanel.vue'
import GroupFormDrawer from '@/components/academy/GroupFormDrawer.vue'
import GroupsTable from '@/components/academy/GroupsTable.vue'
import LevelsPanel from '@/components/academy/LevelsPanel.vue'
import TermsPanel from '@/components/academy/TermsPanel.vue'
import BranchChips from '@/components/patterns/BranchChips.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import ProgramFormDrawer from '@/components/services/ProgramFormDrawer.vue'
import {
  tenantApi,
  type AcademyGroup,
  type AcademyTerm,
  type Location,
  type Program,
  type ServiceCategory,
} from '@/api/tenant'
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
const academy = computed(() => auth.can('academy.view'))
const route = useRoute()
const router = useRouter()
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'overview')
watch(tab, (value) => router.replace({ query: { ...route.query, tab: value } }))

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

// Academy: terms feed the age-group check and the group form; groups list the program's.
const terms = ref<AcademyTerm[]>([])
const groups = ref<AcademyGroup[]>([])
const groupsState = ref<'loading' | 'ready' | 'error'>('loading')
async function loadTerms() {
  if (program.value?.enrollment_mode === 'Term')
    terms.value = await tenantApi.academy.terms.list(props.id).catch(() => [])
}
async function loadGroups() {
  groupsState.value = 'loading'
  try {
    groups.value = await tenantApi.academy.groups.list({ program_id: props.id })
    groupsState.value = 'ready'
  } catch {
    groupsState.value = 'error'
  }
}
watch(
  () => program.value?.id,
  (id) => {
    if (id && academy.value) {
      loadTerms()
      loadGroups()
    }
  },
)
function onTermsChanged() {
  loadTerms()
  loadGroups()
}
const groupOpen = ref(false)
function onGroupSaved(saved: AcademyGroup) {
  toast.add({
    severity: 'success',
    summary: t('academy.groups.saved', { name: saved.display_name }),
    life: 3000,
  })
  router.push({ name: 'tenant.academy.group', params: { id: saved.id } })
}

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

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="overview">{{ t('academy.tabs.overview') }}</Tab>
          <template v-if="academy">
            <Tab value="groups">{{ t('academy.tabs.groups') }}</Tab>
            <Tab value="levels">{{ t('academy.tabs.levels') }}</Tab>
            <Tab value="age-groups">{{ t('academy.tabs.ageGroups') }}</Tab>
            <Tab v-if="program.enrollment_mode === 'Term'" value="terms">{{
              t('academy.tabs.terms')
            }}</Tab>
          </template>
        </TabList>
        <TabPanels>
          <TabPanel value="overview">
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
          </TabPanel>
          <template v-if="academy">
            <TabPanel value="groups">
              <div class="card">
                <header class="card__head">
                  <div>
                    <h2>{{ t('academy.tabs.groups') }}</h2>
                    <p class="muted">{{ t('academy.groups.hint') }}</p>
                  </div>
                  <Button
                    v-if="auth.can('academy.create')"
                    :label="t('academy.groups.new')"
                    icon="pi pi-plus"
                    size="small"
                    @click="groupOpen = true"
                  />
                </header>
                <ErrorState v-if="groupsState === 'error'" compact @retry="loadGroups" />
                <EmptyState
                  v-else-if="groupsState === 'ready' && !groups.length"
                  compact
                  icon="pi-sitemap"
                  :title="t('academy.groups.none')"
                  :body="t('academy.groups.noneProgramHint')"
                />
                <GroupsTable v-else :groups="groups" :loading="groupsState === 'loading'" />
              </div>
            </TabPanel>
            <TabPanel value="levels"><LevelsPanel :program-id="program.id" /></TabPanel>
            <TabPanel value="age-groups">
              <AgeGroupsPanel :program-id="program.id" :terms="terms" />
            </TabPanel>
            <TabPanel v-if="program.enrollment_mode === 'Term'" value="terms">
              <TermsPanel :program-id="program.id" :terms="terms" @changed="onTermsChanged" />
            </TabPanel>
          </template>
        </TabPanels>
      </Tabs>
    </template>

    <GroupFormDrawer
      v-if="program"
      v-model:visible="groupOpen"
      :group="null"
      :programs="[program]"
      :program-id="program.id"
      @saved="onGroupSaved"
    />

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
.card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}
.card__head h2 {
  margin: 0;
  font-size: 1rem;
}
.card__head p {
  margin: 4px 0 0;
}
.muted {
  color: var(--text-secondary);
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
