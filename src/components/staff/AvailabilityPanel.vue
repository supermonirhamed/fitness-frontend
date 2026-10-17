<script setup lang="ts">
// A coach's availability and time off (US-09.04), on their staff profile (a manager) or their own
// account page (`userId` null): weekly hours per branch, date-specific changes, and time off with a
// reason. A coach's request may wait for a manager's approval; time off over sessions already
// assigned lists them (they also show in the Conflict Center).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import {
  tenantApi,
  type StaffAvailabilityData,
  type TimeRange,
  type WeeklyHours,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { DAY_KEYS, fromInput, toInput, weekOrder } from '@/lib/businessHours'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{
  userId: number | null
  locationIds?: number[]
  canEdit: boolean
  canDecide?: boolean
}>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const org = useOrganization()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const data = ref<StaffAvailabilityData | null>(null)
async function load() {
  try {
    data.value = await tenantApi.staff.availability(props.userId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const branches = computed(() =>
  (auth.user?.switchable_locations ?? []).filter(
    (b) => !props.locationIds?.length || props.locationIds.includes(b.id),
  ),
)
const branchId = ref<number | null>(null)
watch(branches, (list) => (branchId.value ??= list[0]?.id ?? null), { immediate: true })
const branchName = (id: number) =>
  auth.user?.switchable_locations.find((b) => b.id === id)?.name ?? `#${id}`
const days = computed(() => weekOrder(org.organization?.week_start ?? 0))
const dayName = (d: number) => t(`regional.days.${DAY_KEYS[d]}`)

// Weekly hours at the chosen branch; none set = available whenever the branch is open.
const week = ref<WeeklyHours | null>(null)
watch([data, branchId], () => {
  const set = data.value?.weekly.find((w) => w.location_id === branchId.value)?.weekly
  week.value = set
    ? Object.fromEntries(Object.entries(set).map(([d, r]) => [d, r.map(toInput)]))
    : null
})
const ranges = (d: number): TimeRange[] => week.value?.[String(d)] ?? []
function limit() {
  week.value = Object.fromEntries(
    days.value.map((d) => [String(d), [{ start: '09:00', end: '17:00' }]]),
  )
}
const saving = ref(false)
async function saveWeek(hours: WeeklyHours | null) {
  if (!branchId.value) return
  saving.value = true
  try {
    const payload = hours
      ? Object.fromEntries(Object.entries(hours).map(([d, r]) => [d, r.map(fromInput)]))
      : null
    data.value = await tenantApi.staff.setWeekly(props.userId, branchId.value, payload)
    toast.add({ severity: 'success', summary: t('staffAvailability.saved'), life: 3000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}

// A date-specific change
const overrideOpen = ref(false)
const override = ref<{
  date: Date | null
  off: boolean
  start: string
  end: string
  reason: string
}>({ date: null, off: true, start: '09:00', end: '13:00', reason: '' })
const overrideError = ref<string | null>(null)
async function addOverride() {
  if (!branchId.value || !override.value.date) return
  saving.value = true
  overrideError.value = null
  try {
    data.value = await tenantApi.staff.addOverride(props.userId, {
      location_id: branchId.value,
      date: isoDay(override.value.date),
      ranges: override.value.off
        ? []
        : [fromInput({ start: override.value.start, end: override.value.end })],
      reason: override.value.reason.trim() || null,
    })
    overrideOpen.value = false
  } catch (e) {
    overrideError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
async function removeOverride(id: number) {
  await tenantApi.staff.deleteOverride(id).catch(() => null)
  await load()
}

// Time off
const offOpen = ref(false)
const off = ref<{
  range: (Date | null)[] | null
  allDay: boolean
  start: string
  end: string
  reason: string
}>({ range: null, allDay: true, start: '09:00', end: '13:00', reason: '' })
const offError = ref<string | null>(null)
const clashes = ref<{ id: number; title: string; starts_at: string; location: string | null }[]>([])
function openTimeOff() {
  off.value = { range: null, allDay: true, start: '09:00', end: '13:00', reason: '' }
  offError.value = null
  offOpen.value = true
}
async function addTimeOff() {
  const [from, to] = off.value.range ?? []
  if (!from) return
  saving.value = true
  offError.value = null
  try {
    const result = await tenantApi.staff.addTimeOff(props.userId, {
      starts_on: isoDay(from),
      ends_on: isoDay(to ?? from),
      all_day: off.value.allDay,
      start_time: off.value.allDay ? null : off.value.start,
      end_time: off.value.allDay ? null : off.value.end,
      reason: off.value.reason.trim() || null,
    })
    clashes.value = result.sessions
    offOpen.value = false
    toast.add({
      severity: result.time_off.status === 'Pending' ? 'info' : 'success',
      summary: t(
        result.time_off.status === 'Pending'
          ? 'availability.requested'
          : 'availability.timeOffAdded',
      ),
      life: 3000,
    })
    await load()
  } catch (e) {
    offError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
async function removeTimeOff(id: number) {
  await tenantApi.staff.deleteTimeOff(id).catch(() => null)
  await load()
}
async function decide(id: number, approve: boolean) {
  await tenantApi.staff.decideTimeOff(id, approve).catch(() => null)
  await load()
}
// All-day time off ends at the next midnight: show the last day it covers.
const lastDay = (o: StaffAvailabilityData['time_off'][number]) =>
  new Date(new Date(o.ends_at).getTime() - 1).toISOString()
function span(o: StaffAvailabilityData['time_off'][number]) {
  if (!o.all_day) return `${format.dateTime(o.starts_at)} – ${format.time(o.ends_at)}`
  const [from, to] = [format.date(o.starts_at), format.date(lastDay(o))]
  return from === to ? from : `${from} – ${to}`
}
</script>

<template>
  <ErrorState v-if="state === 'error'" class="panel" @retry="load" />
  <div v-else-if="data" class="availability">
    <section class="panel">
      <header class="panel__head">
        <h3>{{ t('staffAvailability.weekly') }}</h3>
        <Select
          v-if="branches.length > 1"
          v-model="branchId"
          :options="branches"
          option-label="name"
          option-value="id"
          size="small"
          :aria-label="t('invoices.branch')"
        />
      </header>
      <p v-if="!week" class="muted">{{ t('staffAvailability.noLimit') }}</p>
      <ul v-else class="days">
        <li v-for="d in days" :key="d" class="day">
          <span class="day__name">{{ dayName(d) }}</span>
          <ToggleSwitch
            :model-value="ranges(d).length > 0"
            :disabled="!canEdit"
            :aria-label="dayName(d)"
            @update:model-value="
              (on: boolean) => (week![String(d)] = on ? [{ start: '09:00', end: '17:00' }] : [])
            "
          />
          <span v-if="!ranges(d).length" class="muted">{{
            t('staffAvailability.unavailable')
          }}</span>
          <span v-for="(r, i) in ranges(d)" :key="i" class="range">
            <TimeField v-model="r.start" :disabled="!canEdit" />
            <span>–</span>
            <TimeField v-model="r.end" :disabled="!canEdit" />
            <Button
              v-if="canEdit && ranges(d).length > 1"
              icon="pi pi-times"
              variant="text"
              size="small"
              severity="secondary"
              :aria-label="t('staffForm.remove')"
              @click="ranges(d).splice(i, 1)"
            />
          </span>
          <Button
            v-if="canEdit && ranges(d).length"
            icon="pi pi-plus"
            variant="text"
            size="small"
            :aria-label="t('staffAvailability.addRange')"
            @click="ranges(d).push({ start: '18:00', end: '21:00' })"
          />
        </li>
      </ul>
      <div v-if="canEdit" class="actions">
        <Button
          v-if="!week"
          :label="t('staffAvailability.setHours')"
          icon="pi pi-clock"
          size="small"
          @click="limit"
        />
        <template v-else>
          <Button
            :label="t('common.save')"
            size="small"
            :loading="saving"
            @click="saveWeek(week)"
          />
          <Button
            :label="t('staffAvailability.clear')"
            size="small"
            variant="text"
            severity="secondary"
            @click="saveWeek(null)"
          />
        </template>
      </div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h3>{{ t('staffAvailability.overrides') }}</h3>
        <Button
          v-if="canEdit"
          :label="t('staffAvailability.addOverride')"
          icon="pi pi-plus"
          size="small"
          variant="outlined"
          @click="overrideOpen = true"
        />
      </header>
      <EmptyState
        v-if="!data.overrides.length"
        compact
        icon="pi-calendar"
        :title="t('staffAvailability.noOverrides')"
      />
      <ul v-else class="list">
        <li v-for="o in data.overrides" :key="o.id">
          <span class="num">{{ format.date(o.date) }}</span>
          <span>{{ branchName(o.location_id) }}</span>
          <span>{{
            o.ranges.length
              ? o.ranges.map((r) => `${r.start}–${r.end}`).join(', ')
              : t('staffAvailability.unavailable')
          }}</span>
          <span class="muted">{{ o.reason }}</span>
          <Button
            v-if="canEdit"
            icon="pi pi-trash"
            variant="text"
            size="small"
            severity="secondary"
            :aria-label="t('staffForm.remove')"
            @click="removeOverride(o.id)"
          />
        </li>
      </ul>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h3>{{ t('staffAvailability.timeOff') }}</h3>
        <Button
          v-if="canEdit"
          :label="
            userId ? t('staffAvailability.addTimeOff') : t('staffAvailability.requestTimeOff')
          "
          icon="pi pi-plus"
          size="small"
          variant="outlined"
          @click="openTimeOff"
        />
      </header>
      <Message v-if="clashes.length" severity="warn" :closable="true" @close="clashes = []">
        {{ t('staffAvailability.clashes', { n: clashes.length }) }}
        <ul class="clashes">
          <li v-for="c in clashes" :key="c.id">
            <RouterLink :to="{ name: 'tenant.session', params: { id: c.id } }">{{
              c.title
            }}</RouterLink>
            · {{ format.dateTime(c.starts_at)
            }}<template v-if="c.location"> · {{ c.location }}</template>
          </li>
        </ul>
      </Message>
      <EmptyState
        v-if="!data.time_off.length"
        compact
        icon="pi-sun"
        :title="t('staffAvailability.noTimeOff')"
      />
      <ul v-else class="list">
        <li v-for="o in data.time_off" :key="o.id">
          <span class="num">{{ span(o) }}</span>
          <Tag
            class="tag-sm"
            :severity="o.status === 'Pending' ? 'warn' : 'success'"
            :value="t(`staffAvailability.status.${o.status}`)"
          />
          <span class="muted">{{ o.reason }}</span>
          <span v-if="o.sessions" class="bad">{{
            t('staffAvailability.overlaps', o.sessions)
          }}</span>
          <template v-if="o.status === 'Pending' && canDecide">
            <Button
              :label="t('staffAvailability.approve')"
              size="small"
              @click="decide(o.id, true)"
            />
            <Button
              :label="t('staffAvailability.reject')"
              size="small"
              variant="text"
              severity="danger"
              @click="decide(o.id, false)"
            />
          </template>
          <Button
            v-if="canEdit"
            icon="pi pi-trash"
            variant="text"
            size="small"
            severity="secondary"
            :aria-label="t('staffForm.remove')"
            @click="removeTimeOff(o.id)"
          />
        </li>
      </ul>
    </section>

    <FormDialog
      v-model:visible="overrideOpen"
      :title="t('staffAvailability.addOverride')"
      icon="pi-calendar"
      size="sm"
      :save-label="t('common.save')"
      :saving="saving"
      :save-disabled="!override.date"
      :error="overrideError"
      @save="addOverride"
    >
      <FormField :label="t('staffAvailability.date')" for="override-date" required>
        <DatePicker
          v-model="override.date"
          input-id="override-date"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
      <label class="check">
        <Checkbox v-model="override.off" binary input-id="override-off" />
        <span>{{ t('staffAvailability.unavailableThatDay') }}</span>
      </label>
      <div v-if="!override.off" class="range">
        <TimeField v-model="override.start" />
        <span>–</span>
        <TimeField v-model="override.end" />
      </div>
      <FormField :label="t('staffAvailability.reason')" for="override-reason">
        <InputText id="override-reason" v-model="override.reason" maxlength="255" fluid />
      </FormField>
    </FormDialog>

    <FormDialog
      v-model:visible="offOpen"
      :title="userId ? t('staffAvailability.addTimeOff') : t('staffAvailability.requestTimeOff')"
      icon="pi-sun"
      size="sm"
      :save-label="t('common.save')"
      :saving="saving"
      :save-disabled="!off.range?.[0]"
      :error="offError"
      @save="addTimeOff"
    >
      <Message v-if="!userId && data.approval_required" severity="info" :closable="false">{{
        t('staffAvailability.needsApproval')
      }}</Message>
      <FormField :label="t('staffAvailability.dates')" for="off-dates" required>
        <DatePicker
          v-model="off.range"
          input-id="off-dates"
          selection-mode="range"
          :manual-input="false"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
      <label class="check">
        <Checkbox v-model="off.allDay" binary input-id="off-all-day" />
        <span>{{ t('staffAvailability.allDay') }}</span>
      </label>
      <div v-if="!off.allDay" class="range">
        <TimeField v-model="off.start" />
        <span>–</span>
        <TimeField v-model="off.end" />
      </div>
      <FormField :label="t('staffAvailability.reason')" for="off-reason">
        <InputText id="off-reason" v-model="off.reason" maxlength="255" fluid />
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.availability {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.panel__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.days,
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.day,
.list li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.day__name {
  width: 90px;
  font-weight: 500;
}
.range {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.range :deep(input) {
  width: 90px;
}
.actions {
  display: flex;
  gap: 8px;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.bad {
  font: var(--text-small);
  color: var(--sev-danger-fg, var(--red-600));
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
.clashes {
  margin: 6px 0 0;
  padding-inline-start: 18px;
}
</style>
