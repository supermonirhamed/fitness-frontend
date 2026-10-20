<script setup lang="ts">
// Browse classes (US-11.08): a strip of days up to the booking horizon, filters (branch, category,
// class, coach, time of day, level, search), and each class's time in its branch's zone, coach,
// place, places left and price — or "Included in your membership".
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import BookTabs from '@/components/app/BookTabs.vue'
import ForWhom from '@/components/app/ForWhom.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi, type AppCatalog, type AppSession, type ScheduleFilters } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { addDays } from '@/lib/academy'
import { useClientApp } from '@/stores/clientApp'

const { t, locale } = useI18n()
const route = useRoute()
const format = useFormat()
const app = useClientApp()

const today = new Intl.DateTimeFormat('en-CA', { timeZone: app.config?.timezone }).format(
  new Date(),
)
const catalog = ref<AppCatalog | null>(null)
const days = computed(() =>
  Array.from({ length: catalog.value?.days_ahead ?? 14 }, (_, i) => addDays(today, i)),
)
const date = ref(today)
// Browsing for a child shows what they can book (US-11.25).
const forWhom = ref<number | null>(Number(route.query.client_id) || null)
const filters = ref<ScheduleFilters>({
  service_id: Number(route.query.service_id) || null,
  location_id: null,
  category_id: null,
  coach_id: null,
  time_of_day: null,
  level: null,
  q: null,
})
const activeFilters = computed(
  () =>
    Object.entries(filters.value).filter(([k, v]) => k !== 'q' && v !== null && v !== '').length,
)
const filtersOpen = ref(false)
const sessions = ref<AppSession[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')

const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(d),
    day: d.getUTCDate(),
  }
}
const spots = (s: AppSession) => {
  if (s.state === 'full_waitlist' || (s.state === 'full' && s.spots_left === 0))
    return t('app.schedule.full')
  if (s.spots_left === null) return null
  return t('app.schedule.spotsLeft', { n: s.spots_left }, s.spots_left)
}
const spotsSeverity = (s: AppSession) =>
  s.spots_left === 0 ? 'danger' : s.state === 'almost' ? 'warn' : 'secondary'
const price = (s: AppSession) =>
  !s.price
    ? null
    : s.price.kind === 'included'
      ? t('app.price.included')
      : s.price.kind === 'free'
        ? t('app.price.free')
        : format.money(s.price.amount ?? 0)

async function load() {
  state.value = 'loading'
  try {
    sessions.value = await clientApi.day(date.value, { ...filters.value, client_id: forWhom.value })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  catalog.value = await clientApi.catalog().catch(() => null)
  load()
})
watch([date, forWhom], load)
let search: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.value.q,
  () => {
    clearTimeout(search)
    search = setTimeout(load, 300)
  },
)
function applyFilters() {
  filtersOpen.value = false
  load()
}
function clearFilters() {
  filters.value = { q: filters.value.q }
  applyFilters()
}
const options = (items: { id: number; name: string | null }[] | undefined) =>
  (items ?? []).map((i) => ({ value: i.id, label: i.name ?? '' }))
</script>

