<script setup lang="ts">
// Facility availability (US-01.11): a day or week timeline of one facility in its branch's
// timezone, with opening hours, closures, sessions, blocked time and buffers. A free slot
// offers "Block this time" and, once the schedule exists (US-03.02), "Create session here".
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import BlockTimeDialog from '@/components/locations/BlockTimeDialog.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import {
  tenantApi,
  type AvailabilityDay,
  type Facility,
  type FacilityAvailability,
  type FacilityReservation,
} from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { DAY_KEYS, todayIn } from '@/lib/businessHours'
import {
  addDays,
  isFree,
  openRanges,
  segmentsOf,
  SLOT_MINUTES,
  startOfWeek,
  timeOf,
  visibleHours,
  weekday,
  type Segment,
} from '@/lib/timeline'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const org = useOrganization()
const auth = useStaffAuth()
const canBlock = computed(() => auth.can('locations.update'))

/** Pixels per minute of the timeline. */
const SCALE = 1.2

const facility = ref<Facility | null>(null)
const siblings = ref<{ value: number; label: string }[]>([])
const data = ref<FacilityAvailability | null>(null)
const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')

const view = computed<'day' | 'week'>(() => (route.query.view === 'day' ? 'day' : 'week'))
const timezone = computed(
  () => facility.value?.location?.timezone ?? org.organization?.timezone ?? 'UTC',
)
const anchor = computed(() =>
  typeof route.query.date === 'string' ? route.query.date : todayIn(timezone.value),
)
const days = computed(() => {
  const first =
    view.value === 'day'
      ? anchor.value
      : startOfWeek(anchor.value, org.organization?.week_start ?? 0)
  return Array.from({ length: view.value === 'day' ? 1 : 7 }, (_, i) => addDays(first, i))
})
const today = computed(() => todayIn(timezone.value))

function go(query: Record<string, string>) {
  router.replace({ query: { ...route.query, ...query } })
}
const viewOptions = computed(() => [
  { value: 'day', label: t('availability.day') },
  { value: 'week', label: t('availability.week') },
])
const step = (n: number) => go({ date: addDays(anchor.value, n * (view.value === 'day' ? 1 : 7)) })

