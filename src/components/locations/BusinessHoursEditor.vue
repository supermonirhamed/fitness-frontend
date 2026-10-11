<script setup lang="ts">
// Weekly business hours of a branch (US-01.06): each day closed or one or more time ranges, in
// the branch's timezone. Sessions outside them get a warning; appointment slots stay inside.
// Laid out as the design's hours grid (BranchDetails.jsx HoursTab): one row per day.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import TimeField from '@/components/patterns/TimeField.vue'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusBanner from '@/components/patterns/StatusBanner.vue'
import { zoneAbbreviation } from '@/lib/datetime'
import { tenantApi, type TimeRange, type WeeklyHours } from '@/api/tenant'
import { validationErrors } from '@/lib/http'
import { DAY_KEYS, dayError, defaultWeek, fromInput, toInput, weekOrder } from '@/lib/businessHours'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const { t, locale } = useI18n()
const toast = useToast()
const org = useOrganization()

const MAX_RANGES = 6
const state = ref<'loading' | 'ready' | 'error'>('loading')
const timezone = ref('')
/** Being edited; null while the hours are not set. Ranges hold input values (midnight = 00:00). */
const week = ref<WeeklyHours | null>(null)
const saved = ref('')
const saving = ref(false)
const errors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)

const hourFormat = computed(() => (org.organization?.time_format === '12h' ? '12' : '24'))
const days = computed(() => weekOrder(org.organization?.week_start ?? 0))
const dayName = (d: number) => t(`regional.days.${DAY_KEYS[d]}`)
const dirty = computed(() => JSON.stringify(toApi(week.value)) !== saved.value)

function fromApi(hours: WeeklyHours | null): WeeklyHours | null {
  return hours
    ? Object.fromEntries(Object.entries(hours).map(([d, ranges]) => [d, ranges.map(toInput)]))
    : null
}
function toApi(hours: WeeklyHours | null): WeeklyHours | null {
  return hours
    ? Object.fromEntries(Object.entries(hours).map(([d, ranges]) => [d, ranges.map(fromInput)]))
    : null
}
/** Not set yet: the grid shows a default week to start from (saving sets it). */
const notSet = ref(false)
function apply(hours: WeeklyHours | null) {
  notSet.value = hours === null
  week.value = hours === null ? defaultWeek() : fromApi(hours)
  saved.value = JSON.stringify(hours)
}