<template>
  <div class="ca-stack">
    <div class="ca-spread">
      <h1 class="ca-title">{{ t('app.schedule.title') }}</h1>
      <Button
        icon="pi pi-filter"
        :label="t('app.schedule.filters')"
        variant="outlined"
        size="small"
        :badge="activeFilters ? String(activeFilters) : undefined"
        @click="filtersOpen = true"
      />
    </div>
    <BookTabs />
    <ForWhom v-model="forWhom" />
    <IconField>
      <InputIcon class="pi pi-search" />
      <InputText v-model="filters.q" :placeholder="t('app.schedule.search')" fluid />
    </IconField>
    <div class="days" role="tablist" :aria-label="t('app.schedule.days')">
      <button
        v-for="d in days"
        :key="d"
        type="button"
        role="tab"
        class="day"
        :aria-selected="d === date"
        @click="date = d"
      >
        <span class="day__weekday">{{
          d === today ? t('app.schedule.today') : dayLabel(d).weekday
        }}</span>
        <span class="day__num ca-num">{{ dayLabel(d).day }}</span>
      </button>
    </div>

    <template v-if="state === 'loading'">
      <div v-for="i in 3" :key="i" class="ca-card"><Skeleton height="56px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="!sessions.length" class="ca-card">
      <EmptyState
        compact
        icon="pi-calendar"
        :title="t('app.schedule.none')"
        :body="activeFilters ? t('app.schedule.noneFiltered') : t('app.schedule.noneHint')"
      />
    </div>
    <ul v-else class="ca-stack sessions">
      <li v-for="s in sessions" :key="s.id">
        <RouterLink
          :to="{
            name: 'app.session',
            params: { id: s.id },
            query: forWhom ? { client_id: forWhom } : {},
          }"
          class="session ca-card"
        >
          <span class="stripe" :style="{ background: s.service.color ?? 'var(--primary)' }" />
          <div class="time">
            <strong class="ca-num">{{ s.time }}</strong>
            <span class="ca-muted ca-small">{{
              t('app.schedule.minutes', { n: s.duration })
            }}</span>
          </div>
          <div class="body">
            <strong>{{ s.service.name }}</strong>
            <span class="ca-muted ca-small">{{
              [s.coach?.name, s.location.name, s.facility].filter(Boolean).join(' · ')
            }}</span>
            <span class="tags">
              <Tag
                v-if="s.mine?.state === 'booked'"
                severity="success"
                icon="pi pi-check"
                :value="t('app.schedule.booked')"
              />
              <Tag
                v-else-if="s.mine?.state === 'waitlisted'"
                severity="info"
                :value="t('app.schedule.waitlisted', { n: s.mine.position })"
              />
              <Tag v-else-if="spots(s)" :severity="spotsSeverity(s)" :value="spots(s)!" />
              <span v-if="price(s)" class="ca-small price">{{ price(s) }}</span>
            </span>
          </div>
          <i class="pi pi-angle-right pi-dir ca-muted" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>

    <Drawer
      v-model:visible="filtersOpen"
      position="bottom"
      :header="t('app.schedule.filters')"
      class="filters"
    >
      <div class="ca-form">
        <FormField
          v-if="(catalog?.locations.length ?? 0) > 1"
          :label="t('app.schedule.branch')"
          for="f-loc"
        >
          <Select
            v-model="filters.location_id"
            input-id="f-loc"
            :options="options(catalog?.locations)"
            option-label="label"
            option-value="value"
            show-clear
            fluid
          />
        </FormField>
        <FormField :label="t('app.schedule.category')" for="f-cat">
          <Select
            v-model="filters.category_id"
            input-id="f-cat"
            :options="options(catalog?.categories)"
            option-label="label"
            option-value="value"
            show-clear
            fluid
          />
        </FormField>
        <FormField :label="t('app.schedule.class')" for="f-svc">
          <Select
            v-model="filters.service_id"
            input-id="f-svc"
            :options="options(catalog?.services)"
            option-label="label"
            option-value="value"
            show-clear
            filter
            fluid
          />
        </FormField>
        <FormField v-if="catalog?.coaches.length" :label="t('app.schedule.coach')" for="f-coach">
          <Select
            v-model="filters.coach_id"
            input-id="f-coach"
            :options="options(catalog?.coaches)"
            option-label="label"
            option-value="value"
            show-clear
            fluid
          />
        </FormField>
        <FormField :label="t('app.schedule.timeOfDay')">
          <SelectButton
            v-model="filters.time_of_day"
            :options="
              ['morning', 'afternoon', 'evening'].map((v) => ({
                value: v,
                label: t(`app.schedule.times.${v}`),
              }))
            "
            option-label="label"
            option-value="value"
          />
        </FormField>
        <FormField :label="t('app.schedule.level')">
          <SelectButton
            v-model="filters.level"
            :options="
              ['Beginner', 'Intermediate', 'Advanced'].map((v) => ({
                value: v,
                label: t(`app.levels.${v}`),
              }))
            "
            option-label="label"
            option-value="value"
          />
        </FormField>
        <div class="ca-row">
          <Button
            :label="t('app.schedule.clear')"
            variant="text"
            severity="secondary"
            @click="clearFilters"
          />
          <Button :label="t('app.schedule.apply')" class="grow" @click="applyFilters" />
        </div>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.days {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.day {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 52px;
  padding: 8px 6px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
}
.day[aria-selected='true'] {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.day__weekday {
  font-size: 0.75rem;
}
.day__num {
  font-weight: 600;
  font-size: 1.125rem;
}
.sessions {
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}
.session {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  color: var(--text-primary);
  text-decoration: none;
}
.stripe {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
.time {
  display: flex;
  flex-direction: column;
  min-width: 56px;
}
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.price {
  font-weight: 600;
}
.grow {
  flex: 1;
}
</style>
