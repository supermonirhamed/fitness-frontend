<script setup lang="ts">
// A group's page (US-10.04): who it is for (program, level, age group, term, branch, facility,
// places), its coaches (US-10.05), and tabs for the roster, the training schedule, the attendance
// summary and the activity log. Players enroll with US-10.08; coach notes and announcements come
// with their own stories.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import GroupCoachesDialog from '@/components/academy/GroupCoachesDialog.vue'
import GroupFormDrawer from '@/components/academy/GroupFormDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyGroup,
  type AcademyGroupDetails,
  type AcademyTraining,
  type Program,
} from '@/api/tenant'
import { showDay } from '@/lib/academy'
import { actionKey } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const { t, te } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canUpdate = computed(() => auth.can('academy.update'))

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const group = ref<AcademyGroupDetails | null>(null)
async function load() {
  try {
    group.value = await tenantApi.academy.groups.get(props.id)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
const tab = ref('roster')

const head = computed(() => group.value?.coaches?.find((c) => c.role === 'head'))
const assistants = computed(() => group.value?.coaches?.filter((c) => c.role === 'assistant') ?? [])
const day = (ymd: string) => showDay(format, ymd)
const when = (s: AcademyTraining) =>
  `${format.date(s.starts_at)} · ${format.time(s.starts_at)}–${format.time(s.ends_at)}`
const actionLabel = (action: string) =>
  te(`audit.actions.${actionKey(action)}`) ? t(`audit.actions.${actionKey(action)}`) : action

// Editing needs the program with its branches.
const program = ref<Program | null>(null)
const editOpen = ref(false)
async function edit() {
  if (!program.value && group.value) {
    program.value = await tenantApi.programs.get(group.value.program_id).catch(() => null)
    if (!program.value) {
      toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
      return
    }
  }
  editOpen.value = true
}
function onSaved(saved: AcademyGroup) {
  toast.add({
    severity: 'success',
    summary: t('academy.groups.saved', { name: saved.display_name }),
    life: 3000,
  })
  load()
}
const coachesOpen = ref(false)
function onCoaches(_: AcademyGroup, updated: number) {
  toast.add({
    severity: 'success',
    summary: t('academy.coaches.saved', { n: updated }),
    life: 4000,
  })
  load()
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
      :title="t('academy.groups.notFound')"
    >
      <RouterLink :to="{ name: 'tenant.academy' }">{{ t('academy.title') }}</RouterLink>
    </EmptyState>
    <ErrorState v-else-if="state === 'error' || !group" class="card" @retry="load" />

    <template v-else>
      <PageHeader
        :title="group.display_name ?? ''"
        :breadcrumb="[
          { label: t('academy.title'), to: { name: 'tenant.academy' } },
          ...(auth.can('services.view')
            ? [
                {
                  label: group.program?.display_name ?? '',
                  to: {
                    name: 'tenant.programs.show',
                    params: { id: group.program_id },
                    query: { tab: 'groups' },
                  },
                },
              ]
            : []),
          { label: group.display_name ?? '' },
        ]"
      >
        <template #status><StatusTag :status="group.status" /></template>
        <template #meta>
          <span>{{ group.program?.display_name }}</span>
          <span>{{ group.location?.name }}</span>
          <span v-if="group.term">{{ group.term.display_name }}</span>
        </template>
        <template v-if="canUpdate" #primary>
          <Button :label="t('common.edit')" icon="pi pi-pencil" @click="edit" />
        </template>
      </PageHeader>

      <div class="cards">
        <div class="card facts">
          <span class="facts__label">{{ t('academy.groups.service') }}</span>
          <span>{{ group.service?.display_name }}</span>
          <span class="facts__label">{{ t('academy.groups.level') }}</span>
          <span>{{ group.level?.display_name ?? '—' }}</span>
          <span class="facts__label">{{ t('academy.groups.ageGroup') }}</span>
          <span>
            {{ group.age_group?.display_name ?? '—' }}
            <span v-if="group.age_group" class="muted" dir="ltr">
              ({{ group.age_group.min_age }}–{{ group.age_group.max_age }})
            </span>
          </span>
          <template v-if="group.term">
            <span class="facts__label">{{ t('academy.groups.term') }}</span>
            <span>{{ day(group.term.starts_on) }} – {{ day(group.term.ends_on) }}</span>
          </template>
          <span class="facts__label">{{ t('academy.groups.facility') }}</span>
          <span>{{ group.facility?.name ?? '—' }}</span>
          <span class="facts__label">{{ t('academy.groups.columns.places') }}</span>
          <span
            ><span dir="ltr">{{ group.enrolled }} / {{ group.capacity }}</span></span
          >
          <span class="facts__label">{{ t('catalog.genderLabel') }}</span>
          <span>{{ t(`catalog.gender.${group.gender}`) }}</span>
        </div>

        <div class="card coaches">
          <header>
            <h2>{{ t('academy.coaches.title') }}</h2>
            <Button
              v-if="canUpdate"
              :label="t('academy.coaches.change')"
              icon="pi pi-user-edit"
              size="small"
              variant="text"
              @click="coachesOpen = true"
            />
          </header>
          <div v-if="head" class="coach">
            <i class="pi pi-star-fill" aria-hidden="true" />
            <span>{{ head.name }}</span>
            <Tag :value="t('academy.coaches.headTag')" severity="info" />
          </div>
          <div v-for="c in assistants" :key="c.id" class="coach">
            <i class="pi pi-user" aria-hidden="true" />
            <span>{{ c.name }}</span>
            <span class="muted small">{{ t('academy.coaches.assistantTag') }}</span>
          </div>
        </div>
      </div>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="roster">{{ t('academy.groups.tabs.roster') }}</Tab>
          <Tab value="schedule">{{ t('academy.groups.tabs.schedule') }}</Tab>
          <Tab value="attendance">{{ t('academy.groups.tabs.attendance') }}</Tab>
          <Tab value="activity">{{ t('academy.groups.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="roster">
            <EmptyState
              class="card"
              compact
              icon="pi-users"
              :title="t('academy.groups.noPlayers')"
              :body="t('academy.groups.noPlayersHint')"
            />
          </TabPanel>
          <TabPanel value="schedule">
            <EmptyState
              v-if="!group.upcoming.length && !group.recent.length"
              class="card"
              compact
              icon="pi-calendar"
              :title="t('academy.groups.noTrainings')"
              :body="t('academy.groups.noTrainingsHint')"
            />
            <div v-else class="card list">
              <h3 v-if="group.upcoming.length">{{ t('academy.groups.upcoming') }}</h3>
              <RouterLink
                v-for="s in group.upcoming"
                :key="s.id"
                :to="{ name: 'tenant.session', params: { id: s.id } }"
                class="training"
              >
                <span class="num">{{ when(s) }}</span>
                <span class="muted">{{ s.facility }} · {{ s.coaches.join('، ') }}</span>
                <StatusTag :status="s.status" size="sm" />
              </RouterLink>
              <h3 v-if="group.recent.length">{{ t('academy.groups.recent') }}</h3>
              <RouterLink
                v-for="s in group.recent"
                :key="s.id"
                :to="{ name: 'tenant.session', params: { id: s.id } }"
                class="training"
              >
                <span class="num">{{ when(s) }}</span>
                <span class="muted">{{ s.facility }} · {{ s.coaches.join('، ') }}</span>
                <StatusTag :status="s.status" size="sm" />
              </RouterLink>
            </div>
          </TabPanel>
          <TabPanel value="attendance">
            <div class="tiles">
              <div class="card tile">
                <span class="tile__value">{{
                  group.attendance.rate === null ? '—' : `${group.attendance.rate}%`
                }}</span>
                <span class="muted">{{ t('academy.groups.rate') }}</span>
              </div>
              <div class="card tile">
                <span class="tile__value">{{ group.attendance.trainings }}</span>
                <span class="muted">{{ t('academy.groups.held') }}</span>
              </div>
              <div class="card tile">
                <span class="tile__value">{{ group.attendance.upcoming }}</span>
                <span class="muted">{{ t('academy.groups.upcoming') }}</span>
              </div>
              <div class="card tile">
                <span class="tile__value">{{ group.attendance.attended }}</span>
                <span class="muted">{{ t('academy.groups.attended') }}</span>
              </div>
              <div class="card tile">
                <span class="tile__value">{{ group.attendance.no_shows }}</span>
                <span class="muted">{{ t('academy.groups.noShows') }}</span>
              </div>
            </div>
          </TabPanel>
          <TabPanel value="activity">
            <EmptyState
              v-if="!group.activity.length"
              class="card"
              compact
              icon="pi-history"
              :title="t('details.noActivity')"
            />
            <ol v-else class="card timeline">
              <li v-for="(entry, i) in group.activity" :key="i">
                <div class="title">{{ actionLabel(entry.action) }}</div>
                <div class="muted small">
                  {{ entry.at ? format.dateTime(entry.at) : '' }} ·
                  {{ entry.user ?? t('details.system') }}
                </div>
              </li>
            </ol>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <GroupFormDrawer
      v-if="group && program"
      v-model:visible="editOpen"
      :group="group"
      :programs="[program]"
      :program-id="group.program_id"
      @saved="onSaved"
    />
    <GroupCoachesDialog
      v-if="group"
      v-model:visible="coachesOpen"
      :group="group"
      @saved="onCoaches"
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
.cards {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}
.facts {
  padding: 20px;
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px 20px;
  align-items: center;
}
.facts__label {
  color: var(--text-secondary);
}
.coaches {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.coaches header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.coaches h2 {
  margin: 0;
  font-size: 1rem;
}
.coach {
  display: flex;
  align-items: center;
  gap: 8px;
}
.list {
  padding: 8px 20px 16px;
  display: flex;
  flex-direction: column;
}
.list h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 12px 0 4px;
}
.training {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-default);
  color: inherit;
  text-decoration: none;
}
.training .muted {
  flex: 1;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tile__value {
  font-size: 1.5rem;
  font-weight: 700;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 8px 20px;
}
.timeline li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-default);
}
.timeline li:last-child {
  border-bottom: 0;
}
.title {
  font-weight: 600;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
.num {
  font-variant-numeric: tabular-nums;
}
@media (max-width: 760px) {
  .cards {
    grid-template-columns: 1fr;
  }
  .facts {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
