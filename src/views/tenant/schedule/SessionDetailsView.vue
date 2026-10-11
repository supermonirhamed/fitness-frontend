<script setup lang="ts">
// Session details (US-03.08), as the design's SessionScreen (ui_kits/admin/SessionScreen.jsx): the
// header with time, facility, coach and capacity; actions by permission (edit, substitute coach,
// duplicate, cancel; add booking, check-in and messages come with EP-04/08/12); tabs for roster,
// waitlist, attendance, details and activity.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import type { MenuItem } from 'primevue/menuitem'
import CapacityIndicator from '@/components/patterns/CapacityIndicator.vue'
import ConflictList from '@/components/patterns/ConflictList.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusBanner from '@/components/patterns/StatusBanner.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import CancelSessionDialog from '@/components/schedule/CancelSessionDialog.vue'
import SessionDrawer, { type SessionPrefill } from '@/components/schedule/SessionDrawer.vue'
import {
  tenantApi,
  type CalendarSession,
  type SeriesUpdateResult,
  type SessionDetails,
} from '@/api/tenant'
import { addDays } from '@/lib/calendar'
import { DAY_KEYS } from '@/lib/businessHours'
import { zoneAbbreviation } from '@/lib/datetime'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const route = useRoute()
const { t, te, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const org = useOrganization()

const state = ref<'loading' | 'ready' | 'missing' | 'forbidden' | 'error'>('loading')
const session = ref<SessionDetails | null>(null)
const tab = ref('roster')

async function load() {
  state.value = 'loading'
  try {
    session.value = await tenantApi.sessions.get(Number(route.params.id))
    state.value = 'ready'
  } catch (e) {
    const status = statusOf(e)
    state.value = status === 404 ? 'missing' : status === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)
watch(() => route.params.id, load)

const mine = computed(() => session.value?.coaches.some((c) => c.id === auth.user?.id) ?? false)
const ownOnly = computed(() => auth.user?.scope === 'own')
const canEdit = computed(
  () =>
    !!session.value &&
    !session.value.locked &&
    auth.can('schedule.update') &&
    (!ownOnly.value || mine.value),
)
const canCancel = computed(
  () =>
    !!session.value &&
    !session.value.locked &&
    auth.can('schedule.delete') &&
    (!ownOnly.value || mine.value),
)
const canCreate = computed(() => auth.can('schedule.create'))
const cancelled = computed(() => session.value?.status === 'Cancelled')

const dayLabel = (ymd: string) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${ymd}T12:00:00Z`))

const seriesLine = computed(() => {
  const s = session.value?.series
  if (!s)
    return session.value?.event
      ? t('event.partOf', { n: session.value.event.days })
      : t('sessionPage.oneTime')
  const start = org.organization?.week_start ?? 6
  const days = Array.from({ length: 7 }, (_, i) => (start + i) % 7)
    .filter((d) => s.weekdays.includes(d))
    .map((d) => t(`session.days.${DAY_KEYS[d]}`))
    .join(locale.value === 'ar' ? '، ' : ', ')
  return [
    days,
    s.start_time,
    s.every_weeks > 1 ? t('sessionPage.everyWeeks', { n: s.every_weeks }) : null,
    s.rolling
      ? t('session.editScope.noEnd')
      : s.ends_on
        ? t('session.editScope.until', { date: dayLabel(s.ends_on) })
        : null,
  ]
    .filter(Boolean)
    .join(' · ')
})

const actionLabel = (action: string) => {
  const key = `sessionPage.actions.${action.replace('.', '_')}`
  return te(key) ? t(key) : action
}
const actionIcon = (action: string) =>
  action.endsWith('created')
    ? 'pi-plus'
    : action.endsWith('cancelled')
      ? 'pi-times-circle'
      : 'pi-pencil'
const reasonLabel = (reason: string) => {
  const [code, ...note] = reason.split(': ')
  const label = te(`session.cancel.reasons.${code}`) ? t(`session.cancel.reasons.${code}`) : code
  return [label, ...note].join(': ')
}

// Edit, substitute coach (the edit drawer), duplicate (a new session prefilled a week later).
const drawerOpen = ref(false)
const editing = ref<CalendarSession | null>(null)
const prefill = ref<SessionPrefill>({})
function edit() {
  if (!session.value) return
  editing.value = session.value
  drawerOpen.value = true
}
function duplicate() {
  const s = session.value
  if (!s) return
  editing.value = null
  prefill.value = {
    serviceId: s.service.id,
    locationId: s.location.id,
    facilityId: s.facility.id,
    coachId: s.coaches[0]?.id ?? null,
    assistantIds: s.coaches.slice(1).map((c) => c.id),
    date: addDays(s.local.date, 7),
    start: s.local.start,
    duration: Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000),
    capacity: s.capacity ?? undefined,
  }
  drawerOpen.value = true
}
function onUpdated(updated: CalendarSession) {
  toast.add({
    severity: 'success',
    summary: t('session.updated', { name: updated.service.name }),
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
function onCreated(created: CalendarSession) {
  toast.add({
    severity: 'success',
    summary: t('session.created', { name: created.service.name }),
    life: 5000,
  })
}
const cancelOpen = ref(false)
function onCancelled(result: { cancelled: number; name: string | null }) {
  toast.add({
    severity: 'info',
    summary:
      result.cancelled === 1 && result.name
        ? t('session.cancel.done', { name: result.name })
        : t('session.cancel.doneMany', result.cancelled),
    life: 4000,
  })
  load()
}

async function publishSeries() {
  const s = session.value
  if (!s?.series) return
  try {
    const result = await tenantApi.sessions.setStatus({
      series_id: s.series.id,
      status: 'Published',
    })
    toast.add({
      severity: 'success',
      summary: t('calendar.bulk.published', result.changed),
      life: 4000,
    })
    load()
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  }
}

const moreItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  if (canEdit.value)
    items.push({ label: t('sessionPage.substitute'), icon: 'pi pi-user-edit', command: edit })
  if (canCreate.value)
    items.push({ label: t('sessionPage.duplicate'), icon: 'pi pi-copy', command: duplicate })
  // A draft series is released at once (US-03.11).
  if (canEdit.value && session.value?.series && session.value.status === 'Draft')
    items.push({
      label: t('sessionPage.publishSeries'),
      icon: 'pi pi-send',
      command: publishSeries,
    })
  items.push({
    label: `${t('sessionPage.message')} · ${t('sessionPage.later')}`,
    icon: 'pi pi-send',
    disabled: true,
  })
  if (canCancel.value)
    items.push(
      { separator: true },
      {
        label: t('session.cancel.title'),
        icon: 'pi pi-times-circle',
        class: 'menu-danger',
        command: () => (cancelOpen.value = true),
      },
    )
  return items
})
</script>

<template>
  <div class="page">
    <div
      v-if="state === 'loading' && !session"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="20px" width="20%" />
      <Skeleton height="32px" width="40%" />
      <Skeleton height="200px" />
    </div>
    <NoPermission v-else-if="state === 'forbidden'" class="panel" />
    <EmptyState
      v-else-if="state === 'missing'"
      class="panel"
      icon="pi-search"
      :title="t('sessionPage.missing')"
      :body="t('sessionPage.missingHint')"
    >
      <RouterLink :to="{ name: 'tenant.calendar' }">{{ t('calendar.title') }}</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="state === 'error' || !session"
      class="panel"
      :title="t('sessionPage.loadError')"
      @retry="load"
    />

    <template v-else>
      <PageHeader
        :title="session.service.name ?? ''"
        :breadcrumb="[
          {
            label: t('calendar.title'),
            to: { name: 'tenant.calendar', query: { view: 'day', date: session.local.date } },
          },
          { label: session.service.name ?? '' },
        ]"
        :more-items="moreItems"
      >
        <template #leading>
          <span
            class="title-swatch"
            :style="{ background: session.service.color ?? 'var(--svc-1)' }"
            aria-hidden="true"
          />
        </template>
        <template #status>
          <StatusTag :status="session.status" />
        </template>
        <template #meta>
          <span
            >{{ dayLabel(session.local.date) }} ·
            <span dir="ltr" class="num"
              >{{ session.local.start }}–{{ session.local.end }}
              {{ zoneAbbreviation(session.location.timezone, locale) }}</span
            ></span
          >
          <span><i class="pi pi-building" aria-hidden="true" />{{ session.facility.name }}</span>
          <span v-if="session.coaches[0]"
            ><i class="pi pi-user" aria-hidden="true" />{{ session.coaches[0].name }}</span
          >
          <span v-if="session.event"
            ><i class="pi pi-star" aria-hidden="true" />{{
              t('event.partOf', { n: session.event.days })
            }}</span
          >
          <span v-if="session.series"
            ><i class="pi pi-replay" aria-hidden="true" />{{
              session.exception ? t('session.exception') : t('calendar.inSeries')
            }}</span
          >
        </template>
        <template #actions>
          <CapacityIndicator
            class="capacity"
            :booked="session.booked"
            :capacity="session.capacity"
            :waitlist="session.waitlist"
            :cancelled="cancelled"
          />
          <Button
            v-tooltip.bottom="t('sessionPage.later')"
            icon="pi pi-qrcode"
            :label="t('sessionPage.checkIn')"
            severity="secondary"
            variant="outlined"
            disabled
          />
          <Button
            v-if="canEdit"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            severity="secondary"
            variant="outlined"
            @click="edit"
          />
        </template>
        <template #primary>
          <span v-tooltip.bottom="t('sessionPage.bookingsLater')">
            <Button icon="pi pi-plus" :label="t('sessionPage.addBooking')" disabled />
          </span>
        </template>
      </PageHeader>

      <StatusBanner
        v-if="cancelled"
        severity="secondary"
        icon="pi-times-circle"
        :title="t('sessionPage.cancelledTitle')"
      >
        {{ t('sessionPage.cancelledBody') }}
      </StatusBanner>
      <StatusBanner
        v-else-if="session.status === 'Completed'"
        severity="secondary"
        icon="pi-lock"
        :title="t('calendar.pastReadOnly')"
      />
      <div v-if="session.issues.length" class="panel issues">
        <span class="issues__title">{{ t('sessionPage.issuesTitle') }}</span>
        <ConflictList :items="session.issues" />
      </div>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="roster"
            >{{ t('sessionPage.tabs.roster') }}
            <span class="tab-count">{{ session.roster.length }}</span></Tab
          >
          <Tab value="waitlist"
            >{{ t('sessionPage.tabs.waitlist') }}
            <span class="tab-count">{{ session.waitlist_entries.length }}</span></Tab
          >
          <Tab value="attendance">{{ t('sessionPage.tabs.attendance') }}</Tab>
          <Tab value="details">{{ t('sessionPage.tabs.details') }}</Tab>
          <Tab value="activity">{{ t('sessionPage.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="roster">
            <EmptyState
              class="panel"
              icon="pi-users"
              :title="t('sessionPage.noRoster')"
              :body="t('sessionPage.noRosterHint')"
            />
          </TabPanel>
          <TabPanel value="waitlist">
            <EmptyState
              class="panel"
              icon="pi-list"
              :title="t('sessionPage.noWaitlist')"
              :body="t('sessionPage.noWaitlistHint')"
            />
          </TabPanel>
          <TabPanel value="attendance">
            <EmptyState
              class="panel"
              icon="pi-check-square"
              :title="t('sessionPage.attendanceSoon')"
              :body="t('sessionPage.attendanceHint')"
            />
          </TabPanel>
          <TabPanel value="details">
            <dl class="panel facts">
              <dt>{{ t('sessionPage.series') }}</dt>
              <dd>{{ seriesLine }}</dd>
              <template v-if="session.event">
                <dt>{{ t('event.registration') }}</dt>
                <dd>
                  {{
                    t('event.registrationWindow', {
                      from: session.event.registration_opens_on
                        ? dayLabel(session.event.registration_opens_on)
                        : t('event.rightAway'),
                      to: session.event.registration_closes_on
                        ? dayLabel(session.event.registration_closes_on)
                        : t('event.untilStart'),
                    })
                  }}
                  ·
                  {{
                    t('event.registered', {
                      n: session.event.registered,
                      capacity: session.event.capacity,
                    })
                  }}
                </dd>
              </template>
              <dt>{{ t('session.branch') }}</dt>
              <dd>{{ session.location.name }}</dd>
              <dt>{{ t('sessionPage.coaches') }}</dt>
              <dd class="people">
                <span v-for="(c, i) in session.coaches" :key="c.id" class="person">
                  <PersonAvatar :name="c.name" size="sm" />{{ c.name }}
                  <small v-if="i === 0" class="muted">{{ t('sessionPage.lead') }}</small>
                </span>
              </dd>
              <dt>{{ t('sessionPage.bookingWindow') }}</dt>
              <dd>
                {{
                  t('sessionPage.bookingWindowValue', {
                    days: session.policy.booking_opens_days,
                    minutes: session.policy.booking_closes_minutes,
                  })
                }}
              </dd>
              <dt>{{ t('sessionPage.freeCancel') }}</dt>
              <dd>
                {{
                  t('sessionPage.freeCancelValue', {
                    hours: session.policy.cancellation_window_hours,
                  })
                }}
              </dd>
              <dt>{{ t('sessionPage.waitlistRule') }}</dt>
              <dd>
                {{
                  session.policy.waitlist_mode === 'automatic'
                    ? t('sessionPage.waitlistAutomatic', {
                        minutes: session.policy.waitlist_closes_minutes,
                      })
                    : t('sessionPage.waitlistManual')
                }}
              </dd>
              <template v-if="session.created_at">
                <dt>{{ t('sessionPage.created') }}</dt>
                <dd>
                  {{
                    session.created_by
                      ? t('sessionPage.createdBy', {
                          date: format.dateTime(session.created_at, session.location.timezone),
                          name: session.created_by,
                        })
                      : format.dateTime(session.created_at, session.location.timezone)
                  }}
                </dd>
              </template>
            </dl>
          </TabPanel>
          <TabPanel value="activity">
            <EmptyState
              v-if="!session.activity.length"
              class="panel"
              icon="pi-history"
              :title="t('sessionPage.noActivity')"
            />
            <ol v-else class="panel timeline">
              <li v-for="(e, i) in session.activity" :key="i" class="event">
                <span class="event__dot" aria-hidden="true"
                  ><i :class="['pi', actionIcon(e.action)]"
                /></span>
                <div class="event__body">
                  <div class="event__title">{{ actionLabel(e.action) }}</div>
                  <div v-if="e.changed.length" class="event__text">
                    {{
                      t('sessionPage.changed', {
                        fields: e.changed
                          .map((f) => t(`sessionPage.fields.${f}`))
                          .join(locale === 'ar' ? '، ' : ', '),
                      })
                    }}
                  </div>
                  <div v-if="e.reason" class="event__text">
                    {{ t('sessionPage.reason', { reason: reasonLabel(e.reason) }) }}
                  </div>
                  <div class="event__meta">
                    <template v-if="e.at">{{
                      format.dateTime(e.at, session.location.timezone)
                    }}</template>
                    <template v-if="e.user"> · {{ e.user }}</template>
                  </div>
                </div>
              </li>
            </ol>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <SessionDrawer
        v-model:visible="drawerOpen"
        :prefill="prefill"
        :session="editing"
        @updated="onUpdated"
        @series-updated="onSeriesUpdated"
        @saved="onCreated"
      />
      <CancelSessionDialog
        v-model:visible="cancelOpen"
        :session="session"
        @cancelled="onCancelled"
      />
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.title-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex: none;
}
.capacity {
  margin-inline-end: 12px;
  min-width: 120px;
}
:deep(.page-header) i.pi-building,
:deep(.page-header) i.pi-user,
:deep(.page-header) i.pi-replay,
:deep(.page-header) i.pi-star {
  font-size: 12px;
  margin-inline-end: 6px;
}
.issues {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.issues__title {
  font: var(--text-h4);
}
.tab-count {
  margin-inline-start: 6px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.facts {
  margin: 0;
  padding: 20px;
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px 24px;
  font: var(--text-body);
}
.facts dt {
  color: var(--text-secondary);
}
.facts dd {
  margin: 0;
}
.people {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.person {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.muted {
  font: var(--text-caption);
  color: var(--text-muted);
}
.timeline {
  margin: 0;
  padding: 20px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.event {
  display: flex;
  gap: 12px;
}
.event__dot {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 999px;
  background: var(--surface-sunken);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.event__dot i {
  font-size: 12px;
}
.event__title {
  font: 500 14px/1.4 var(--font-sans);
}
.event__text {
  font: var(--text-small);
  color: var(--text-secondary);
}
.event__meta {
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 640px) {
  .facts {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .facts dd {
    margin-bottom: 8px;
  }
}
</style>
