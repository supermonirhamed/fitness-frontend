<script setup lang="ts">
// My attendance (US-11.22): a month of visits as a list or a calendar, each with its status, the
// attendance rate (excused absences left out, US-08.10) and the streak of weeks with a visit.
// Parents open a child's from the child's page (`client_id`).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppAttendance } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'

type Visit = AppAttendance['visits'][number]
const { t, locale } = useI18n()
const route = useRoute()
const format = useFormat()
const clientId = route.query.client_id ? Number(route.query.client_id) : null
const name = typeof route.query.name === 'string' ? route.query.name : null
const data = ref<AppAttendance | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const view = ref<'list' | 'calendar'>('list')
const now = new Date()
const month = ref({ year: now.getFullYear(), month: now.getMonth() })

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const range = computed(() => {
  const { year, month: m } = month.value
  return { from: ymd(year, m, 1), to: ymd(year, m, new Date(year, m + 1, 0).getDate()) }
})
const title = computed(() =>
  new Date(month.value.year, month.value.month, 1).toLocaleDateString(
    locale.value === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    { month: 'long', year: 'numeric' },
  ),
)
const isCurrent = computed(
  () => month.value.year === now.getFullYear() && month.value.month === now.getMonth(),
)
function shift(by: number) {
  const d = new Date(month.value.year, month.value.month + by, 1)
  month.value = { year: d.getFullYear(), month: d.getMonth() }
}

async function load() {
  state.value = 'loading'
  try {
    data.value = await clientApi.attendance({ ...range.value, client_id: clientId })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(month, load)

const severity = (s: Visit['status']) =>
  ({
    attended: 'success',
    late: 'warn',
    no_show: 'danger',
    excused: 'info',
    late_cancel: 'secondary',
  })[s]

// The calendar: weeks from Sunday, each day with its visits' statuses.
const weeks = computed(() => {
  const { year, month: m } = month.value
  const first = new Date(year, m, 1).getDay()
  const days = new Date(year, m + 1, 0).getDate()
  const byDay = new Map<string, Visit[]>()
  for (const v of data.value?.visits ?? []) byDay.set(v.date, [...(byDay.get(v.date) ?? []), v])
  const cells: ({ day: number; visits: Visit[] } | null)[] = Array(first).fill(null)
  for (let d = 1; d <= days; d++) cells.push({ day: d, visits: byDay.get(ymd(year, m, d)) ?? [] })
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
})
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale.value === 'ar' ? 'ar' : 'en', {
      weekday: 'narrow',
    }),
  ),
)
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">
      {{ name ? t('app.attendance.titleFor', { name }) : t('app.attendance.title') }}
    </h1>
    <div class="ca-spread">
      <Button
        icon="pi pi-angle-left pi-dir"
        variant="text"
        severity="secondary"
        :aria-label="t('app.attendance.previous')"
        @click="shift(-1)"
      />
      <strong>{{ title }}</strong>
      <Button
        icon="pi pi-angle-right pi-dir"
        variant="text"
        severity="secondary"
        :disabled="isCurrent"
        :aria-label="t('app.attendance.next')"
        @click="shift(1)"
      />
    </div>

    <template v-if="state === 'loading'">
      <div class="ca-card"><Skeleton height="80px" /></div>
      <div class="ca-card"><Skeleton height="160px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="data">
      <section class="stats">
        <div class="ca-card stat">
          <span class="ca-muted ca-small">{{ t('app.attendance.rate') }}</span>
          <strong class="ca-num big">{{
            data.summary.rate === null ? '—' : `${data.summary.rate}%`
          }}</strong>
        </div>
        <div class="ca-card stat">
          <span class="ca-muted ca-small">{{ t('app.attendance.visits') }}</span>
          <strong class="ca-num big">{{ data.summary.attended }}</strong>
        </div>
        <div class="ca-card stat">
          <span class="ca-muted ca-small">{{ t('app.attendance.streak') }}</span>
          <strong class="ca-num big"
            ><i class="pi pi-bolt" aria-hidden="true" /> {{ data.streak.current_weeks }}</strong
          >
          <span class="ca-muted ca-small">{{
            t('app.attendance.best', { n: data.streak.best_weeks })
          }}</span>
        </div>
      </section>

      <SelectButton
        v-model="view"
        :options="[
          { value: 'list', label: t('app.attendance.list') },
          { value: 'calendar', label: t('app.attendance.calendar') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        class="switch"
      />

      <template v-if="view === 'list'">
        <EmptyState
          v-if="!data.visits.length"
          icon="pi-calendar"
          :title="t('app.attendance.none')"
        />
        <ul v-else class="ca-card ca-list">
          <li v-for="v in data.visits" :key="`${v.type}-${v.id}`" class="ca-spread visit">
            <div>
              <strong>{{ v.title ?? t('app.attendance.openAccess') }}</strong>
              <p class="ca-muted ca-small">
                {{
                  [`${showDay(format, v.date)} · ${v.time}`, v.location, v.coach]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </p>
            </div>
            <Tag :severity="severity(v.status)" :value="t(`app.attendance.statuses.${v.status}`)" />
          </li>
        </ul>
      </template>
      <section v-else class="ca-card">
        <table class="cal">
          <thead>
            <tr>
              <th v-for="(d, i) in weekdays" :key="i" scope="col">{{ d }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(week, i) in weeks" :key="i">
              <td v-for="(cell, j) in week" :key="j">
                <div v-if="cell" class="day" :class="{ 'day--on': cell.visits.length }">
                  <span class="ca-num">{{ cell.day }}</span>
                  <span class="dots">
                    <span
                      v-for="v in cell.visits"
                      :key="`${v.type}-${v.id}`"
                      class="dot"
                      :class="`dot--${v.status}`"
                      :title="`${v.title ?? ''} · ${t(`app.attendance.statuses.${v.status}`)}`"
                    />
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <ul class="legend">
          <li v-for="s in ['attended', 'late', 'no_show', 'excused'] as const" :key="s">
            <span class="dot" :class="`dot--${s}`" />{{ t(`app.attendance.statuses.${s}`) }}
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
}
.big {
  font-size: 1.375rem;
}
.switch {
  align-self: center;
}
.visit {
  padding: 10px 0;
  gap: 12px;
}
.cal {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  text-align: center;
}
.cal th {
  font-weight: 500;
  color: var(--text-muted);
  font-size: 0.75rem;
  padding-bottom: 6px;
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border-radius: 8px;
  min-height: 40px;
  font-size: 0.875rem;
}
.day--on {
  background: var(--surface-100);
}
.dots {
  display: flex;
  gap: 2px;
  min-height: 6px;
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot--attended {
  background: var(--sev-success-solid, #16a34a);
}
.dot--late {
  background: var(--sev-warn-solid, #d97706);
}
.dot--no_show {
  background: var(--sev-danger-solid, #dc2626);
}
.dot--excused {
  background: var(--sev-info-solid, #2563eb);
}
.dot--late_cancel {
  background: var(--text-muted);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