async function loadFacility() {
  state.value = 'loading'
  try {
    facility.value = await tenantApi.facilities.get(props.id)
    const all = await tenantApi.facilities.list({ location_id: facility.value.location_id })
    siblings.value = all.flatMap((f) => [
      { value: f.id, label: f.name },
      ...(f.sub_areas ?? []).map((s) => ({ value: s.id!, label: `${f.name} › ${s.name}` })),
    ])
    await load()
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
async function load() {
  try {
    data.value = await tenantApi.facilities.availability(
      props.id,
      days.value[0]!,
      days.value[days.value.length - 1]!,
    )
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(loadFacility)
watch(() => props.id, loadFacility)
watch(days, () => facility.value && load())

const segments = computed<Segment[]>(() =>
  data.value
    ? data.value.reservations.flatMap((r) => segmentsOf(r, days.value, timezone.value))
    : [],
)
const range = computed(() => visibleHours(data.value?.days ?? [], segments.value))
const height = computed(() => (range.value.to - range.value.from) * SCALE)
const hourMarks = computed(() => {
  const marks: number[] = []
  for (let m = range.value.from; m < range.value.to; m += 60) marks.push(m)
  return marks
})
const top = (minutes: number) =>
  `${(Math.max(minutes, range.value.from) - range.value.from) * SCALE}px`
const span = (from: number, to: number) =>
  `${(Math.min(to, range.value.to) - Math.max(from, range.value.from)) * SCALE}px`

/** Shaded parts of a day: outside its opening ranges. */
function closedParts(day: AvailabilityDay) {
  const parts: { from: number; to: number }[] = []
  let cursor = range.value.from
  for (const r of openRanges(day).sort((a, b) => a.from - b.from)) {
    if (r.from > cursor) parts.push({ from: cursor, to: Math.min(r.from, range.value.to) })
    cursor = Math.max(cursor, r.to)
  }
  if (cursor < range.value.to) parts.push({ from: cursor, to: range.value.to })
  return parts.filter((p) => p.to > p.from)
}
function freeSlots(day: AvailabilityDay) {
  const slots: number[] = []
  for (let m = range.value.from; m < range.value.to; m += SLOT_MINUTES) {
    if (isFree(day, m, m + SLOT_MINUTES, segments.value)) slots.push(m)
  }
  return slots
}
const daySegments = (date: string) => segments.value.filter((s) => s.date === date)
const dayTitle = (ymd: string) => t(`regional.days.${DAY_KEYS[weekday(ymd)]}`)
const dayDate = (ymd: string) => format.date(`${ymd}T00:00:00Z`, 'UTC')
const rangeTitle = computed(() =>
  days.value.length === 1
    ? dayDate(days.value[0]!)
    : `${dayDate(days.value[0]!)} – ${dayDate(days.value[6]!)}`,
)
const otherFacility = (r: FacilityReservation) => r.facility_id !== props.id

// Free slot menu
const slotMenu = ref<InstanceType<typeof Menu>>()
const picked = ref<{ date: string; start: string; end: string } | null>(null)
const slotItems = computed(() => [
  {
    label: t('availability.blockHere'),
    icon: 'pi pi-ban',
    disabled: !canBlock.value,
    command: () => (blockOpen.value = true),
  },
  {
    // US-03.02 (Create session) arrives with the schedule (EP-03).
    label: t('availability.createSession'),
    icon: 'pi pi-calendar-plus',
    disabled: true,
  },
])
function pickSlot(event: Event, date: string, minutes: number) {
  picked.value = { date, start: timeOf(minutes), end: timeOf((minutes + 60) % 1440) }
  slotMenu.value?.toggle(event)
}

// Blocks
const blockOpen = ref(false)
function onBlocked(block: FacilityReservation) {
  toast.add({
    severity: 'success',
    summary: t('blockTime.done', { title: block.title }),
    life: 3000,
  })
  load()
}
const removing = ref<FacilityReservation | null>(null)
const removeOpen = ref(false)
const removeBusy = ref(false)
const removeError = ref<string | null>(null)
function openReservation(r: FacilityReservation) {
  if (r.kind !== 'block' || !canBlock.value) return
  removing.value = r
  removeError.value = null
  removeOpen.value = true
}
async function unblock() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await tenantApi.facilities.unblock(removing.value.facility_id, removing.value.id)
    removeOpen.value = false
    load()
  } catch {
    removeError.value = t('common.genericError')
  } finally {
    removeBusy.value = false
  }
}
const timeRange = (r: FacilityReservation) =>
  `${format.time(r.starts_at, timezone.value)}–${format.time(r.ends_at, timezone.value)}`
</script>

<template>
  <div class="page">
    <RouterLink
      v-if="facility"
      :to="{
        name: 'tenant.locations.show',
        params: { id: facility.location_id },
        query: { tab: 'facilities' },
      }"
      class="back"
    >
      <i class="pi pi-arrow-left pi-dir" aria-hidden="true" />{{
        facility.location?.name ?? t('locationDetails.back')
      }}
    </RouterLink>

    <div
      v-if="state === 'loading' && !data"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="48px" width="40%" />
      <Skeleton height="400px" />
    </div>
    <EmptyState
      v-else-if="state === 'missing'"
      icon="pi-lock"
      :title="t('availability.missing')"
      :body="t('locationDetails.missingHint')"
    />
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('availability.loadError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        :label="t('common.retry')"
        @click="loadFacility"
      />
    </EmptyState>

    <template v-else-if="facility && data">
      <PageHeader :title="t('availability.title', { name: facility.name })">
        <template #status>
          <span class="zone" dir="ltr"
            ><i class="pi pi-clock" aria-hidden="true" />{{ timezone }}</span
          >
        </template>
      </PageHeader>

      <div class="toolbar">
        <Select
          :model-value="id"
          :options="siblings"
          option-label="label"
          option-value="value"
          :aria-label="t('availability.facility')"
          class="facility-select"
          @update:model-value="
            (v: number) =>
              router.replace({
                name: 'tenant.facilities.availability',
                params: { id: v },
                query: route.query,
              })
          "
        />
        <SelectButton
          :model-value="view"
          :options="viewOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          size="small"
          @update:model-value="(v: string) => go({ view: v })"
        />
        <div class="nav">
          <Button
            icon="pi pi-chevron-left pi-dir"
            severity="secondary"
            variant="text"
            rounded
            :aria-label="t('availability.previous')"
            @click="step(-1)"
          />
          <Button
            :label="t('availability.today')"
            severity="secondary"
            variant="outlined"
            size="small"
            @click="go({ date: today })"
          />
          <Button
            icon="pi pi-chevron-right pi-dir"
            severity="secondary"
            variant="text"
            rounded
            :aria-label="t('availability.next')"
            @click="step(1)"
          />
          <span class="range-title">{{ rangeTitle }}</span>
        </div>
      </div>

      <ul class="legend">
        <li><span class="swatch session" />{{ t('availability.legend.session') }}</li>
        <li><span class="swatch block" />{{ t('availability.legend.block') }}</li>
        <li><span class="swatch buffer" />{{ t('availability.legend.buffer') }}</li>
        <li><span class="swatch closed" />{{ t('availability.legend.closed') }}</li>
      </ul>

      <div class="timeline" :class="view" :aria-busy="state === 'loading'">
        <div class="head gutter" />
        <div
          v-for="day in data.days"
          :key="`h-${day.date}`"
          class="head"
          :class="{ today: day.date === today }"
        >
          <span class="dow">{{ dayTitle(day.date) }}</span>
          <span class="date">{{ dayDate(day.date) }}</span>
          <span v-if="day.override" class="override" :class="{ closed: day.override.closed }">
            <i
              :class="['pi', day.override.closed ? 'pi-calendar-times' : 'pi-clock']"
              aria-hidden="true"
            />
            {{ day.override.label }}
          </span>
        </div>

        <div class="gutter" :style="{ height: `${height}px` }">
          <span v-for="m in hourMarks" :key="m" class="hour" :style="{ top: top(m) }">{{
            timeOf(m)
          }}</span>
        </div>
        <div
          v-for="day in data.days"
          :key="day.date"
          class="column"
          :style="{ height: `${height}px` }"
        >
          <span v-for="m in hourMarks" :key="m" class="line" :style="{ top: top(m) }" />
          <div
            v-for="(p, i) in closedParts(day)"
            :key="`c-${i}`"
            class="closed"
            :style="{ top: top(p.from), height: span(p.from, p.to) }"
          />
          <button
            v-for="m in freeSlots(day)"
            :key="`s-${m}`"
            type="button"
            class="slot"
            :style="{ top: top(m), height: span(m, m + SLOT_MINUTES) }"
            :aria-label="t('availability.freeSlot', { day: dayTitle(day.date), time: timeOf(m) })"
            aria-haspopup="menu"
            @click="pickSlot($event, day.date, m)"
          >
            <i class="pi pi-plus" aria-hidden="true" />
          </button>
          <div
            v-for="s in daySegments(day.date)"
            :key="`r-${s.reservation.id}`"
            class="reservation"
            :class="[
              s.reservation.kind,
              {
                other: otherFacility(s.reservation),
                clickable: s.reservation.kind === 'block' && canBlock,
              },
            ]"
            :style="{ top: top(s.from), height: span(s.from, s.to) }"
            :role="s.reservation.kind === 'block' && canBlock ? 'button' : undefined"
            :tabindex="s.reservation.kind === 'block' && canBlock ? 0 : undefined"
            @click="openReservation(s.reservation)"
            @keydown.enter="openReservation(s.reservation)"
          >
            <div
              class="body"
              :style="{
                top: `${(s.start - s.from) * SCALE}px`,
                bottom: `${(s.to - s.end) * SCALE}px`,
              }"
            >
              <span class="title">{{ s.reservation.title }}</span>
              <span class="time">{{ timeRange(s.reservation) }}</span>
              <span v-if="s.reservation.coach || otherFacility(s.reservation)" class="time">
                {{
                  [
                    s.reservation.coach,
                    otherFacility(s.reservation) ? s.reservation.facility : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p class="note">{{ t('availability.note') }}</p>

      <Menu ref="slotMenu" :model="slotItems" popup>
        <template #item="{ item, props: itemProps }">
          <a v-bind="itemProps.action" class="menu-item">
            <i :class="item.icon" aria-hidden="true" />
            <span>
              {{ item.label }}
              <small v-if="item.label === t('availability.createSession')">{{
                t('availability.createSessionSoon')
              }}</small>
            </span>
          </a>
        </template>
      </Menu>
      <BlockTimeDialog
        v-model:visible="blockOpen"
        :facility-id="id"
        :facility-name="facility.name"
        :timezone="timezone"
        :initial="picked"
        @blocked="onBlocked"
      />
      <ConfirmActionDialog
        v-model:visible="removeOpen"
        :title="t('availability.unblockTitle', { title: removing?.title ?? '' })"
        :description="
          removing ? `${dayDate(removing.starts_at.slice(0, 10))} · ${timeRange(removing)}` : ''
        "
        :confirm-label="t('availability.unblock')"
        destructive
        :loading="removeBusy"
        :error="removeError"
        @confirm="unblock"
      />
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  text-decoration: none;
  width: fit-content;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.zone {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-caption);
  color: var(--text-muted);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.facility-select {
  min-width: 220px;
}
.nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.range-title {
  margin-inline-start: var(--space-2);
  font-weight: var(--fw-medium);
}
.legend {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  list-style: none;
  font: var(--text-caption);
  color: var(--text-muted);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--border-default);
}
.swatch.session {
  background: var(--primary);
}
.swatch.block {
  background: repeating-linear-gradient(
    45deg,
    var(--surface-sunken),
    var(--surface-sunken) 3px,
    var(--border-default) 3px,
    var(--border-default) 5px
  );
}
.swatch.buffer {
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    color-mix(in srgb, var(--primary) 35%, transparent) 3px,
    color-mix(in srgb, var(--primary) 35%, transparent) 5px
  );
}
.swatch.closed {
  background: var(--surface-sunken);
}
.timeline {
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(110px, 1fr));
  overflow-x: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}
