<script setup lang="ts">
// Weekly business hours of a branch (US-01.06): each day closed or one or more time ranges, in
// the branch's timezone. Sessions outside them get a warning; appointment slots stay inside.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Popover from 'primevue/popover'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type TimeRange, type WeeklyHours } from '@/api/tenant'
import { validationErrors } from '@/lib/http'
import { DAY_KEYS, dayError, defaultWeek, fromInput, toInput, weekOrder } from '@/lib/businessHours'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const { t } = useI18n()
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
function apply(hours: WeeklyHours | null) {
  week.value = fromApi(hours)
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

// Copy one day's hours to others
const copyPopover = ref<InstanceType<typeof Popover>>()
const copyFrom = ref<number | null>(null)
const copyTo = ref<number[]>([])
function openCopy(event: Event, d: number) {
  copyFrom.value = d
  copyTo.value = []
  copyPopover.value?.toggle(event)
}
function applyCopy() {
  if (!week.value || copyFrom.value === null) return
  const source = ranges(copyFrom.value)
  for (const d of copyTo.value) week.value[String(d)] = source.map((r) => ({ ...r }))
  copyPopover.value?.hide()
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
  <div v-if="state === 'loading'" class="stack">
    <Skeleton v-for="n in 4" :key="n" height="44px" />
  </div>
  <EmptyState
    v-else-if="state === 'error'"
    icon="pi-exclamation-triangle"
    :title="t('businessHours.loadError')"
  >
    <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
  </EmptyState>

  <EmptyState
    v-else-if="!week"
    icon="pi-clock"
    :title="t('businessHours.notSet')"
    :body="t('businessHours.notSetHint')"
  >
    <Button
      v-if="canEdit"
      icon="pi pi-plus"
      :label="t('businessHours.set')"
      @click="week = defaultWeek()"
    />
  </EmptyState>

  <form v-else class="stack" @submit.prevent="save()">
    <p class="note">
      <i class="pi pi-clock" aria-hidden="true" />
      {{ t('businessHours.intro') }}
      <span dir="ltr" class="ltr-isolate">{{ timezone }}</span>
    </p>

    <ul class="days">
      <li v-for="d in days" :key="d" class="day" :class="{ invalid: dayError(errors, d) }">
        <div class="day-head">
          <ToggleSwitch
            :model-value="ranges(d).length > 0"
            :input-id="`open-${d}`"
            :disabled="!canEdit"
            @update:model-value="(open: boolean) => setOpen(d, open)"
          />
          <label :for="`open-${d}`" class="day-name">{{ dayName(d) }}</label>
        </div>

        <div class="ranges">
          <span v-if="!ranges(d).length" class="closed">{{ t('businessHours.closed') }}</span>
          <div v-for="(range, i) in ranges(d)" :key="i" class="range">
            <InputText
              v-model="range.start"
              type="time"
              :aria-label="t('businessHours.opens', { day: dayName(d) })"
              :disabled="!canEdit"
              :invalid="!!errors[`hours.${d}.${i}.start`]"
              class="time"
            />
            <span aria-hidden="true">–</span>
            <InputText
              v-model="range.end"
              type="time"
              :aria-label="t('businessHours.closes', { day: dayName(d) })"
              :disabled="!canEdit"
              :invalid="!!errors[`hours.${d}.${i}.end`]"
              class="time"
            />
            <Button
              v-if="canEdit"
              icon="pi pi-times"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :aria-label="t('businessHours.removeRange')"
              @click="removeRange(d, i)"
            />
          </div>
          <small v-if="dayError(errors, d)" class="error">{{ dayError(errors, d) }}</small>
        </div>

        <div v-if="canEdit" class="day-actions">
          <Button
            v-if="ranges(d).length && ranges(d).length < MAX_RANGES"
            icon="pi pi-plus"
            :label="t('businessHours.addRange')"
            severity="secondary"
            variant="text"
            size="small"
            @click="addRange(d)"
          />
          <Button
            icon="pi pi-copy"
            :label="t('businessHours.copy')"
            severity="secondary"
            variant="text"
            size="small"
            aria-haspopup="true"
            @click="openCopy($event, d)"
          />
        </div>
      </li>
    </ul>
    <p class="note">{{ t('businessHours.midnightHint') }}</p>

    <Popover ref="copyPopover">
      <div class="copy">
        <span class="copy-title">{{
          t('businessHours.copyTo', { day: copyFrom === null ? '' : dayName(copyFrom) })
        }}</span>
        <label v-for="d in days.filter((x) => x !== copyFrom)" :key="d" class="copy-day">
          <Checkbox v-model="copyTo" :value="d" :input-id="`copy-${d}`" />
          {{ dayName(d) }}
        </label>
        <Button
          size="small"
          :label="t('businessHours.applyCopy')"
          :disabled="!copyTo.length"
          @click="applyCopy"
        />
      </div>
    </Popover>

    <Message v-if="formError" severity="error" :closable="false" role="alert">{{
      formError
    }}</Message>
    <div v-if="canEdit" class="footer">
      <Button
        v-if="saved !== 'null'"
        :label="t('businessHours.clear')"
        severity="secondary"
        variant="text"
        :disabled="saving"
        @click="save(null)"
      />
      <span v-else />
      <Button type="submit" :label="t('permissions.save')" :disabled="!dirty" :loading="saving" />
    </div>
  </form>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.days {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.day {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3) var(--space-4);
}
.day + .day {
  border-top: 1px solid var(--border-subtle);
}
.day.invalid {
  background: var(--sev-danger-bg, transparent);
}
.day-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 40px;
}
.day-name {
  font-weight: var(--fw-medium);
}
.ranges {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 40px;
  justify-content: center;
}
.range {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.time {
  width: 8.5rem;
}
.closed {
  font: var(--text-small);
  color: var(--text-muted);
}
.day-actions {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 200px;
}
.copy-title {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.copy-day {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
@media (max-width: 720px) {
  .day {
    grid-template-columns: 1fr;
  }
  .day-actions {
    justify-content: flex-start;
  }
}
</style>
