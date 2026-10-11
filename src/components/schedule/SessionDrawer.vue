<script setup lang="ts">
// New session (US-03.02) and Edit session (US-03.04), as the design's drawer (ui_kits/admin/SessionDrawer.jsx): service, branch,
// facility, coach, local date and time (D4), duration and capacity from the service defaults (at
// most the facility's), Draft / Published, and a live conflict panel (US-03.06). Hard conflicts
// block saving; warnings (outside hours, holidays) are saved with "Save anyway".
// "Weekly" turns it into a series (US-03.03): a preview lists each date with its flags, and
// flagged dates can be skipped one by one before the sessions are created.
// Editing keeps the service and branch; a series occurrence asks what the change applies to.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ConflictList from '@/components/patterns/ConflictList.vue'
import EditScopeDialog, { type EditScope } from '@/components/schedule/EditScopeDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import {
  tenantApi,
  type CalendarSession,
  type Service,
  type SessionConflictItem,
  type SessionFormOptions,
  type SessionInput,
  type SeriesInput,
  type SeriesPreviewItem,
  type SeriesPattern,
  type SeriesUpdateResult,
} from '@/api/tenant'
import { ACTIVITY_ICONS, activityKey } from '@/lib/catalog'
import { errorCode, apiMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { addDays, todayIn, weekday } from '@/lib/calendar'
import { DAY_KEYS } from '@/lib/businessHours'
import { zoneAbbreviation } from '@/lib/datetime'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

export interface SessionPrefill {
  locationId?: number | null
  facilityId?: number | null
  coachId?: number | null
  date?: string
  start?: string
}

const props = defineProps<{ prefill: SessionPrefill; session?: CalendarSession | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  saved: [session: CalendarSession]
  updated: [session: CalendarSession]
  seriesUpdated: [result: SeriesUpdateResult]
  seriesSaved: [result: { sessions: number; skipped: number; firstDate: string | null }]
}>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const org = useOrganization()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const editing = computed(() => props.session ?? null)

const services = ref<Service[]>([])
const options = ref<SessionFormOptions | null>(null)
const form = reactive({
  serviceId: null as number | null,
  locationId: null as number | null,
  facilityId: null as number | null,
  coachId: null as number | null,
  assistantIds: [] as number[],
  date: null as Date | null,
  start: '18:00',
  duration: 60,
  capacity: 15,
  status: 'Draft' as 'Draft' | 'Published',
})
const conflicts = ref<SessionConflictItem[]>([])
const checking = ref(false)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)

const service = computed(() => services.value.find((s) => s.id === form.serviceId) ?? null)
const branchOptions = computed(() =>
  (auth.user?.switchable_locations ?? [])
    .filter((l) => !service.value || service.value.locations?.some((x) => x.location_id === l.id))
    .map((l) => ({ value: l.id, label: l.name, zone: zoneAbbreviation(l.timezone, locale.value) })),
)
const branch = computed(() => auth.user?.switchable_locations.find((l) => l.id === form.locationId))
const timezone = computed(() => options.value?.timezone ?? branch.value?.timezone ?? 'Asia/Riyadh')
const facility = computed(() => options.value?.facilities.find((f) => f.id === form.facilityId))
const facilityOptions = computed(() =>
  (options.value?.facilities ?? []).map((f) => ({
    value: f.id,
    label: f.parent_id ? `↳ ${f.name}` : f.name,
    capacity: f.capacity,
    linked: f.linked,
  })),
)
const coachOptions = computed(() => options.value?.coaches ?? [])
const assistantOptions = computed(() => coachOptions.value.filter((c) => c.id !== form.coachId))
const statusOptions = computed(() => [
  { value: 'Draft', label: t('status.Draft') },
  { value: 'Published', label: t('status.Published') },
])
const overCapacity = computed(() => !!facility.value && form.capacity > facility.value.capacity)
const hard = computed(() => conflicts.value.some((c) => c.level === 'hard'))
const soft = computed(() => conflicts.value.filter((c) => c.level === 'soft').length)
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : ''
const err = (field: string) => errors.value[field]?.[0]

