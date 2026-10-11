<script setup lang="ts">
// My schedule (US-03.14): a staff member's own sessions and appointments at every branch they work
// at, with their weekly availability and time off, as a phone-first agenda (Breakdown §17). The
// calendar link keeps it in their own calendar app (iCal).
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type CalendarSession, type MySchedule } from '@/api/tenant'
import { addDays, todayIn, weekday } from '@/lib/calendar'
import { zoneAbbreviation } from '@/lib/datetime'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const DAYS = 14
const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const auth = useStaffAuth()
const org = useOrganization()

const timezone = computed(
  () => auth.currentLocation?.timezone ?? org.organization?.timezone ?? 'Asia/Riyadh',
)
const today = computed(() => todayIn(timezone.value))
const from = ref(today.value)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const data = ref<MySchedule | null>(null)

async function load() {
  state.value = 'loading'
  try {
    data.value = await tenantApi.mySchedule.schedule(from.value, DAYS)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(from, load)

const days = computed(() => Array.from({ length: DAYS }, (_, i) => addDays(from.value, i)))
// Several time zones among my branches: show each session's zone.
const zones = computed(
  () => new Set((data.value?.sessions ?? []).map((s) => s.location.timezone)).size > 1,
)
const sessionsOn = (ymd: string) => (data.value?.sessions ?? []).filter((s) => s.local.date === ymd)
const availabilityOn = (ymd: string) =>
  (data.value?.availability ?? [])
    .map((a) => ({ name: a.location.name, ranges: a.weekly[String(weekday(ymd))] ?? [] }))
    .filter((a) => a.ranges.length)
const timeOffOn = (ymd: string) =>
  (data.value?.time_off ?? []).filter((o) => {
    const start = new Date(o.starts_at)
    const end = new Date(o.ends_at)
    const dayStart = new Date(`${ymd}T00:00:00`)
    const dayEnd = new Date(`${addDays(ymd, 1)}T00:00:00`)
    return start < dayEnd && end > dayStart
  })
const shownDays = computed(() =>
  days.value.filter((d) => sessionsOn(d).length || timeOffOn(d).length || d === today.value),
)
const next = computed(() =>
  (data.value?.sessions ?? []).find(
    (s) => s.status !== 'Cancelled' && Date.parse(s.ends_at) > Date.now(),
  ),
)
const role = (s: CalendarSession) =>
  s.coaches[0]?.id === auth.user?.id ? null : t('calendar.assistant')

const dayLabel = (ymd: string) => {
  if (ymd === today.value) return t('mySchedule.today')
  if (ymd === addDays(today.value, 1)) return t('mySchedule.tomorrow')
  return new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${ymd}T12:00:00Z`))
}
const period = computed(() => {
  const f = (ymd: string) =>
    new Intl.DateTimeFormat(locale.value, {
      numberingSystem: 'latn',
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${ymd}T12:00:00Z`))
  return `${f(from.value)} – ${f(addDays(from.value, DAYS - 1))}`
})
const open = (s: CalendarSession) => router.push({ name: 'tenant.session', params: { id: s.id } })

