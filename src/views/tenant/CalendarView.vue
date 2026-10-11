<script setup lang="ts">
// Main calendar (US-03.01), as the design (ui_kits/admin/CalendarScreen.jsx): Day with facility or
// coach columns, Week, Month and List; filters by facility, coach, type and status; session cards
// with booked/capacity and status colours; closures and out-of-hours time shaded. It follows the
// header branch switcher (US-01.13); with all branches, each session shows its own branch time (D4).
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import SplitButton from 'primevue/splitbutton'
import Skeleton from 'primevue/skeleton'
import CapacityIndicator from '@/components/patterns/CapacityIndicator.vue'
import AppointmentDrawer from '@/components/schedule/AppointmentDrawer.vue'
import EventDrawer from '@/components/schedule/EventDrawer.vue'
import SessionDrawer, { type SessionPrefill } from '@/components/schedule/SessionDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import SessionCard from '@/components/patterns/SessionCard.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  ACTIVITY_TYPES,
  tenantApi,
  type ActivityType,
  type CalendarBranch,
  type CalendarSession,
  type Facility,
  type ScheduledEventDetails,
  type SeriesUpdateResult,
  type StaffOption,
  type TimeRange,
} from '@/api/tenant'
import {
  addDays,
  addMonths,
  layoutLanes,
  startOfMonth,
  startOfWeek,
  toMinutes,
  todayIn,
  weekday,
  zonedToUtc,
} from '@/lib/calendar'
import { ACTIVITY_ICONS, activityKey } from '@/lib/catalog'
import { zoneAbbreviation } from '@/lib/datetime'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

type View = 'day' | 'week' | 'month' | 'list'
type Resource = 'facility' | 'coach'

const HOUR = 80 // px per hour (design)
const VIEWS: View[] = ['day', 'week', 'month', 'list']

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useStaffAuth()
const org = useOrganization()
const toast = useToast()
const canCreate = computed(() => auth.can('schedule.create'))
const canResolve = computed(() => auth.can('schedule.update'))
const canEdit = (s: CalendarSession) =>
  auth.can('schedule.update') &&
  !s.locked &&
  (!ownOnly.value || s.coaches.some((c) => c.id === auth.user?.id))

// The branch the calendar is about: the switcher's pick, or the only branch.
const branch = computed(
  () =>
    auth.currentLocation ??
    (auth.user?.switchable_locations.length === 1 ? auth.user.switchable_locations[0]! : null),
)
const allBranches = computed(() => !branch.value)
const timezone = computed(
  () => branch.value?.timezone ?? org.organization?.timezone ?? 'Asia/Riyadh',
)
const weekStart = computed(() => org.organization?.week_start ?? 6)
const ownOnly = computed(() => auth.user?.scope === 'own')

const view = ref<View>(
  VIEWS.includes(route.query.view as View) ? (route.query.view as View) : 'day',
)
const anchor = ref(
  typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date)
    ? route.query.date
    : todayIn(timezone.value),
)
const resource = ref<Resource>(route.query.by === 'coach' ? 'coach' : 'facility')
watch([view, anchor, resource], () =>
  router.replace({
    query: {
      view: view.value,
      date: anchor.value,
      ...(resource.value === 'coach' ? { by: 'coach' } : {}),
    },
  }),
)

// Filters
const facilityIds = ref<number[]>([])
const coachIds = ref<number[]>([])
const activityType = ref<ActivityType | 'all'>('all')
const statuses = ref<string[]>([])
const filtered = computed(
  () =>
    !!(facilityIds.value.length || coachIds.value.length || statuses.value.length) ||
    activityType.value !== 'all',
)
function clearFilters() {
  facilityIds.value = []
  coachIds.value = []
  statuses.value = []
  activityType.value = 'all'
}

// Window of the view, in the calendar's timezone.
const today = computed(() => todayIn(timezone.value))
const range = computed(() => {
  if (view.value === 'day') return { start: anchor.value, days: 1 }
  if (view.value === 'month') {
    return { start: startOfWeek(startOfMonth(anchor.value), weekStart.value), days: 42 }
  }
  return { start: startOfWeek(anchor.value, weekStart.value), days: 7 }
})
const days = computed(() =>
  Array.from({ length: range.value.days }, (_, i) => addDays(range.value.start, i)),
)

function move(step: number) {
  if (view.value === 'day') anchor.value = addDays(anchor.value, step)
  else if (view.value === 'month') anchor.value = addMonths(anchor.value, step)
  else anchor.value = addDays(anchor.value, step * 7)
}

// Data
const state = ref<'loading' | 'ready' | 'error'>('loading')
const sessions = ref<CalendarSession[]>([])
const branches = ref<CalendarBranch[]>([])
const facilities = ref<Facility[]>([])
const staff = ref<StaffOption[]>([])