function input(confirm = false): SessionInput | null {
  if (!form.serviceId || !form.locationId || !form.facilityId || !form.coachId || !form.date)
    return null
  return {
    service_id: form.serviceId,
    location_id: form.locationId,
    facility_id: form.facilityId,
    coach_ids: [form.coachId, ...form.assistantIds.filter((id) => id !== form.coachId)],
    date: ymd(form.date),
    start_time: form.start,
    duration: form.duration,
    capacity: form.capacity,
    status: form.status,
    ...(confirm ? { confirm_warnings: true } : {}),
  }
}

// Open: reset from the prefill (a calendar slot, the availability page…).
watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  formError.value = null
  conflicts.value = []
  options.value = null
  form.serviceId = null
  form.assistantIds = []
  form.status = 'Draft'
  repeat.value = 'none'
  weekdays.value = []
  everyWeeks.value = 1
  ends.value = 'date'
  endsOn.value = null
  previewItems.value = null
  skips.value = []
  const s = editing.value
  if (s) {
    form.serviceId = s.service.id
    form.locationId = s.location.id
    form.facilityId = s.facility.id
    form.coachId = s.coaches[0]?.id ?? null
    form.assistantIds = s.coaches.slice(1).map((c) => c.id)
    form.date = new Date(`${s.local.date}T12:00:00`)
    form.start = s.local.start
    form.duration = Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000)
    form.capacity = s.capacity ?? 1
    form.status = s.status === 'Draft' ? 'Draft' : 'Published'
    pattern.value = null
    scopeConflicts.value = []
    scopeSkips.value = []
    const [loaded, series] = await Promise.all([
      tenantApi.sessions.options(s.service.id, s.location.id).catch(() => null),
      s.series_id ? tenantApi.sessions.series(s.series_id).catch(() => null) : null,
    ])
    if (!visible.value || editing.value?.id !== s.id) return
    options.value = loaded
    if (series) {
      weekdays.value = [...series.weekdays]
      everyWeeks.value = series.every_weeks
      ends.value = series.rolling ? 'never' : 'date'
      endsOn.value = series.ends_on ? new Date(`${series.ends_on}T12:00:00`) : null
      pattern.value = series
    }
    return
  }
  form.locationId =
    props.prefill.locationId ??
    auth.currentLocation?.id ??
    auth.user?.switchable_locations[0]?.id ??
    null
  const date = props.prefill.date ?? todayIn(branch.value?.timezone ?? 'Asia/Riyadh')
  form.date = new Date(`${date}T12:00:00`)
  form.start = props.prefill.start ?? '18:00'
  if (!services.value.length) {
    services.value = (await tenantApi.services.list({}).catch(() => [])).filter(
      (s) => s.status !== 'Archived' && s.activity_type !== 'Open Access',
    )
  }
})

// Service or branch picked: their defaults, facilities and coaches.
watch(
  () => [form.serviceId, form.locationId] as const,
  async ([serviceId, locationId]) => {
    options.value = null
    if (!serviceId || !locationId) return
    if (editing.value) return // loaded on open; the session's own values stay
    if (!branchOptions.value.some((b) => b.value === locationId)) {
      form.locationId = branchOptions.value[0]?.value ?? null
      return
    }
    const loaded = await tenantApi.sessions.options(serviceId, locationId).catch(() => null)
    if (!loaded || form.serviceId !== serviceId || form.locationId !== locationId) return
    options.value = loaded
    form.duration = loaded.defaults.duration
    const wanted = loaded.facilities.find((f) => f.id === props.prefill.facilityId)
    const pick = wanted ?? loaded.facilities.find((f) => f.linked) ?? loaded.facilities[0]
    form.facilityId = pick?.id ?? null
    form.capacity = Math.min(
      loaded.defaults.capacity ?? pick?.capacity ?? 1,
      pick?.capacity ?? Infinity,
    )
    form.coachId =
      loaded.coaches.find((c) => c.id === props.prefill.coachId)?.id ??
      loaded.coaches[0]?.id ??
      null
  },
)
watch(
  () => form.facilityId,
  () => {
    if (facility.value && form.capacity > facility.value.capacity)
      form.capacity = facility.value.capacity
  },
)