// Calendar link (iCal): shown once when made; only a new one can be shown later.
const feedUrl = ref<string | null>(null)
const feedBusy = ref(false)
async function newFeed() {
  feedBusy.value = true
  try {
    feedUrl.value = (await tenantApi.mySchedule.newCalendarFeed()).url
    if (data.value) data.value.feed = true
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    feedBusy.value = false
  }
}
async function revokeFeed() {
  feedBusy.value = true
  try {
    await tenantApi.mySchedule.revokeCalendarFeed()
    feedUrl.value = null
    if (data.value) data.value.feed = false
    toast.add({ severity: 'info', summary: t('mySchedule.feedStopped'), life: 4000 })
  } finally {
    feedBusy.value = false
  }
}
async function copy() {
  if (!feedUrl.value) return
  try {
    await navigator.clipboard.writeText(feedUrl.value)
    toast.add({ severity: 'success', summary: t('mySchedule.copied'), life: 3000 })
  } catch {
    /* the field stays selectable */
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('mySchedule.title')">
      <template #meta>
        <span>{{ t('mySchedule.subtitle') }}</span>
      </template>
    </PageHeader>

    <div
      v-if="next && state === 'ready'"
      class="next"
      role="button"
      tabindex="0"
      @click="open(next)"
      @keydown.enter="open(next)"
    >
      <span class="next__label">{{ t('mySchedule.nextUp') }}</span>
      <span class="next__title">
        <span
          class="swatch"
          :style="{ background: next.service.color ?? 'var(--svc-1)' }"
          aria-hidden="true"
        />
        {{ next.service.name }}
      </span>
      <span class="next__meta">
        {{ dayLabel(next.local.date) }} ·
        <span dir="ltr" class="num">{{ next.local.start }}–{{ next.local.end }}</span>
        · {{ next.facility.name }}, {{ next.location.name }}
      </span>
    </div>

    <div class="bar">
      <Button
        :label="t('calendar.today')"
        severity="secondary"
        variant="outlined"
        size="small"
        :disabled="from === today"
        @click="from = today"
      />
      <Button
        icon="pi pi-chevron-left pi-dir"
        severity="secondary"
        variant="text"
        size="small"
        :aria-label="t('calendar.previous')"
        @click="from = addDays(from, -DAYS)"
      />
      <span class="bar__period">{{ period }}</span>
      <Button
        icon="pi pi-chevron-right pi-dir"
        severity="secondary"
        variant="text"
        size="small"
        :aria-label="t('calendar.next')"
        @click="from = addDays(from, DAYS)"
      />
    </div>

    <div v-if="state === 'loading' && !data" class="card agenda" aria-busy="true">
      <div v-for="n in 4" :key="n" class="row">
        <Skeleton width="30%" /><Skeleton width="60%" />
      </div>
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('mySchedule.loadError')"
      @retry="load"
    />
    <div v-else class="card agenda">
      <EmptyState
        v-if="!data?.sessions.length && !data?.time_off.length"
        compact
        icon="pi-calendar"
        :title="t('mySchedule.empty')"
        :body="t('mySchedule.emptyHint')"
      />
      <section v-for="d in shownDays" :key="d" class="day">
        <h2 :class="['day__title', { 'day__title--today': d === today }]">{{ dayLabel(d) }}</h2>
        <p v-for="a in availabilityOn(d)" :key="a.name ?? ''" class="day__avail">
          <i class="pi pi-clock" aria-hidden="true" />{{
            t('mySchedule.available', { branch: a.name })
          }}
          <span dir="ltr" class="num">{{
            a.ranges.map((r) => `${r.start}–${r.end}`).join(', ')
          }}</span>
        </p>
        <p
          v-for="(o, i) in timeOffOn(d)"
          :key="`off-${i}`"
          :class="['day__off', { 'day__off--pending': o.status === 'Pending' }]"
        >
          <i class="pi pi-calendar-times" aria-hidden="true" />{{
            o.status === 'Pending' ? t('mySchedule.timeOffPending') : t('mySchedule.timeOff')
          }}<template v-if="o.reason"> · {{ o.reason }}</template>
        </p>
        <p v-if="!sessionsOn(d).length && !timeOffOn(d).length" class="day__none">
          {{ t('mySchedule.nothing') }}
        </p>
        <button
          v-for="s in sessionsOn(d)"
          :key="s.id"
          type="button"
          :class="['item', { 'item--cancelled': s.status === 'Cancelled' }]"
          @click="open(s)"
        >
          <span class="item__time num" dir="ltr">
            {{ s.local.start }}<small>{{ s.local.end }}</small>
            <small v-if="zones" class="item__zone">{{
              zoneAbbreviation(s.location.timezone, locale)
            }}</small>
          </span>
          <span
            class="item__bar"
            :style="{ background: s.service.color ?? 'var(--svc-1)' }"
            aria-hidden="true"
          />
          <span class="item__text">
            <span class="item__name">{{ s.service.name }}</span>
            <span class="item__where">
              {{ s.facility.name }} · {{ s.location.name }}
              <template v-if="role(s)"> · {{ role(s) }}</template>
            </span>
            <span class="item__count num">{{ s.booked }} / {{ s.capacity ?? '∞' }}</span>
          </span>
          <StatusTag :status="s.status" size="sm" />
        </button>
      </section>
    </div>

    <section class="card feed">
      <div class="feed__head">
        <i class="pi pi-calendar-plus" aria-hidden="true" />
        <div>
          <h2 class="feed__title">{{ t('mySchedule.feedTitle') }}</h2>
          <p class="feed__hint">{{ t('mySchedule.feedHint') }}</p>
        </div>
      </div>
      <template v-if="feedUrl">
        <div class="feed__url">
          <InputText
            :model-value="feedUrl"
            readonly
            dir="ltr"
            fluid
            :aria-label="t('mySchedule.feedTitle')"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <Button
            icon="pi pi-copy"
            :label="t('mySchedule.copy')"
            severity="secondary"
            @click="copy"
          />
        </div>
        <Message severity="warn" :closable="false" icon="pi pi-lock">{{
          t('mySchedule.feedPrivate')
        }}</Message>
      </template>
      <div class="feed__actions">
        <Button
          v-if="!data?.feed"
          icon="pi pi-link"
          :label="t('mySchedule.feedCreate')"
          :loading="feedBusy"
          @click="newFeed"
        />
        <template v-else>
          <Button
            icon="pi pi-refresh"
            :label="t('mySchedule.feedRenew')"
            severity="secondary"
            variant="outlined"
            :loading="feedBusy"
            @click="newFeed"
          />
          <Button
            icon="pi pi-times"
            :label="t('mySchedule.feedStop')"
            severity="danger"
            variant="text"
            :loading="feedBusy"
            @click="revokeFeed"
          />
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.next {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--radius-card);
  background: var(--primary-subtle);
  border: 1px solid var(--primary);
  cursor: pointer;
}
.next__label {
  font: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.next__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 600 18px/1.3 var(--font-sans);
}
.next__meta {
  font: var(--text-small);
  color: var(--text-secondary);
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bar__period {
  font: 600 14px var(--font-sans);
  padding: 0 4px;
}
.agenda {
  overflow: hidden;
}
.row {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}
.day {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.day:last-child {
  border-bottom: 0;
}
.day__title {
  margin: 0;
  font: var(--text-h4);
}
.day__title--today {
  color: var(--primary);
}
.day__avail,
.day__off,
.day__none {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.day__avail i,
.day__off i {
  font-size: 12px;
  margin-inline-end: 6px;
}
.day__avail .num {
  margin-inline-start: 6px;
}
.day__off {
  color: var(--sev-danger-fg);
}
.day__off--pending {
  color: var(--sev-warn-fg);
}
.day__none {
  color: var(--text-muted);
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px; /* a comfortable tap target on phones */
  padding: 8px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.item:hover {
  background: var(--surface-hover, var(--surface-sunken));
}
.item__time {
  display: flex;
  flex-direction: column;
  width: 52px;
  font: 600 15px/1.2 var(--font-sans);
}
.item__time small {
  font: var(--text-caption);
  color: var(--text-muted);
}
.item__bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
}
.item__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.item__name {
  font: 500 15px/1.3 var(--font-sans);
}
.item__where,
.item__count {
  font: var(--text-small);
  color: var(--text-secondary);
}
.item--cancelled .item__name {
  text-decoration: line-through;
  color: var(--text-muted);
}
.feed {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.feed__head {
  display: flex;
  gap: 12px;
}
.feed__head > i {
  font-size: 20px;
  color: var(--primary);
  margin-top: 2px;
}
.feed__title {
  margin: 0;
  font: var(--text-h4);
}
.feed__hint {
  margin: 4px 0 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.feed__url {
  display: flex;
  gap: 8px;
}
.feed__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 560px) {
  .feed__url {
    flex-direction: column;
  }
}
</style>