.timeline.day {
  grid-template-columns: 56px 1fr;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-default);
  border-inline-start: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  background: var(--surface-card);
  z-index: 2;
}
.head.gutter {
  border-inline-start: 0;
}
.head.today .dow {
  color: var(--primary);
}
.dow {
  font-weight: var(--fw-semibold);
}
.date {
  font: var(--text-caption);
  color: var(--text-muted);
}
.override {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-caption);
  color: var(--text-secondary);
}
.override.closed {
  color: var(--sev-danger-fg);
}
.gutter {
  position: relative;
}
.hour {
  position: absolute;
  inset-inline-end: var(--space-2);
  transform: translateY(-50%);
  font: var(--text-caption);
  color: var(--text-muted);
  direction: ltr;
}
.hour:first-child {
  transform: none;
}
.column {
  position: relative;
  border-inline-start: 1px solid var(--border-subtle);
}
.line {
  position: absolute;
  inset-inline: 0;
  border-top: 1px dashed var(--border-subtle);
}
.closed {
  position: absolute;
  inset-inline: 0;
  background: var(--surface-sunken);
}
.slot {
  position: absolute;
  inset-inline: 2px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: transparent;
  cursor: pointer;
  z-index: 1;
}
.slot:hover,
.slot:focus-visible {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
}
.reservation {
  position: absolute;
  inset-inline: 3px;
  border-radius: 6px;
  overflow: hidden;
  z-index: 1;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 4px,
    color-mix(in srgb, var(--primary) 30%, transparent) 4px,
    color-mix(in srgb, var(--primary) 30%, transparent) 7px
  );
}
.reservation .body {
  position: absolute;
  inset-inline: 0;
  display: flex;
  flex-direction: column;
  padding: 2px var(--space-2);
  border-radius: 6px;
  background: var(--primary);
  color: var(--primary-contrast, #fff);
  overflow: hidden;
}
.reservation.block {
  background: transparent;
}
.reservation.block .body {
  background: repeating-linear-gradient(
    45deg,
    var(--surface-sunken),
    var(--surface-sunken) 4px,
    var(--border-default) 4px,
    var(--border-default) 6px
  );
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.reservation.other .body {
  opacity: 0.75;
}
.reservation.clickable {
  cursor: pointer;
}
.reservation .title {
  font: var(--text-caption);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.reservation .time {
  font: var(--text-caption);
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.menu-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}
.menu-item small {
  display: block;
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