// Live conflict check, debounced.
let timer: ReturnType<typeof setTimeout> | undefined
let checkId = 0
watch(
  () => JSON.stringify(input()),
  () => {
    clearTimeout(timer)
    const payload = input()
    if (!payload || !visible.value || overCapacity.value || repeat.value === 'weekly') {
      conflicts.value = []
      return
    }
    timer = setTimeout(async () => {
      const mine = ++checkId
      checking.value = true
      try {
        const found = editing.value
          ? await tenantApi.sessions.checkUpdate(editing.value.id, payload)
          : await tenantApi.sessions.check(payload)
        if (mine === checkId) conflicts.value = found
      } catch {
        if (mine === checkId) conflicts.value = []
      } finally {
        if (mine === checkId) checking.value = false
      }
    }, 350)
  },
)

// Repeat weekly (US-03.03)
const repeat = ref<'none' | 'weekly'>('none')
const weekdays = ref<number[]>([])
const everyWeeks = ref(1)
const ends = ref<'date' | 'count' | 'never'>('date')
const endsOn = ref<Date | null>(null)
const occurrences = ref(12)
const previewItems = ref<SeriesPreviewItem[] | null>(null)
const skips = ref<string[]>([])
const repeatOptions = computed(() => [
  { value: 'none', label: t('session.noRepeat') },
  { value: 'weekly', label: t('session.weekly') },
])
const weekdayOrder = computed(() =>
  Array.from({ length: 7 }, (_, i) => (firstDayOfWeek.value + i) % 7),
)
const dayShort = (d: number) => t(`session.days.${DAY_KEYS[d]}`)
function toggleDay(d: number) {
  weekdays.value = weekdays.value.includes(d)
    ? weekdays.value.filter((x) => x !== d)
    : [...weekdays.value, d]
}
watch(repeat, (r) => {
  if (r !== 'weekly' || !form.date) return
  if (!weekdays.value.length) weekdays.value = [weekday(ymd(form.date))]
  if (!endsOn.value) endsOn.value = new Date(`${addDays(ymd(form.date), 8 * 7)}T12:00:00`)
})
function seriesInput(confirm = false): SeriesInput | null {
  const one = input(confirm)
  if (!one || !weekdays.value.length) return null
  if (ends.value === 'date' && !endsOn.value) return null
  const { date, ...rest } = one
  return {
    ...rest,
    starts_on: date,
    weekdays: weekdays.value,
    every_weeks: everyWeeks.value,
    ends: ends.value,
    ends_on: ends.value === 'date' ? ymd(endsOn.value) : null,
    occurrences: ends.value === 'count' ? occurrences.value : null,
    skip_dates: skips.value,
  }
}
const kept = computed(() => (previewItems.value ?? []).filter((i) => !skips.value.includes(i.date)))
const keptSoft = computed(() => kept.value.some((i) => i.conflicts.some((c) => c.level === 'soft')))
const keptHard = computed(() => kept.value.some((i) => i.conflicts.some((c) => c.level === 'hard')))
function toggleSkip(date: string) {
  skips.value = skips.value.includes(date)
    ? skips.value.filter((d) => d !== date)
    : [...skips.value, date]
}
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00Z`))

function failed(e: unknown) {
  const code = errorCode(e)
  if (
    code === 'session_conflicts' ||
    code === 'needs_confirmation' ||
    code === 'outside_hours_forbidden' ||
    code === 'staff_warnings_forbidden'
  ) {
    const list =
      (e as { response?: { data?: { conflicts?: (SessionConflictItem & { date?: string })[] } } })
        .response?.data?.conflicts ?? []
    if (previewItems.value) {
      // Flag the refused dates in the preview.
      for (const c of list) {
        const item = previewItems.value.find((i) => i.date === c.date)
        if (item && !item.conflicts.some((x) => x.code === c.code)) item.conflicts.push(c)
      }
    } else {
      conflicts.value = list.length ? list : conflicts.value
    }
    formError.value = apiMessage(e) ?? null
  } else {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  }
}

async function showPreview() {
  const payload = seriesInput()
  if (!payload) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const items = await tenantApi.sessions.previewSeries({ ...payload, skip_dates: [] })
    previewItems.value = items
    // Flagged dates start skipped; the user can keep them.
    skips.value = items.filter((i) => i.conflicts.length).map((i) => i.date)
  } catch (e) {
    failed(e)
  } finally {
    saving.value = false
  }
}

async function createSeries() {
  const payload = seriesInput(keptSoft.value)
  if (!payload) return
  saving.value = true
  formError.value = null
  try {
    const result = await tenantApi.sessions.createSeries(payload)
    emit('seriesSaved', {
      sessions: result.sessions,
      skipped: result.skipped,
      firstDate: kept.value[0]?.date ?? null,
    })
    visible.value = false
  } catch (e) {
    failed(e)
  } finally {
    saving.value = false
  }
}

async function submit() {
  if (editing.value) {
    if (editing.value.series_id) {
      scopeConflicts.value = []
      scopeSkips.value = []
      scopeOpen.value = true
    } else await update()
    return
  }
  if (repeat.value === 'weekly') {
    if (previewItems.value) await createSeries()
    else await showPreview()
  } else {
    await save()
  }
}

async function save() {
  const payload = input(soft.value > 0)
  if (!payload) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const session = await tenantApi.sessions.create(payload)
    emit('saved', session)
    visible.value = false
  } catch (e) {
    failed(e)
  } finally {
    saving.value = false
  }
}

// Edit (US-03.04): a series occurrence first asks what the change applies to. Its pattern
// (weekdays, interval, end) can change too, for this and following or the whole series (US-03.05).
const scopeOpen = ref(false)
const pattern = ref<SeriesPattern | null>(null)
const scopeConflicts = ref<(SessionConflictItem & { date?: string })[]>([])
const scopeSkips = ref<string[]>([])
const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()
const patternChanged = computed(() => {
  const p = pattern.value
  if (!p) return false
  return (
    !sameDays(p.weekdays, weekdays.value) ||
    p.every_weeks !== everyWeeks.value ||
    p.rolling !== (ends.value === 'never') ||
    (ends.value === 'date' && p.ends_on !== ymd(endsOn.value))
  )
})
const unavailableScopes = computed(() => ({
  ...(patternChanged.value ? { one: t('session.editScope.seriesOnly') } : {}),
  ...(editing.value && editing.value.local.date !== ymd(form.date)
    ? {
        following: t('session.editScope.dateOnly'),
        all: t('session.editScope.dateOnly'),
      }
    : {}),
}))
const seriesSummary = computed(() => {
  const p = pattern.value
  if (!p) return null
  const days = weekdayOrder.value
    .filter((d) => p.weekdays.includes(d))
    .map(dayShort)
    .join('، ')
  const end = p.rolling
    ? t('session.editScope.noEnd')
    : p.ends_on
      ? t('session.editScope.until', { date: dateLabel(p.ends_on) })
      : ''
  return [locale.value === 'ar' ? days : days.replace(/،/g, ','), p.start_time, end]
    .filter(Boolean)
    .join(' · ')
})
const moved = computed(() => {
  const s = editing.value
  return (
    !!s &&
    (s.facility.id !== form.facilityId ||
      s.local.date !== ymd(form.date) ||
      s.local.start !== form.start ||
      Date.parse(s.ends_at) - Date.parse(s.starts_at) !== form.duration * 60000)
  )
})
async function updateSeries(scope: EditScope, skipDates: string[] = [], confirm = false) {
  const payload = input(confirm || soft.value > 0)
  const s = editing.value
  if (!payload || !s?.series_id || !pattern.value) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const result = await tenantApi.sessions.updateSeries(s.series_id, {
      ...payload, // its date is this occurrence's: the series keeps its own dates
      from: scope === 'following' ? s.local.date : pattern.value.starts_on,
      weekdays: weekdays.value,
      every_weeks: everyWeeks.value,
      ends: ends.value === 'never' ? 'never' : 'date',
      ends_on: ends.value === 'never' ? null : ymd(endsOn.value),
      skip_dates: skipDates,
    })
    scopeOpen.value = false
    emit('seriesUpdated', result)
    visible.value = false
  } catch (e) {
    const code = errorCode(e)
    const data = (e as { response?: { data?: Record<string, unknown> } }).response?.data ?? {}
    if (code === 'session_conflicts' || code === 'needs_confirmation') {
      // Shown in the dialog: those dates can be left as they are, warnings accepted.
      scopeConflicts.value = (data.conflicts as typeof scopeConflicts.value) ?? []
      scopeSkips.value = skipDates
      return
    }
    scopeOpen.value = false
    if (code === 'capacity_below_bookings') {
      const list = (data.sessions as { date: string; start: string; bookings: number }[]) ?? []
      formError.value = t('session.capacityBelow', {
        list: list.map((x) => `${dateLabel(x.date)} ${x.start} (${x.bookings})`).join('، '),
      })
    } else {
      failed(e)
    }
  } finally {
    saving.value = false
  }
}
function onScope(scope: EditScope) {
  // Only warnings left: saving again accepts them.
  const confirm = scopeConflicts.value.length > 0
  scopeConflicts.value = []
  if (scope === 'one') update()
  else updateSeries(scope, scopeSkips.value, confirm)
}
function onSkip(scope: EditScope, dates: string[]) {
  scopeConflicts.value = []
  updateSeries(scope, [...scopeSkips.value, ...dates])
}
async function update() {
  const payload = input(soft.value > 0)
  if (!payload || !editing.value) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const session = await tenantApi.sessions.update(editing.value.id, { ...payload, scope: 'one' })
    scopeOpen.value = false
    emit('updated', session)
    visible.value = false
  } catch (e) {
    scopeOpen.value = false
    failed(e)
  } finally {
    saving.value = false
  }
}

const canSave = computed(() => {
  if (saving.value || overCapacity.value) return false
  if (repeat.value === 'weekly')
    return previewItems.value ? kept.value.length > 0 && !keptHard.value : !!seriesInput()
  return !!input() && !hard.value && !checking.value
})
const saveLabel = computed(() => {
  if (editing.value)
    return soft.value && !hard.value ? t('session.saveAnyway') : t('session.saveChanges')
  if (repeat.value === 'weekly')
    return previewItems.value ? t('session.createN', kept.value.length) : t('session.preview')
  return soft.value && !hard.value ? t('session.saveAnyway') : t('session.save')
})
const subtitle = computed(() =>
  t('session.timesIn', {
    zone: `${zoneAbbreviation(timezone.value, locale.value)} · ${timezone.value}`,
  }),
)
const firstDayOfWeek = computed(() => org.organization?.week_start ?? 6)
const hourFormat = computed(() => (org.organization?.time_format === '12h' ? '12' : '24'))
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="editing ? t('session.editTitle') : t('session.newTitle')"
    class="session-drawer"
    :block-scroll="true"
  >
    <template #header>
      <div class="head">
        <div class="head__title">
          {{ editing ? t('session.editTitle') : t('session.newTitle') }}
        </div>
        <div class="head__sub" dir="auto">{{ subtitle }}</div>
      </div>
    </template>

    <form v-if="!previewItems" id="session-form" class="form" @submit.prevent="submit">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>

      <FormField
        v-if="editing"
        :label="t('session.service')"
        :help="editing.exception ? t('session.exception') : undefined"
      >
        <div class="svc-chip">
          <span
            class="swatch"
            :style="{ background: editing.service.color ?? 'var(--svc-1)' }"
            aria-hidden="true"
          />
          <span class="svc-chip__name">{{ editing.service.name }}</span>
          <span class="svc-chip__meta">{{ editing.location.name }}</span>
        </div>
      </FormField>
      <FormField
        v-else
        :label="t('session.service')"
        for="s-service"
        required
        :error="err('service_id')"
      >
        <Select
          v-model="form.serviceId"
          input-id="s-service"
          :options="services"
          option-label="display_name"
          option-value="id"
          :placeholder="t('session.pickService')"
          filter
          :filter-fields="['display_name', 'name.ar', 'name.en']"
          fluid
        >
          <template #option="{ option }">
            <span class="svc-option">
              <span
                class="swatch"
                :style="{ background: option.color ?? 'var(--svc-1)' }"
                aria-hidden="true"
              />
              <span class="svc-option__name">{{ option.display_name }}</span>
              <span class="svc-option__meta"
                ><i
                  :class="['pi', ACTIVITY_ICONS[option.activity_type as Service['activity_type']]]"
                  aria-hidden="true"
                />{{ t(`catalog.types.${activityKey(option.activity_type)}`) }}</span
              >
            </span>
          </template>
        </Select>
      </FormField>
      <div v-if="options && !editing" class="defaults-note">
        <i class="pi pi-sparkles" aria-hidden="true" />{{ t('session.defaultsFilled') }}
      </div>

      <div class="grid">
        <FormField
          v-if="!editing"
          :label="t('session.branch')"
          for="s-branch"
          :error="err('location_id')"
        >
          <Select
            v-model="form.locationId"
            input-id="s-branch"
            :options="branchOptions"
            option-label="label"
            option-value="value"
            fluid
          >
            <template #option="{ option }">
              <span class="opt"
                ><span>{{ option.label }}</span
                ><span class="opt__meta" dir="ltr">{{ option.zone }}</span></span
              >
            </template>
          </Select>
        </FormField>
        <FormField
          :label="t('calendar.facility')"
          for="s-facility"
          required
          :error="err('facility_id')"
        >
          <Select
            v-model="form.facilityId"
            input-id="s-facility"
            :options="facilityOptions"
            option-label="label"
            option-value="value"
            :disabled="!options"
            :placeholder="options && !facilityOptions.length ? t('session.noFacility') : undefined"
            fluid
          >
            <template #option="{ option }">
              <span class="opt">
                <span>
                  {{ option.label }}
                  <small v-if="option.linked" class="opt__sub">{{ t('session.linked') }}</small>
                </span>
                <span class="opt__meta">{{ t('calendar.cap') }} {{ option.capacity }}</span>
              </span>
            </template>
          </Select>
        </FormField>
        <FormField
          :label="t('calendar.coach')"
          for="s-coach"
          required
          :error="err('coach_ids') ?? err('coach_ids.0')"
        >
          <Select
            v-model="form.coachId"
            input-id="s-coach"
            :options="coachOptions"
            option-label="name"
            option-value="id"
            :disabled="!options"
            :placeholder="options && !coachOptions.length ? t('session.noCoach') : undefined"
            filter
            fluid
          />
        </FormField>
        <FormField :label="t('session.assistants')" for="s-assistants">
          <MultiSelect
            v-model="form.assistantIds"
            input-id="s-assistants"
            :options="assistantOptions"
            option-label="name"
            option-value="id"
            :disabled="!options"
            :placeholder="t('session.none')"
            :selection-limit="4"
            display="chip"
            fluid
          />
        </FormField>
        <FormField :label="t('session.date')" for="s-date" :error="err('date')">
          <DatePicker
            v-model="form.date"
            input-id="s-date"
            :first-day-of-week="firstDayOfWeek"
            date-format="yy-mm-dd"
            show-icon
            icon-display="input"
            fluid
          />
        </FormField>
        <FormField :label="t('session.start')" :error="err('start_time')">
          <TimeField v-model="form.start" :hour-format="hourFormat" class="fill" />
        </FormField>
        <FormField :label="t('catalog.columns.duration')" for="s-duration" :error="err('duration')">
          <InputNumber
            v-model="form.duration"
            input-id="s-duration"
            :min="5"
            :max="1440"
            :step="15"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            fluid
          />
        </FormField>
        <FormField
          :label="t('catalog.columns.capacity')"
          for="s-capacity"
          :help="facility ? t('session.maxFacility', { n: facility.capacity }) : undefined"
          :error="overCapacity ? t('session.overFacility') : err('capacity')"
        >
          <InputNumber
            v-model="form.capacity"
            input-id="s-capacity"
            :min="1"
            :max="10000"
            :invalid="overCapacity"
            show-buttons
            fluid
          />
        </FormField>
        <FormField :label="t('catalog.columns.status')" class="grid__full">
          <SelectButton
            v-model="form.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            fluid
            :aria-label="t('catalog.columns.status')"
          />
        </FormField>
      </div>

      <section v-if="!editing || pattern" class="repeat">
        <span v-if="pattern" class="repeat__title">{{ t('session.series') }}</span>
        <FormField v-if="!editing" :label="t('session.repeat')">
          <SelectButton
            v-model="repeat"
            :options="repeatOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-label="t('session.repeat')"
          />
        </FormField>
        <template v-if="repeat === 'weekly' || pattern">
          <div class="days" role="group" :aria-label="t('session.onDays')">
            <Button
              v-for="d in weekdayOrder"
              :key="d"
              size="small"
              :label="dayShort(d)"
              :severity="weekdays.includes(d) ? undefined : 'secondary'"
              :variant="weekdays.includes(d) ? undefined : 'outlined'"
              :aria-pressed="weekdays.includes(d)"
              @click="toggleDay(d)"
            />
          </div>
          <div class="every">
            <span>{{ t('session.every') }}</span>
            <InputNumber
              v-model="everyWeeks"
              :min="1"
              :max="12"
              show-buttons
              class="every__input"
              :aria-label="t('session.every')"
            />
            <span>{{ t('session.weeks') }}</span>
          </div>
          <div class="ends">
            <span class="ends__label">{{ t('session.ends') }}</span>
            <div class="ends__row">
              <RadioButton v-model="ends" input-id="ends-date" value="date" />
              <label for="ends-date">{{ t('session.onDate') }}</label>
              <DatePicker
                v-if="ends === 'date'"
                v-model="endsOn"
                :first-day-of-week="firstDayOfWeek"
                date-format="yy-mm-dd"
                :min-date="form.date ?? undefined"
                show-icon
                icon-display="input"
                class="ends__input"
                :invalid="!!err('ends_on')"
              />
            </div>
            <div v-if="!pattern" class="ends__row">
              <RadioButton v-model="ends" input-id="ends-count" value="count" />
              <label for="ends-count">{{ t('session.after') }}</label>
              <InputNumber
                v-if="ends === 'count'"
                v-model="occurrences"
                :min="1"
                :max="260"
                :suffix="` ${t('session.times')}`"
                class="ends__input"
                :invalid="!!err('occurrences')"
              />
            </div>
            <div class="ends__row">
              <RadioButton v-model="ends" input-id="ends-never" value="never" />
              <label for="ends-never"
                >{{ t('session.never') }}
                <small class="muted">{{ t('session.neverHint') }}</small></label
              >
            </div>
            <small v-if="err('ends_on') || err('occurrences') || err('weekdays')" class="error">{{
              err('ends_on') ?? err('occurrences') ?? err('weekdays')
            }}</small>
          </div>
        </template>
      </section>

      <section v-if="repeat === 'none'" class="conflicts">
        <div class="conflicts__head">
          <span class="conflicts__title">{{ t('session.conflicts') }}</span>
          <i v-if="checking" class="pi pi-spin pi-spinner muted" aria-hidden="true" />
          <Tag
            v-else-if="input() && !conflicts.length"
            class="tag-sm"
            severity="success"
            icon="pi pi-check"
            :value="t('session.noConflicts')"
          />
        </div>
        <ConflictList v-if="conflicts.length" :items="conflicts" />
        <p v-else-if="!input()" class="muted">{{ t('session.conflictsHint') }}</p>
      </section>
    </form>

    <!-- Series preview (US-03.03): each date, its flags, and a box to keep or skip it. -->
    <div v-else class="form">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
      <Message :severity="skips.length ? 'warn' : 'info'" :closable="false">
        {{ t('session.previewSummary', { make: kept.length, skip: skips.length }) }}
        <div v-if="ends === 'never'">{{ t('session.rollingNote') }}</div>
      </Message>
      <ul class="occurrences">
        <li
          v-for="(item, i) in previewItems"
          :key="item.date"
          :class="['occ', { 'occ--skipped': skips.includes(item.date) }]"
        >
          <Checkbox
            :model-value="!skips.includes(item.date)"
            binary
            :input-id="`occ-${item.date}`"
            @update:model-value="toggleSkip(item.date)"
          />
          <span class="occ__n num">#{{ i + 1 }}</span>
          <label :for="`occ-${item.date}`" class="occ__when"
            >{{ dateLabel(item.date) }} ·
            <span dir="ltr">{{ item.start }}–{{ item.end }}</span></label
          >
          <Tag
            v-for="c in item.conflicts"
            :key="c.code"
            class="tag-sm"
            :severity="c.level === 'hard' ? 'danger' : 'warn'"
            :icon="
              c.code === 'holiday' || c.code.startsWith('coach_time_off')
                ? 'pi pi-calendar-times'
                : 'pi pi-exclamation-triangle'
            "
            :value="c.who ? `${c.title} · ${c.who}` : c.title"
          />
          <Tag v-if="skips.includes(item.date)" class="tag-sm" :value="t('session.skipped')" />
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="footer">
        <Button
          v-if="previewItems"
          :label="t('wizard.back')"
          icon="pi pi-arrow-left pi-dir"
          severity="secondary"
          variant="text"
          @click="previewItems = null"
        />
        <span
          v-else-if="repeat === 'none' && conflicts.length"
          :class="['footer__state', hard ? 'footer__state--hard' : 'footer__state--soft']"
        >
          <i
            :class="['pi', hard ? 'pi-times-circle' : 'pi-exclamation-triangle']"
            aria-hidden="true"
          />
          {{ hard ? t('session.resolveToSave') : t('session.warnings', soft) }}
        </span>
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button :label="saveLabel" :loading="saving" :disabled="!canSave" @click="submit" />
      </div>
    </template>
  </Drawer>
  <EditScopeDialog
    v-model:visible="scopeOpen"
    :moved="moved"
    :summary="seriesSummary"
    :unavailable="unavailableScopes"
    :conflicts="scopeConflicts"
    :loading="saving"
    @confirm="onScope"
    @skip="onSkip"
  />
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.defaults-note {
  margin-top: -8px;
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.defaults-note i {
  font-size: 11px;
  margin-inline-end: 4px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid__full {
  grid-column: 1 / -1;
}
.fill {
  width: 100%;
}
.svc-option,
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.svc-option__name {
  flex: 1;
}
.svc-option__meta,
.opt__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.opt > span:first-child {
  flex: 1;
}
.opt__sub {
  display: block;
  font: var(--text-caption);
  color: var(--text-muted);
}
.svc-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--surface-sunken);
}
.svc-chip__name {
  flex: 1;
  font: 500 14px var(--font-sans);
}
.svc-chip__meta {
  font: var(--text-caption);
  color: var(--text-muted);
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.repeat__title {
  font: var(--text-h4);
}
.repeat {
  border-top: 1px solid var(--border-default);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.days {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.every {
  display: flex;
  align-items: center;
  gap: 8px;
}
.every__input,
.every__input :deep(input) {
  width: 110px;
  flex: none;
}
.ends {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ends__label {
  font: var(--text-small);
  font-weight: 500;
}
.ends__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 36px;
}
.ends__input,
.ends__input :deep(input) {
  width: 180px;
  flex: none;
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.occurrences {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.occ {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.occ:last-child {
  border-bottom: 0;
}
.occ--skipped {
  background: var(--surface-sunken);
}
.occ__n {
  width: 28px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.occ__when {
  flex: 1;
  font: 500 14px var(--font-sans);
  cursor: pointer;
}
.occ--skipped .occ__when {
  text-decoration: line-through;
  color: var(--text-muted);
}
.conflicts {
  border-top: 1px solid var(--border-default);
  padding-top: 16px;
}
.conflicts__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.conflicts__title {
  font: var(--text-h4);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.footer__spacer {
  flex: 1;
}
.footer__state {
  font: var(--text-small);
}
.footer__state i {
  margin-inline-end: 6px;
}
.footer__state--hard {
  color: var(--sev-danger-fg);
}
.footer__state--soft {
  color: var(--sev-warn-fg);
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