let request = 0
async function load() {
  const mine = ++request
  state.value = 'loading'
  try {
    const result = await tenantApi.sessions.list({
      from: zonedToUtc(range.value.start, '00:00', timezone.value).toISOString(),
      to: zonedToUtc(
        addDays(range.value.start, range.value.days),
        '00:00',
        timezone.value,
      ).toISOString(),
      ...(branch.value ? { location_id: branch.value.id } : {}),
      ...(facilityIds.value.length ? { facility_ids: facilityIds.value } : {}),
      ...(coachIds.value.length ? { coach_ids: coachIds.value } : {}),
      ...(activityType.value !== 'all' ? { activity_type: activityType.value } : {}),
      ...(statuses.value.length ? { statuses: statuses.value } : {}),
    })
    if (mine !== request) return
    sessions.value = result.data
    branches.value = result.branches
    state.value = 'ready'
  } catch {
    if (mine === request) state.value = 'error'
  }
}
// Conflict Center badge (US-03.07)
const conflictCount = ref(0)
async function loadConflicts() {
  if (!canResolve.value) return
  conflictCount.value = await tenantApi.sessions
    .conflicts(branch.value ? { location_id: branch.value.id } : {})
    .then((r) => r.meta.sessions)
    .catch(() => 0)
}
async function loadFacilities() {
  try {
    facilities.value = (
      await tenantApi.facilities.list(branch.value ? { location_id: branch.value.id } : {})
    ).filter((f) => f.status === 'Active')
  } catch {
    facilities.value = []
  }
}
onMounted(async () => {
  load()
  loadFacilities()
  loadConflicts()
  if (auth.can('services.view'))
    staff.value = await tenantApi.services.staffOptions().catch(() => [])
})
watch([range, facilityIds, coachIds, activityType, statuses], load, { deep: true })
watch(
  () => branch.value?.id,
  () => {
    facilityIds.value = []
    load()
    loadFacilities()
    loadConflicts()
  },
)

// Filter options
const facilityOptions = computed(() =>
  facilities.value.map((f) => ({
    value: f.id,
    label: allBranches.value && f.location ? `${f.name} · ${f.location.name}` : f.name,
  })),
)
const coachOptions = computed(() => staff.value.map((s) => ({ value: s.id, label: s.name })))
const typeOptions = computed(() => [
  { value: 'all', label: t('catalog.allTypes'), icon: null as string | null },
  ...ACTIVITY_TYPES.filter((a) => a !== 'Open Access').map((a) => ({
    value: a,
    label: t(`catalog.types.${activityKey(a)}`),
    icon: ACTIVITY_ICONS[a],
  })),
])
const statusOptions = computed(() =>
  ['Draft', 'Published', 'Full', 'Cancelled', 'Completed'].map((s) => ({
    value: s,
    label: t(`calendar.status.${s}`),
  })),
)
const viewOptions = computed(() =>
  VIEWS.map((v) => ({ value: v, label: t(`calendar.views.${v}`) })),
)
const resourceOptions = computed(() => [
  { value: 'facility', label: t('calendar.byFacility'), icon: 'pi pi-building' },
  { value: 'coach', label: t('calendar.byCoach'), icon: 'pi pi-user' },
])