async function load() {
  state.value = 'loading'
  try {
    const result = await tenantApi.businessHours(props.locationId)
    timezone.value = result.timezone
    apply(result.hours)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const ranges = (d: number): TimeRange[] => week.value?.[String(d)] ?? []
function setOpen(d: number, open: boolean) {
  if (!week.value) return
  week.value[String(d)] = open ? [{ start: '06:00', end: '22:00' }] : []
}
function addRange(d: number) {
  const list = ranges(d)
  const last = list[list.length - 1]
  list.push(
    last
      ? { start: last.end === '00:00' ? '18:00' : last.end, end: '00:00' }
      : { start: '06:00', end: '22:00' },
  )
}
function removeRange(d: number, i: number) {
  ranges(d).splice(i, 1)
}

// Copy one day's hours to every day (design: copy icon per row).
function copyToAll(d: number) {
  if (!week.value) return
  const source = ranges(d)
  for (const day of days.value) week.value[String(day)] = source.map((r) => ({ ...r }))
  toast.add({ severity: 'info', summary: t('businessHours.copiedAll'), life: 2500 })
}
function discard() {
  apply(JSON.parse(saved.value))
  errors.value = {}
  formError.value = null
}

async function save(hours: WeeklyHours | null = toApi(week.value)) {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    apply((await tenantApi.updateBusinessHours(props.locationId, hours)).hours)
    toast.add({ severity: 'success', summary: t('businessHours.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('businessHours.checkDays')
      : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="panel pad">
    <Skeleton v-for="n in 5" :key="n" height="36px" />
  </div>
  <ErrorState
    v-else-if="state === 'error'"
    class="panel"
    :title="t('businessHours.loadError')"
    @retry="load"
  />

  <form v-else-if="week" class="stack" @submit.prevent="save()">
    <StatusBanner v-if="notSet" severity="info" icon="pi-clock" :title="t('businessHours.notSet')">
      {{ t('businessHours.notSetHint') }}
    </StatusBanner>
    <Message v-if="formError" severity="error" :closable="false" role="alert">{{
      formError
    }}</Message>

    <div class="panel">
      <div class="head">
        <div class="head__text">
          <div class="head__title">{{ t('locationDetails.tabs.hours') }}</div>
          <div class="head__help">
            {{ t('businessHours.outsideWarning') }}
            <strong dir="ltr">{{ zoneAbbreviation(timezone, locale) }} · {{ timezone }}</strong>
          </div>
        </div>
        <template v-if="canEdit">
          <Button
            v-if="!notSet && !dirty"
            :label="t('businessHours.clear')"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="saving"
            @click="save(null)"
          />
          <Button
            v-if="dirty && !notSet"
            :label="t('common.discard')"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="saving"
            @click="discard"
          />
          <Button
            v-if="dirty || notSet"
            type="submit"
            :label="t('businessHours.save')"
            :loading="saving"
          />
        </template>
      </div>

      <div v-for="d in days" :key="d" :class="['day', { 'day--invalid': dayError(errors, d) }]">
        <label :for="`open-${d}`" class="day__name">{{ dayName(d) }}</label>
        <div class="day__toggle">
          <ToggleSwitch
            :model-value="ranges(d).length > 0"
            :input-id="`open-${d}`"
            :disabled="!canEdit"
            @update:model-value="(open: boolean) => setOpen(d, open)"
          />
        </div>
        <div class="day__ranges">
          <span v-if="!ranges(d).length" class="closed">{{ t('businessHours.closedAllDay') }}</span>
          <div v-for="(range, i) in ranges(d)" :key="i" class="range">
            <div class="range__times" dir="ltr">
              <TimeField
                :hour-format="hourFormat"
                v-model="range.start"
                :aria-label="t('businessHours.opens', { day: dayName(d) })"
                :disabled="!canEdit"
                :invalid="!!errors[`hours.${d}.${i}.start`]"
              />
              <span aria-hidden="true">–</span>
              <TimeField
                :hour-format="hourFormat"
                v-model="range.end"
                :aria-label="t('businessHours.closes', { day: dayName(d) })"
                :disabled="!canEdit"
                :invalid="!!errors[`hours.${d}.${i}.end`]"
              />
            </div>
            <Button
              v-if="canEdit && ranges(d).length > 1"
              icon="pi pi-trash"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('businessHours.removeRange')"
              @click="removeRange(d, i)"
            />
            <Button
              v-if="canEdit && i === ranges(d).length - 1 && ranges(d).length < MAX_RANGES"
              icon="pi pi-plus"
              :label="t('businessHours.addRange')"
              variant="text"
              size="small"
              @click="addRange(d)"
            />
          </div>
          <small v-if="dayError(errors, d)" class="error">{{ dayError(errors, d) }}</small>
        </div>
        <Button
          v-if="canEdit"
          v-tooltip.top="t('businessHours.copyAll')"
          icon="pi pi-copy"
          severity="secondary"
          variant="text"
          size="small"
          :aria-label="t('businessHours.copyAll')"
          @click="copyToAll(d)"
        />
      </div>
      <p class="hint">{{ t('businessHours.midnightHint') }}</p>
    </div>
  </form>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-default);
}
.head__text {
  flex: 1;
}
.head__title {
  font: var(--text-h3);
}
.head__help {
  font: var(--text-small);
  color: var(--text-secondary);
}
.head__help strong {
  font-weight: 600;
}
.day {
  display: grid;
  grid-template-columns: 84px 44px minmax(0, 1fr) 36px;
  gap: 12px;
  align-items: start;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.day--invalid {
  background: var(--sev-danger-bg);
}
.day__name {
  font: 500 14px/36px var(--font-sans);
}
.day__toggle {
  padding-top: 7px;
}
.day__ranges {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.closed {
  font: var(--text-small);
  line-height: 36px;
  color: var(--text-muted);
}
.range {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.range__times {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--text-muted);
}
.time {
  width: 112px;
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.hint {
  margin: 0;
  padding: 10px 16px;
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 640px) {
  .day {
    grid-template-columns: 1fr auto auto;
  }
  .day__ranges {
    grid-column: 1 / -1;
    order: 3;
  }
}
</style>
