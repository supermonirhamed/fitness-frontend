<script setup lang="ts">
// Conflict Center (US-03.07): upcoming sessions that became conflicted after a change (time off,
// a facility deactivated or made smaller, a closure, a coach deactivated or double-booked), each
// with its issues and quick actions: reassign coach or change facility (the edit drawer, with its
// live check), cancel. Follows the header branch switcher like the calendar.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ConflictList from '@/components/patterns/ConflictList.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import CancelSessionDialog from '@/components/schedule/CancelSessionDialog.vue'
import SessionDrawer from '@/components/schedule/SessionDrawer.vue'
import {
  tenantApi,
  type CalendarSession,
  type ConflictCenterItem,
  type SeriesUpdateResult,
} from '@/api/tenant'
import { zoneAbbreviation } from '@/lib/datetime'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

type Filter = 'all' | 'hard' | 'soft'

const COACH_CODES = [
  'coach_busy',
  'coach_time_off',
  'coach_time_off_pending',
  'coach_inactive',
  'outside_availability',
]
const FACILITY_CODES = ['facility_inactive', 'facility_busy', 'facility_blocked', 'over_capacity']
const DAYS = 90

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const auth = useStaffAuth()
const canCancel = computed(() => auth.can('schedule.delete'))
const allBranches = computed(
  () => !auth.currentLocation && (auth.user?.switchable_locations.length ?? 0) > 1,
)

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const items = ref<ConflictCenterItem[]>([])
const meta = ref({ sessions: 0, hard: 0, soft: 0, issues: 0 })
const filter = ref<Filter>('all')