// Title of the period
const dayLabel = (ymd: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${ymd}T12:00:00Z`))
const title = computed(() => {
  if (view.value === 'day')
    return dayLabel(anchor.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  if (view.value === 'month') return dayLabel(anchor.value, { month: 'long', year: 'numeric' })
  const end = addDays(range.value.start, 6)
  return `${dayLabel(range.value.start, { day: 'numeric', month: 'short' })} – ${dayLabel(end, { day: 'numeric', month: 'short', year: 'numeric' })}`
})
const datePopover = ref<InstanceType<typeof Popover>>()
const pickerDate = computed({
  get: () => new Date(`${anchor.value}T12:00:00`),
  set: (d: Date | null) => {
    if (!d) return
    anchor.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    datePopover.value?.hide()
  },
})

// Hours shown: 06–22, widened to the business hours and sessions in view.
const hours = computed(() => {
  let from = 6 * 60
  let to = 22 * 60
  for (const b of branches.value)
    for (const ranges of Object.values(b.business_hours ?? {}))
      for (const r of ranges) {
        from = Math.min(from, toMinutes(r.start))
        to = Math.max(to, toMinutes(r.end))
      }
  for (const s of sessions.value) {
    from = Math.min(from, toMinutes(s.local.start))
    to = Math.max(to, s.local.end < s.local.start ? 24 * 60 : toMinutes(s.local.end))
  }
  return { from: Math.floor(from / 60) * 60, to: Math.min(24 * 60, Math.ceil(to / 60) * 60) }
})
const gridHeight = computed(() => ((hours.value.to - hours.value.from) / 60) * HOUR)
const hourMarks = computed(() => {
  const marks: number[] = []
  for (let m = hours.value.from + 60; m < hours.value.to; m += 60) marks.push(m)
  return marks
})
const y = (minutes: number) => ((minutes - hours.value.from) / 60) * HOUR
const endMinutes = (s: CalendarSession) =>
  s.local.end <= s.local.start ? 24 * 60 : toMinutes(s.local.end)

// Shading: time outside business hours, and holidays / special hours (US-01.06/07).
interface Shade {
  from: number
  to: number
  label: string | null
  closed: boolean
}
function shadesFor(b: CalendarBranch | undefined, ymd: string): Shade[] {
  if (!b) return []
  const closure = b.closures.find((c) => c.start_date <= ymd && ymd <= c.end_date)
  let ranges: TimeRange[] | null
  if (closure) {
    if (closure.closed)
      return [{ from: hours.value.from, to: hours.value.to, label: closure.label, closed: true }]
    ranges = closure.hours
  } else {
    ranges = b.business_hours ? (b.business_hours[String(weekday(ymd))] ?? []) : null
  }
  if (ranges === null) return []
  if (!ranges.length)
    return [
      { from: hours.value.from, to: hours.value.to, label: t('calendar.closed'), closed: true },
    ]
  const out: Shade[] = []
  let cursor = hours.value.from
  for (const r of [...ranges].sort((a, b) => a.start.localeCompare(b.start))) {
    const start = toMinutes(r.start)
    if (start > cursor) out.push({ from: cursor, to: start, label: null, closed: false })
    cursor = Math.max(cursor, toMinutes(r.end))
  }
  if (cursor < hours.value.to)
    out.push({ from: cursor, to: hours.value.to, label: null, closed: false })
  if (closure) out[0] = { ...out[0]!, label: closure.label }
  return out
}
const branchById = (id: number | undefined) => branches.value.find((b) => b.id === id)
const calendarBranch = computed(() => (branch.value ? branchById(branch.value.id) : undefined))

// Day view columns: facilities, or coaches with sessions that day.
interface Column {
  id: number
  label: string
  sub: string | null
  locationId: number | undefined
  sessions: CalendarSession[]
}
const daySessions = computed(() => sessions.value.filter((s) => s.local.date === anchor.value))
const dayColumns = computed<Column[]>(() => {
  if (resource.value === 'facility') {
    const shown = facilityIds.value.length
      ? facilities.value.filter((f) => facilityIds.value.includes(f.id))
      : facilities.value
    const cols: Column[] = shown.map((f) => ({
      id: f.id,
      label: f.name,
      sub: `${t('calendar.cap')} ${f.capacity}${allBranches.value && f.location ? ` · ${f.location.name}` : ''}`,
      locationId: f.location_id,
      sessions: daySessions.value.filter((s) => s.facility.id === f.id),
    }))
    // Sessions on facilities not in the list (e.g. inactive): their own columns.
    for (const s of daySessions.value)
      if (!cols.some((c) => c.id === s.facility.id))
        cols.push({
          id: s.facility.id,
          label: s.facility.name,
          sub: null,
          locationId: s.location.id,
          sessions: daySessions.value.filter((x) => x.facility.id === s.facility.id),
        })
    return cols
  }
  const coaches = new Map<number, string>()
  for (const s of daySessions.value) for (const c of s.coaches) coaches.set(c.id, c.name)
  return [...coaches]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => ({
      id,
      label: name,
      sub: null,
      locationId: branch.value?.id,
      sessions: daySessions.value.filter((s) => s.coaches.some((c) => c.id === id)),
    }))
})
const laid = (list: CalendarSession[]) =>
  layoutLanes(list, (s) => toMinutes(s.local.start), endMinutes)

// Week / list / month
const sessionsOn = (ymd: string) => sessions.value.filter((s) => s.local.date === ymd)
const listDays = computed(() => days.value.filter((d) => sessionsOn(d).length))
const monthOf = computed(() => anchor.value.slice(0, 7))
function openDay(ymd: string) {
  anchor.value = ymd
  view.value = 'day'
}

// Session popover
const popover = ref<InstanceType<typeof Popover>>()
const selected = ref<CalendarSession | null>(null)
function select(s: CalendarSession, event: Event) {
  selected.value = s
  popover.value?.hide()
  // The event loses its currentTarget once handled: keep the card to align to.
  const target = event.currentTarget as HTMLElement
  requestAnimationFrame(() => popover.value?.show(event, target))
}
// New session (US-03.02): from the button, an empty slot of the day view, or another page's link.
const drawerOpen = ref(false)
const prefill = ref<SessionPrefill>({})
const editing = ref<CalendarSession | null>(null)
function newSession(p: SessionPrefill = {}) {
  editing.value = null
  prefill.value = { locationId: branch.value?.id ?? null, date: anchor.value, ...p }
  drawerOpen.value = true
}
// New ▾: session or series, appointment from availability (US-03.09).
const appointmentOpen = ref(false)
const eventOpen = ref(false)
function onEventCreated(event: ScheduledEventDetails) {
  toast.add({
    severity: 'success',
    summary: t('event.created', { name: event.service.name, n: event.sessions.length }),
    detail: event.status === 'Draft' ? t('session.draftHint') : undefined,
    life: 5000,
  })
  const first = event.sessions[0]?.local.date
  if (first) anchor.value = first
  if (view.value === 'day') view.value = 'week'
  load()
}
const createItems = computed(() => [
  {
    label: t('calendar.newSessionOrSeries'),
    icon: 'pi pi-calendar-plus',
    command: () => newSession(),
  },
  { label: t('calendar.newEvent'), icon: 'pi pi-star', command: () => (eventOpen.value = true) },
  {
    label: t('appointment.title'),
    icon: 'pi pi-user',
    command: () => (appointmentOpen.value = true),
  },
])
function onAppointment(session: CalendarSession) {
  toast.add({
    severity: 'success',
    summary: t('appointment.booked', { name: session.service.name }),
    life: 5000,
  })
  anchor.value = session.local.date
  load()
}
// Edit (US-03.04)
function editSession(s: CalendarSession) {
  popover.value?.hide()
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
  loadConflicts()
}
function onSlot(event: MouseEvent, column: Column) {
  if (!canCreate.value || event.target !== event.currentTarget) return
  const minutes = hours.value.from + Math.floor(event.offsetY / HOUR) * 60
  newSession({
    locationId: column.locationId ?? branch.value?.id ?? null,
    ...(resource.value === 'facility' ? { facilityId: column.id } : { coachId: column.id }),
    start: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`,
  })
}
function onCreated(session: CalendarSession) {
  toast.add({
    severity: 'success',
    summary: t('session.created', { name: session.service.name }),
    detail: session.status === 'Draft' ? t('session.draftHint') : undefined,
    life: 5000,
  })
  anchor.value = session.local.date
  load()
}
function onSeriesUpdated(result: SeriesUpdateResult) {
  toast.add({
    severity: 'success',
    summary: t('session.seriesUpdated'),
    detail: t('session.seriesUpdatedDetail', { ...result }),
    life: 5000,
  })
  if (result.unresolved.length)
    toast.add({
      severity: 'warn',
      summary: t('session.unresolved', {
        dates: result.unresolved
          .map((u) => `${dayLabel(u.date, { day: 'numeric', month: 'short' })} ${u.start}`)
          .join('، '),
      }),
      life: 12000,
    })
  load()
}
function onSeriesCreated(result: { sessions: number; skipped: number; firstDate: string | null }) {
  toast.add({
    severity: 'success',
    summary: t('session.seriesCreated', result.sessions),
    detail: result.skipped ? t('session.seriesSkipped', { n: result.skipped }) : undefined,
    life: 5000,
  })
  if (result.firstDate) anchor.value = result.firstDate
  if (view.value === 'day') view.value = 'week'
  load()
}
onMounted(() => {
  if (route.query.new === '1' && canCreate.value) {
    newSession({
      locationId: Number(route.query.location) || branch.value?.id || null,
      facilityId: Number(route.query.facility) || null,
      start: typeof route.query.start === 'string' ? route.query.start : undefined,
    })
  }
})
const zoneOf = (s: CalendarSession) =>
  allBranches.value ? zoneAbbreviation(s.location.timezone, locale.value) : null
