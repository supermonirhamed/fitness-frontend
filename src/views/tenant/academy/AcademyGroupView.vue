<script setup lang="ts">
// A group's page (US-10.04): who it is for (program, level, age group, term, branch, facility,
// places), its coaches (US-10.05), and tabs for the roster (enroll, pause, withdraw, transfer —
// US-10.08–10.13), the training schedule (US-10.06), the waiting list (US-10.11), trials
// (US-10.15), the attendance summary and the activity log. Coach notes and announcements come with
// their own stories.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import AddTrainingDialog from '@/components/academy/AddTrainingDialog.vue'
import EnrollmentDrawer from '@/components/academy/EnrollmentDrawer.vue'
import EnrollPlayerDrawer from '@/components/academy/EnrollPlayerDrawer.vue'
import GroupCoachesDialog from '@/components/academy/GroupCoachesDialog.vue'
import GroupFormDrawer from '@/components/academy/GroupFormDrawer.vue'
import GroupRosterPanel from '@/components/academy/GroupRosterPanel.vue'
import GroupScheduleDrawer from '@/components/academy/GroupScheduleDrawer.vue'
import GroupTrialsPanel from '@/components/academy/GroupTrialsPanel.vue'
import GroupWaitlistPanel from '@/components/academy/GroupWaitlistPanel.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyEnrollResult,
  type AcademyGroup,
  type AcademyGroupDetails,
  type AcademyTraining,
  type AcademyWaitlistEntry,
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
const route = useRoute()
const canUpdate = computed(() => auth.can('academy.update'))
const canEnroll = computed(() => auth.can('academy.enroll'))

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
onMounted(async () => {
  await load()
  // From the recommendations list: open that player's enrollment.
  const id = Number(route.query.enrollment)
  if (id) openEnrollment(id)
})
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'roster')

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
// Players (US-10.08–10.13).
const enrollOpen = ref(false)
const fromWaitlist = ref<{ entryId: number; client: { id: number; name: string } } | null>(null)
const lastResult = ref<AcademyEnrollResult | null>(null)
function enroll(entry: AcademyWaitlistEntry | null = null) {
  fromWaitlist.value = entry?.client
    ? { entryId: entry.id, client: { id: entry.client.id, name: entry.client.name } }
    : null
  enrollOpen.value = true
}
function onEnrolled(result: AcademyEnrollResult) {
  lastResult.value = result
  toast.add({
    severity: 'success',
    summary: t('academy.enroll.done', { name: result.enrollment.client?.name, n: result.booked }),
    life: 4000,
  })
  waitlistPanel.value?.load()
  load()
}
const dueInvoices = computed(() =>
  (lastResult.value?.invoices ?? []).filter(
    (i) => i.status === 'Due' || i.status === 'PartiallyPaid',
  ),
)
const enrollmentId = ref<number | null>(null)
const enrollmentOpen = ref(false)
function openEnrollment(id: number) {
  enrollmentId.value = id
  enrollmentOpen.value = true
}
const waitlistPanel = ref<InstanceType<typeof GroupWaitlistPanel> | null>(null)
function toWaitlist() {
  enrollOpen.value = false
  tab.value = 'waitlist'
}
// Schedule (US-10.06).
const scheduleOpen = ref(false)
const addOpen = ref(false)
function onScheduled(n: number) {
  toast.add({ severity: 'success', summary: t('academy.schedule.created', { n }), life: 4000 })
  load()
}
function onTrainingAdded() {
  toast.add({ severity: 'success', summary: t('academy.schedule.added'), life: 3000 })
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
        <template v-if="canEnroll && group.status !== 'Archived'" #primary>
          <Button :label="t('academy.enroll.title')" icon="pi pi-user-plus" @click="enroll()" />
        </template>
        <template v-if="canUpdate" #actions>
          <Button
            :label="t('common.edit')"
            icon="pi pi-pencil"
            severity="secondary"
            @click="edit"
          />
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
          <span>
            <span dir="ltr">{{ group.enrolled }} / {{ group.capacity }}</span>
            <span v-if="group.held" class="muted small">
              · {{ t('academy.groups.heldPlaces', { n: group.held }) }}</span
            >
            <span v-if="group.waiting" class="muted small">
              · {{ t('academy.groups.waiting', { n: group.waiting }) }}</span
            >
          </span>
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
          <Tab value="waitlist"
            >{{ t('academy.groups.tabs.waitlist')
            }}<span v-if="group.waiting" class="count">{{ group.waiting }}</span></Tab
          >
          <Tab value="trials">{{ t('academy.groups.tabs.trials') }}</Tab>
          <Tab value="attendance">{{ t('academy.groups.tabs.attendance') }}</Tab>
          <Tab value="activity">{{ t('academy.groups.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="roster">
            <Message v-if="dueInvoices.length" severity="info" :closable="false" class="due">
              {{ t('academy.enroll.invoicesDue', { n: dueInvoices.length }) }}
              <RouterLink
                v-if="auth.can('payments.create')"
                :to="{
                  name: 'tenant.client',
                  params: { id: dueInvoices[0]?.client_id ?? 0 },
                  query: { tab: 'payments' },
                }"
                >{{ t('academy.roster.takePayment') }}</RouterLink
              >
            </Message>
            <Message
              v-if="group.pending_recommendations && canEnroll"
              severity="warn"
              :closable="false"
              class="due"
            >
              {{ t('academy.transfer.pending', { n: group.pending_recommendations }) }}
            </Message>
            <GroupRosterPanel
              :roster="group.roster"
              :can-enroll="canEnroll && group.status !== 'Archived'"
              @open="openEnrollment"
              @enroll="enroll()"
            />
          </TabPanel>
          <TabPanel value="schedule">
            <div v-if="canUpdate && group.status !== 'Archived'" class="schedule-actions">
              <Button
                :label="t('academy.schedule.title')"
                icon="pi pi-calendar"
                size="small"
                @click="scheduleOpen = true"
              />
              <Button
                :label="t('academy.schedule.addTitle')"
                icon="pi pi-calendar-plus"
                size="small"
                severity="secondary"
                @click="addOpen = true"
              />
            </div>
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
          <TabPanel value="waitlist">
            <GroupWaitlistPanel
              ref="waitlistPanel"
              :group="group"
              @enroll="enroll"
              @changed="load"
            />
          </TabPanel>
          <TabPanel value="trials">
            <GroupTrialsPanel :group="group" @changed="load" />
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
    <EnrollPlayerDrawer
      v-if="group"
      v-model:visible="enrollOpen"
      :group="group"
      :from-waitlist="fromWaitlist"
      @saved="onEnrolled"
      @waitlist="toWaitlist"
    />
    <EnrollmentDrawer
      v-if="group"
      v-model:visible="enrollmentOpen"
      :enrollment-id="enrollmentId"
      :group="group"
      @changed="load"
    />
    <GroupScheduleDrawer
      v-if="group"
      v-model:visible="scheduleOpen"
      :group="group"
      @saved="onScheduled"
    />
    <AddTrainingDialog
      v-if="group"
      v-model:visible="addOpen"
      :group="group"
      @saved="onTrainingAdded"
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
.due {
  margin-bottom: 12px;
}
.schedule-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.count {
  margin-inline-start: 6px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 0.75rem;
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