async function load() {
  state.value = 'loading'
  try {
    const result = await tenantApi.sessions.conflicts(
      auth.currentLocation ? { location_id: auth.currentLocation.id } : {},
    )
    items.value = result.data
    meta.value = result.meta
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)
watch(() => auth.currentLocation?.id, load)

const isHard = (item: ConflictCenterItem) => item.issues.some((i) => i.level === 'hard')
const shown = computed(() =>
  items.value.filter(
    (item) => filter.value === 'all' || (filter.value === 'hard' ? isHard(item) : !isHard(item)),
  ),
)
const filterOptions = computed(() => [
  { value: 'all', label: t('conflictCenter.filters.all'), count: meta.value.sessions },
  { value: 'hard', label: t('conflictCenter.filters.hard'), count: meta.value.hard },
  { value: 'soft', label: t('conflictCenter.filters.soft'), count: meta.value.soft },
])
const has = (item: ConflictCenterItem, codes: string[]) =>
  item.issues.some((i) => codes.includes(i.code))

const when = (s: CalendarSession) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${s.local.date}T12:00:00Z`))
function openDay(s: CalendarSession) {
  router.push({ name: 'tenant.calendar', query: { view: 'day', date: s.local.date } })
}

// Quick actions
const drawerOpen = ref(false)
const editing = ref<CalendarSession | null>(null)
function edit(s: CalendarSession) {
  editing.value = s
  drawerOpen.value = true
}
function onUpdated(session: CalendarSession) {
  toast.add({
    severity: 'success',
    summary: t('session.updated', { name: session.service.name }),
    life: 4000,
  })
  load()
}
function onSeriesUpdated(result: SeriesUpdateResult) {
  toast.add({
    severity: 'success',
    summary: t('session.seriesUpdated'),
    detail: t('session.seriesUpdatedDetail', { ...result }),
    life: 5000,
  })
  load()
}
const cancelOpen = ref(false)
const cancelling = ref<CalendarSession | null>(null)
function askCancel(s: CalendarSession) {
  cancelling.value = s
  cancelOpen.value = true
}
function onCancelled(session: CalendarSession) {
  toast.add({
    severity: 'info',
    summary: t('session.cancel.done', { name: session.service.name }),
    life: 4000,
  })
  load()
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('conflictCenter.title')"
      :breadcrumb="[
        { label: t('calendar.title'), to: { name: 'tenant.calendar' } },
        { label: t('conflictCenter.title') },
      ]"
    >
      <template v-if="state === 'ready'" #meta>
        <span>{{ t('conflictCenter.window', { days: DAYS }) }}</span>
        <span v-if="meta.hard" class="meta--hard">{{
          t('conflictCenter.blocking', { n: meta.hard })
        }}</span>
        <span v-if="meta.soft" class="meta--soft">{{
          t('conflictCenter.warnings', { n: meta.soft })
        }}</span>
      </template>
      <template #actions>
        <Button
          icon="pi pi-refresh"
          :label="t('common.refresh')"
          severity="secondary"
          variant="outlined"
          :loading="state === 'loading'"
          @click="load"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <div
      v-else-if="state === 'loading' && !items.length"
      class="card list"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <div v-for="n in 3" :key="n" class="item">
        <Skeleton width="40%" /><Skeleton width="60%" /><Skeleton width="30%" />
      </div>
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('conflictCenter.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!items.length"
      class="card card--tall"
      icon="pi-check-circle"
      :title="t('conflictCenter.empty')"
      :body="t('conflictCenter.emptyHint')"
    />
    <template v-else>
      <SelectButton
        v-model="filter"
        :options="filterOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        class="filter"
        :aria-label="t('conflictCenter.title')"
      >
        <template #option="{ option }">
          {{ option.label }} <span class="count num">{{ option.count }}</span>
        </template>
      </SelectButton>

      <EmptyState
        v-if="!shown.length"
        class="card"
        compact
        icon="pi-filter"
        :title="t('conflictCenter.noMatch')"
      />
      <ul v-else class="card list">
        <li
          v-for="item in shown"
          :key="item.session.id"
          :class="['item', isHard(item) ? 'item--hard' : 'item--soft']"
        >
          <div class="item__head">
            <span
              class="swatch"
              :style="{ background: item.session.service.color ?? 'var(--svc-1)' }"
              aria-hidden="true"
            />
            <RouterLink
              class="item__title"
              :to="{ name: 'tenant.session', params: { id: item.session.id } }"
              >{{ item.session.service.name }}</RouterLink
            >
            <StatusTag :status="item.session.status" size="sm" />
          </div>
          <div class="item__meta">
            <span
              >{{ when(item.session) }} ·
              <span dir="ltr" class="num"
                >{{ item.session.local.start }}–{{ item.session.local.end }}</span
              >
              <span v-if="allBranches" class="zone" dir="ltr">{{
                zoneAbbreviation(item.session.location.timezone, locale)
              }}</span></span
            >
            <span v-if="allBranches"
              ><i class="pi pi-map-marker" aria-hidden="true" />{{
                item.session.location.name
              }}</span
            >
            <span
              ><i class="pi pi-building" aria-hidden="true" />{{ item.session.facility.name }}</span
            >
            <span v-if="item.session.coaches[0]"
              ><i class="pi pi-user" aria-hidden="true" />{{ item.session.coaches[0].name }}</span
            >
          </div>
          <ConflictList :items="item.issues" />
          <div class="item__actions">
            <Button
              v-if="has(item, COACH_CODES)"
              size="small"
              icon="pi pi-user-edit"
              :label="t('conflictCenter.reassignCoach')"
              @click="edit(item.session)"
            />
            <Button
              v-if="has(item, FACILITY_CODES)"
              size="small"
              icon="pi pi-building"
              :label="t('conflictCenter.changeFacility')"
              :severity="has(item, COACH_CODES) ? 'secondary' : undefined"
              :variant="has(item, COACH_CODES) ? 'outlined' : undefined"
              @click="edit(item.session)"
            />
            <Button
              v-if="!has(item, COACH_CODES) && !has(item, FACILITY_CODES)"
              size="small"
              icon="pi pi-pencil"
              :label="t('conflictCenter.editSession')"
              @click="edit(item.session)"
            />
            <Button
              size="small"
              icon="pi pi-calendar"
              :label="t('conflictCenter.openDay')"
              severity="secondary"
              variant="text"
              @click="openDay(item.session)"
            />
            <span class="spacer" />
            <Button
              v-if="canCancel"
              size="small"
              icon="pi pi-times-circle"
              :label="t('session.cancel.title')"
              severity="danger"
              variant="text"
              @click="askCancel(item.session)"
            />
          </div>
        </li>
      </ul>
    </template>

    <SessionDrawer
      v-model:visible="drawerOpen"
      :prefill="{}"
      :session="editing"
      @updated="onUpdated"
      @series-updated="onSeriesUpdated"
    />
    <CancelSessionDialog
      v-model:visible="cancelOpen"
      :session="cancelling"
      @cancelled="onCancelled"
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
.card--tall {
  padding: 40px 0;
}
.filter {
  align-self: flex-start;
}
.count {
  margin-inline-start: 6px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.meta--hard {
  color: var(--sev-danger-fg);
}
.meta--soft {
  color: var(--sev-warn-fg);
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
  border-inline-start: 3px solid transparent;
}
.item:last-child {
  border-bottom: 0;
}
.item--hard {
  border-inline-start-color: var(--sev-danger-fg);
}
.item--soft {
  border-inline-start-color: var(--sev-warn-fg);
}
.item__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item__title {
  font: 600 15px/1.4 var(--font-sans);
  color: var(--text-primary);
  text-decoration: none;
}
.item__title:hover {
  color: var(--text-link);
  text-decoration: underline;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.item__meta i {
  font-size: 12px;
  margin-inline-end: 6px;
}
.zone {
  margin-inline-start: 6px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.item__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.spacer {
  flex: 1;
}
</style>