</script>

<template>
  <div class="calendar">
    <div class="toolbar">
      <h1>{{ t('calendar.title') }}</h1>
      <Button
        :label="t('calendar.today')"
        severity="secondary"
        variant="outlined"
        size="small"
        @click="anchor = today"
      />
      <Button
        icon="pi pi-chevron-left pi-dir"
        severity="secondary"
        variant="text"
        size="small"
        :aria-label="t('calendar.previous')"
        @click="move(-1)"
      />
      <Button
        icon="pi pi-chevron-right pi-dir"
        severity="secondary"
        variant="text"
        size="small"
        :aria-label="t('calendar.next')"
        @click="move(1)"
      />
      <Button
        :label="title"
        icon="pi pi-chevron-down"
        icon-pos="right"
        variant="text"
        severity="contrast"
        aria-haspopup="true"
        @click="datePopover?.toggle($event)"
      />
      <Popover ref="datePopover">
        <DatePicker v-model="pickerDate" inline :first-day-of-week="weekStart" />
      </Popover>
      <span class="spacer" />
      <SelectButton
        v-model="view"
        :options="viewOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('calendar.view')"
      />
      <SplitButton
        v-if="canCreate"
        icon="pi pi-plus"
        :label="t('session.new')"
        :model="createItems"
        :menu-button-props="{ 'aria-label': t('calendar.moreCreate') }"
        @click="newSession()"
      />
    </div>

    <div class="filters">
      <MultiSelect
        v-model="facilityIds"
        :options="facilityOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('calendar.facility')"
        display="comma"
        :max-selected-labels="1"
        filter
        class="filter"
      />
      <MultiSelect
        v-if="!ownOnly && coachOptions.length"
        v-model="coachIds"
        :options="coachOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('calendar.coach')"
        display="comma"
        :max-selected-labels="1"
        filter
        class="filter"
      />
      <Select
        v-model="activityType"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        class="filter"
        :aria-label="t('catalog.activityType')"
      />
      <MultiSelect
        v-model="statuses"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('calendar.statusLabel')"
        display="comma"
        :max-selected-labels="1"
        class="filter"
      />
      <Button
        v-if="filtered"
        size="small"
        variant="text"
        severity="secondary"
        :label="t('catalog.clearAll')"
        @click="clearFilters"
      />
      <span class="spacer" />
      <SelectButton
        v-if="view === 'day' && !ownOnly"
        v-model="resource"
        :options="resourceOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('calendar.columns')"
      >
        <template #option="{ option }"
          ><i :class="option.icon" aria-hidden="true" />{{ option.label }}</template
        >
      </SelectButton>
      <Button
        v-if="canResolve"
        size="small"
        icon="pi pi-exclamation-triangle"
        :label="t('calendar.conflicts')"
        :badge="conflictCount ? String(conflictCount) : undefined"
        badge-severity="warn"
        :severity="conflictCount ? 'warn' : 'secondary'"
        variant="outlined"
        @click="router.push({ name: 'tenant.conflicts' })"
      />
    </div>

    <Message v-if="ownOnly" severity="secondary" icon="pi pi-user" :closable="false">{{
      t('calendar.ownOnly')
    }}</Message>
    <Message v-else-if="allBranches" severity="info" icon="pi pi-clock" :closable="false">{{
      t('calendar.allBranches')
    }}</Message>

    <div class="board">
      <div v-if="state === 'loading'" class="skeleton">
        <div v-for="c in 7" :key="c" class="skeleton__col">
          <Skeleton height="18px" width="60%" />
          <Skeleton
            v-for="n in 2 + (c % 3)"
            :key="n"
            :height="`${44 + (n % 2) * 24}px`"
            border-radius="8px"
          />
        </div>
      </div>
      <ErrorState v-else-if="state === 'error'" :title="t('calendar.loadError')" @retry="load" />

      <EmptyState
        v-else-if="!sessions.length && !filtered && view !== 'day'"
        icon="pi-calendar-plus"
        :title="t('calendar.empty')"
        :body="t('calendar.emptyHint')"
      >
        <Button
          v-if="canCreate"
          icon="pi pi-plus"
          :label="t('session.new')"
          @click="newSession()"
        />
      </EmptyState>

      <!-- Day: resource columns -->
      <template v-else-if="view === 'day'">
        <EmptyState
          v-if="!dayColumns.length"
          :icon="resource === 'coach' ? 'pi-user' : 'pi-building'"
          :title="resource === 'coach' ? t('calendar.noCoachSessions') : t('calendar.noFacilities')"
          :body="resource === 'coach' ? t('calendar.emptyHint') : t('calendar.noFacilitiesHint')"
        >
          <Button
            v-if="canCreate && resource === 'coach'"
            icon="pi pi-plus"
            :label="t('session.new')"
            @click="newSession()"
          />
        </EmptyState>
        <div
          v-else
          class="grid"
          :style="{
            gridTemplateColumns: `56px repeat(${dayColumns.length}, minmax(160px, 1fr))`,
            minWidth: `${56 + dayColumns.length * 160}px`,
          }"
        >
          <div class="head head--corner" />
          <div v-for="c in dayColumns" :key="c.id" class="head">
            <div class="head__title">{{ c.label }}</div>
            <div v-if="c.sub" class="head__sub">{{ c.sub }}</div>
          </div>
          <div class="gutter" :style="{ height: `${gridHeight}px` }">
            <span
              v-for="m in hourMarks"
              :key="m"
              class="gutter__mark num"
              :style="{ top: `${y(m) - 7}px` }"
              >{{ String(m / 60).padStart(2, '0') }}:00</span
            >
          </div>
          <div
            v-for="c in dayColumns"
            :key="c.id"
            :class="['column', { 'column--clickable': canCreate }]"
            :style="{ height: `${gridHeight}px`, backgroundSize: `100% ${HOUR}px` }"
            @click="onSlot($event, c)"
          >
            <div
              v-for="(sh, i) in shadesFor(branchById(c.locationId) ?? calendarBranch, anchor)"
              :key="i"
              :class="['shade', { 'shade--closed': sh.closed }]"
              :style="{ top: `${y(sh.from)}px`, height: `${y(sh.to) - y(sh.from)}px` }"
            >
              <span v-if="sh.label" class="shade__label">{{ sh.label }}</span>
            </div>
            <div
              v-for="l in laid(c.sessions)"
              :key="l.item.id"
              class="slot"
              :style="{
                top: `${y(toMinutes(l.item.local.start)) + 1}px`,
                height: `${y(endMinutes(l.item)) - y(toMinutes(l.item.local.start)) - 2}px`,
                insetInlineStart: `calc(${(l.lane * 100) / l.lanes}% + 3px)`,
                width: `calc(${100 / l.lanes}% - 6px)`,
              }"
            >
              <SessionCard
                :session="l.item"
                :variant="
                  l.lanes > 1 || endMinutes(l.item) - toMinutes(l.item.local.start) < 75
                    ? 'compact'
                    : 'full'
                "
                :show-coach="resource === 'facility'"
                :show-zone="zoneOf(l.item)"
                :selected="selected?.id === l.item.id"
                role="button"
                tabindex="0"
                @click="select(l.item, $event)"
                @keydown.enter="select(l.item, $event)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Week: day columns -->
      <div
        v-else-if="view === 'week'"
        class="grid"
        :style="{
          gridTemplateColumns: '56px repeat(7, minmax(150px, 1fr))',
          minWidth: `${56 + 7 * 150}px`,
        }"
      >
        <div class="head head--corner" />
        <button
          v-for="d in days"
          :key="d"
          type="button"
          :class="['head', 'head--day', { 'head--today': d === today }]"
          @click="openDay(d)"
        >
          <div class="head__title">{{ dayLabel(d, { weekday: 'short', day: 'numeric' }) }}</div>
          <div v-if="d === today" class="head__sub">{{ t('calendar.today') }}</div>
        </button>
        <div class="gutter" :style="{ height: `${gridHeight}px` }">
          <span
            v-for="m in hourMarks"
            :key="m"
            class="gutter__mark num"
            :style="{ top: `${y(m) - 7}px` }"
            >{{ String(m / 60).padStart(2, '0') }}:00</span
          >
        </div>
        <div
          v-for="d in days"
          :key="d"
          :class="['column', { 'column--past': d < today }]"
          :style="{ height: `${gridHeight}px`, backgroundSize: `100% ${HOUR}px` }"
        >
          <div
            v-for="(sh, i) in shadesFor(calendarBranch, d)"
            :key="i"
            :class="['shade', { 'shade--closed': sh.closed }]"
            :style="{ top: `${y(sh.from)}px`, height: `${y(sh.to) - y(sh.from)}px` }"
          >
            <span v-if="sh.label" class="shade__label">{{ sh.label }}</span>
          </div>
          <div
            v-for="l in laid(sessionsOn(d))"
            :key="l.item.id"
            class="slot"
            :style="{
              top: `${y(toMinutes(l.item.local.start)) + 1}px`,
              height: `${y(endMinutes(l.item)) - y(toMinutes(l.item.local.start)) - 2}px`,
              insetInlineStart: `calc(${(l.lane * 100) / l.lanes}% + 3px)`,
              width: `calc(${100 / l.lanes}% - 6px)`,
            }"
          >
            <SessionCard
              :session="l.item"
              variant="compact"
              :show-zone="zoneOf(l.item)"
              :selected="selected?.id === l.item.id"
              role="button"
              tabindex="0"
              @click="select(l.item, $event)"
              @keydown.enter="select(l.item, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Month -->
      <div v-else-if="view === 'month'" class="month">
        <div v-for="d in days.slice(0, 7)" :key="`h${d}`" class="month__head">
          {{ dayLabel(d, { weekday: 'short' }) }}
        </div>
        <div
          v-for="(d, i) in days"
          :key="d"
          :class="[
            'month__cell',
            { 'month__cell--out': d.slice(0, 7) !== monthOf, 'month__cell--edge': i % 7 === 0 },
          ]"
        >
          <button
            type="button"
            :class="['month__day', 'num', { 'month__day--today': d === today }]"
            @click="openDay(d)"
          >
            {{ Number(d.slice(8)) }}
          </button>
          <SessionCard
            v-for="s in sessionsOn(d).slice(0, 2)"
            :key="s.id"
            :session="s"
            variant="mini"
            role="button"
            tabindex="0"
            @click="select(s, $event)"
          />
          <button
            v-if="sessionsOn(d).length > 2"
            type="button"
            class="month__more"
            @click="openDay(d)"
          >
            {{ t('calendar.more', { n: sessionsOn(d).length - 2 }) }}
          </button>
        </div>
      </div>

      <!-- List -->
      <div v-else class="list">
        <EmptyState
          v-if="!listDays.length"
          compact
          icon="pi-search"
          :title="t('calendar.noMatch')"
        />
        <template v-for="d in listDays" :key="d">
          <div :class="['list__day', { 'list__day--today': d === today }]">
            {{ dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' }) }}
            <template v-if="d === today"> · {{ t('calendar.today') }}</template>
          </div>
          <div
            v-for="s in sessionsOn(d)"
            :key="s.id"
            class="list__row"
            role="button"
            tabindex="0"
            @click="select(s, $event)"
            @keydown.enter="select(s, $event)"
          >
            <span dir="ltr" class="num list__time"
              >{{ s.local.start }}–{{ s.local.end }}
              <span v-if="zoneOf(s)" class="list__zone">{{ zoneOf(s) }}</span></span
            >
            <span class="list__name">
              <span
                class="swatch"
                :style="{ background: s.service.color ?? 'var(--svc-1)' }"
                aria-hidden="true"
              />
              <span :class="{ struck: s.status === 'Cancelled' }">{{ s.service.name }}</span>
            </span>
            <span class="list__coach">{{ s.coaches[0]?.name }} · {{ s.facility.name }}</span>
            <CapacityIndicator
              :booked="s.booked"
              :capacity="s.capacity"
              :waitlist="s.waitlist"
              :cancelled="s.status === 'Cancelled'"
              size="sm"
            />
            <StatusTag :status="s.status" size="sm" />
          </div>
        </template>
      </div>
    </div>

    <EventDrawer
      v-model:visible="eventOpen"
      :location-id="branch?.id ?? null"
      :date="anchor"
      @saved="onEventCreated"
    />
    <AppointmentDrawer
      v-model:visible="appointmentOpen"
      :location-id="branch?.id ?? null"
      :date="anchor"
      @saved="onAppointment"
    />
    <SessionDrawer
      v-model:visible="drawerOpen"
      :prefill="prefill"
      :session="editing"
      @saved="onCreated"
      @updated="onUpdated"
      @series-updated="onSeriesUpdated"
      @series-saved="onSeriesCreated"
    />

    <Popover ref="popover" @hide="selected = null">
      <div v-if="selected" class="pop">
        <div class="pop__head">
          <div>
            <div class="pop__title">{{ selected.service.name }}</div>
            <div class="pop__time" dir="ltr">
              {{ selected.local.start }}–{{ selected.local.end }}
              <span class="pop__zone">{{
                zoneAbbreviation(selected.location.timezone, locale)
              }}</span>
            </div>
          </div>
          <StatusTag :status="selected.status" size="sm" />
        </div>
        <div v-for="(c, i) in selected.coaches" :key="c.id" class="pop__person">
          <PersonAvatar :name="c.name" />
          <div>
            <div class="pop__name">{{ c.name }}</div>
            <div class="pop__sub">
              {{ i === 0 ? selected.facility.name : t('calendar.assistant') }}
              <template v-if="i === 0 && allBranches"> · {{ selected.location.name }}</template>
            </div>
          </div>
        </div>
        <CapacityIndicator
          :booked="selected.booked"
          :capacity="selected.capacity"
          :waitlist="selected.waitlist"
          :cancelled="selected.status === 'Cancelled'"
        />
        <div v-if="selected.series_id" class="pop__note">
          <i class="pi pi-replay" aria-hidden="true" />{{
            selected.exception ? t('session.exception') : t('calendar.inSeries')
          }}
        </div>
        <div v-if="selected.status === 'Completed'" class="pop__note">
          <i class="pi pi-lock" aria-hidden="true" />{{ t('calendar.pastReadOnly') }}
        </div>
        <div class="pop__actions">
          <Button
            :label="t('calendar.open')"
            icon="pi pi-arrow-right pi-dir"
            icon-pos="right"
            severity="secondary"
            variant="text"
            size="small"
            @click="router.push({ name: 'tenant.session', params: { id: selected.id } })"
          />
          <Button
            v-if="canEdit(selected)"
            :label="t('calendar.edit')"
            icon="pi pi-pencil"
            severity="secondary"
            variant="outlined"
            size="small"
            @click="editSession(selected)"
          />
        </div>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.toolbar,
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar h1 {
  margin: 0;
  margin-inline-end: 8px;
  font: var(--text-h1);
}
.spacer {
  flex: 1;
}
.filter {
  width: 160px;
}
.board {
  flex: 1;
  min-height: 320px;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: auto;
}
.skeleton {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  padding: 16px;
}
.skeleton__col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grid {
  display: grid;
}
.head {
  position: sticky;
  top: 0;
  z-index: 12;
  padding: 10px 12px;
  background: var(--surface-card);
  border: 0;
  border-bottom: 1px solid var(--border-default);
  border-inline-start: 1px solid var(--border-subtle);
  text-align: start;
  color: var(--text-primary);
}
.head--corner {
  border-inline-start: 0;
}
.head--day {
  cursor: pointer;
}
.head--day:hover {
  background: var(--surface-hover);
}
.head--today {
  color: var(--primary);
}
.head__title {
  font: var(--text-h4);
}
.head__sub {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.head--today .head__sub {
  color: var(--primary);
}
.gutter {
  position: relative;
}
.gutter__mark {
  position: absolute;
  inset-inline-end: 8px;
  font: 500 11px var(--font-sans);
  color: var(--text-muted);
  direction: ltr;
}
.column {
  position: relative;
  border-inline-start: 1px solid var(--border-subtle);
  background-image: linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px);
}
.column--clickable {
  cursor: copy;
}
.column--past {
  background-color: color-mix(in srgb, var(--surface-sunken) 35%, transparent);
}
.shade {
  position: absolute;
  inset-inline: 0;
  background: color-mix(in srgb, var(--surface-sunken) 70%, transparent);
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6px;
}
.shade--closed {
  background: repeating-linear-gradient(135deg, var(--surface-sunken) 0 6px, transparent 6px 12px);
}
.shade__label {
  font: 600 11px var(--font-sans);
  color: var(--text-muted);
  background: var(--surface-card);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
}
.slot {
  position: absolute;
  z-index: 1;
}
.month {
  display: grid;
  grid-template-columns: repeat(7, minmax(100px, 1fr));
}
.month__head {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-default);
  font: 600 12px var(--font-sans);
  color: var(--text-secondary);
}
.month__cell {
  min-height: 118px;
  padding: 6px;
  border-bottom: 1px solid var(--border-subtle);
  border-inline-start: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.month__cell--edge {
  border-inline-start: 0;
}
.month__cell--out {
  background: var(--surface-sunken);
}
.month__day {
  align-self: flex-start;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: 600 12px var(--font-sans);
  color: var(--text-primary);
  cursor: pointer;
}
.month__cell--out .month__day {
  color: var(--text-disabled);
}
.month__day--today {
  background: var(--primary);
  color: var(--text-on-primary);
}
.month__more {
  align-self: flex-start;
  border: 0;
  background: transparent;
  padding: 0 4px;
  font: 500 11px var(--font-sans);
  color: var(--text-link);
  cursor: pointer;
}
.list__day {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 16px;
  background: var(--surface-50);
  border-bottom: 1px solid var(--border-default);
  font: var(--text-h4);
}
[data-theme='dark'] .list__day {
  background: var(--surface-sunken);
}
.list__day--today {
  color: var(--primary);
}
.list__row {
  display: grid;
  grid-template-columns: 120px minmax(140px, 1fr) minmax(0, 200px) 100px auto;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
}
.list__row:hover {
  background: var(--surface-hover);
}
.list__time {
  font: 500 14px var(--font-sans);
}
.list__zone {
  margin-inline-start: 4px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--surface-sunken);
  font: 600 10px/18px var(--font-sans);
  color: var(--text-secondary);
}
.list__name {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.list__coach {
  font: var(--text-small);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: none;
}
.struck {
  text-decoration: line-through;
}
.pop {
  width: 290px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pop__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.pop__title {
  font: var(--text-h4);
}
.pop__time {
  font: 500 13px var(--font-sans);
  color: var(--text-secondary);
}
.pop__zone {
  margin-inline-start: 4px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--surface-sunken);
  font: 600 10px/18px var(--font-sans);
}
.pop__person {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pop__name {
  font: 500 14px/1.3 var(--font-sans);
}
.pop__sub,
.pop__note {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.pop__note i {
  font-size: 10px;
  margin-inline-end: 4px;
}
.pop__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--border-subtle);
}
@media (max-width: 767px) {
  .list__row {
    grid-template-columns: 1fr auto;
  }
  .list__coach,
  .list__row :deep(.cap) {
    display: none;
  }
}
</style>
