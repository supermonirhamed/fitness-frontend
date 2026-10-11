<script setup lang="ts">
// New event (US-03.10), as the design's EventDrawer (ui_kits/admin/SessionDrawer.jsx): an event
// service, branch, facility and coach, its dates and times (each becomes a session), the event
// capacity (registrations, not per day) and when registration opens and closes.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ConflictList from '@/components/patterns/ConflictList.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import {
  tenantApi,
  type ScheduledEventDetails,
  type Service,
  type SessionConflictItem,
  type SessionFormOptions,
} from '@/api/tenant'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { addDays, todayIn } from '@/lib/calendar'
import { zoneAbbreviation } from '@/lib/datetime'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ locationId?: number | null; date?: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [event: ScheduledEventDetails] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const org = useOrganization()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

interface Row {
  date: Date | null
  start: string
  end: string
}
const services = ref<Service[]>([])
const options = ref<SessionFormOptions | null>(null)
const form = reactive({
  serviceId: null as number | null,
  locationId: null as number | null,
  facilityId: null as number | null,
  coachId: null as number | null,
  capacity: 20,
  status: 'Draft' as 'Draft' | 'Published',
  opensOn: null as Date | null,
  closesOn: null as Date | null,
})
const rows = ref<Row[]>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const conflicts = ref<(SessionConflictItem & { date?: string })[]>([])
const confirm = ref(false)

const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : ''
const asDate = (s: string) => new Date(`${s}T12:00:00`)
const err = (field: string) => errors.value[field]?.[0]
const service = computed(() => services.value.find((s) => s.id === form.serviceId) ?? null)
const branchOptions = computed(() =>
  (auth.user?.switchable_locations ?? [])
    .filter((l) => !service.value || service.value.locations?.some((x) => x.location_id === l.id))
    .map((l) => ({ value: l.id, label: l.name })),
)
const branch = computed(() => auth.user?.switchable_locations.find((l) => l.id === form.locationId))
const timezone = computed(() => options.value?.timezone ?? branch.value?.timezone ?? 'Asia/Riyadh')
const facility = computed(() => options.value?.facilities.find((f) => f.id === form.facilityId))
const statusOptions = computed(() => [
  { value: 'Draft', label: t('status.Draft') },
  { value: 'Published', label: t('status.Published') },
])
const firstDayOfWeek = computed(() => org.organization?.week_start ?? 6)
const hourFormat = computed(() => (org.organization?.time_format === '12h' ? '12' : '24'))

watch(visible, async (open) => {
  if (!open) return
  errors.value = {}
  formError.value = null
  conflicts.value = []
  confirm.value = false
  form.status = 'Draft'
  form.opensOn = null
  form.closesOn = null
  form.locationId =
    props.locationId ?? auth.currentLocation?.id ?? auth.user?.switchable_locations[0]?.id ?? null
  const first = props.date ?? todayIn(branch.value?.timezone ?? 'Asia/Riyadh')
  rows.value = [0, 1, 2].map((i) => ({
    date: asDate(addDays(first, i)),
    start: '09:00',
    end: '13:00',
  }))
  if (!services.value.length) {
    services.value = (await tenantApi.services.list({}).catch(() => [])).filter(
      (s) => s.activity_type === 'Event' && s.status !== 'Archived',
    )
  }
})
watch(
  () => [form.serviceId, form.locationId] as const,
  async ([serviceId, locationId]) => {
    options.value = null
    if (!serviceId || !locationId) return
    if (!branchOptions.value.some((b) => b.value === locationId)) {
      form.locationId = branchOptions.value[0]?.value ?? null
      return
    }
    const loaded = await tenantApi.sessions.options(serviceId, locationId).catch(() => null)
    if (!loaded || form.serviceId !== serviceId) return
    options.value = loaded
    const pick = loaded.facilities.find((f) => f.linked) ?? loaded.facilities[0]
    form.facilityId = pick?.id ?? null
    form.coachId = loaded.coaches[0]?.id ?? null
    form.capacity = loaded.defaults.capacity ?? form.capacity
  },
)

function addRow() {
  const last = rows.value[rows.value.length - 1]
  rows.value.push({
    date: last?.date ? asDate(addDays(ymd(last.date), 1)) : null,
    start: last?.start ?? '09:00',
    end: last?.end ?? '13:00',
  })
}
const firstDate = computed(
  () =>
    rows.value
      .map((r) => r.date)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? undefined,
)
const canSave = computed(
  () =>
    !saving.value &&
    !!form.serviceId &&
    !!form.facilityId &&
    !!form.coachId &&
    rows.value.length > 0 &&
    rows.value.every((r) => r.date && r.start < r.end),
)

async function save() {
  if (!form.serviceId || !form.locationId || !form.facilityId || !form.coachId) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const event = await tenantApi.events.create({
      service_id: form.serviceId,
      location_id: form.locationId,
      facility_id: form.facilityId,
      coach_ids: [form.coachId],
      status: form.status,
      capacity: form.capacity,
      dates: rows.value.map((r) => ({ date: ymd(r.date), start_time: r.start, end_time: r.end })),
      registration_opens_on: form.opensOn ? ymd(form.opensOn) : null,
      registration_closes_on: form.closesOn ? ymd(form.closesOn) : null,
      ...(confirm.value ? { confirm_warnings: true } : {}),
    })
    emit('saved', event)
    visible.value = false
  } catch (e) {
    const code = errorCode(e)
    if (code === 'session_conflicts' || code === 'needs_confirmation') {
      conflicts.value =
        (e as { response?: { data?: { conflicts?: typeof conflicts.value } } }).response?.data
          ?.conflicts ?? []
      // Warnings only: saving again accepts them.
      confirm.value = code === 'needs_confirmation'
      formError.value = apiMessage(e) ?? null
    } else {
      errors.value = validationErrors(e)
      formError.value = Object.keys(errors.value).length
        ? t('locationForm.checkFields')
        : (apiMessage(e) ?? t('common.genericError'))
    }
  } finally {
    saving.value = false
  }
}
const conflictItems = computed(() =>
  conflicts.value.map((c) => ({
    ...c,
    when: c.date && !c.when?.startsWith(c.date) ? `${c.date} · ${c.when ?? ''}` : c.when,
  })),
)
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="t('event.title')"
    class="drawer-lg"
    :block-scroll="true"
  >
    <template #header>
      <div>
        <div class="head__title">{{ t('event.title') }}</div>
        <div class="head__sub" dir="auto">
          {{ t('event.subtitle') }} ·
          {{ zoneAbbreviation(timezone, locale) }}
        </div>
      </div>
    </template>

    <form id="event-form" class="form" @submit.prevent="save">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
      <ConflictList v-if="conflictItems.length" :items="conflictItems" />
      <Message v-if="visible && !services.length" severity="info" :closable="false">{{
        t('event.noServices')
      }}</Message>

      <FormField :label="t('session.service')" for="e-service" required :error="err('service_id')">
        <Select
          v-model="form.serviceId"
          input-id="e-service"
          :options="services"
          option-label="display_name"
          option-value="id"
          :placeholder="t('session.pickService')"
          filter
          fluid
        />
      </FormField>
      <div class="grid">
        <FormField :label="t('session.branch')" for="e-branch">
          <Select
            v-model="form.locationId"
            input-id="e-branch"
            :options="branchOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
        <FormField
          :label="t('calendar.facility')"
          for="e-facility"
          required
          :error="err('facility_id')"
        >
          <Select
            v-model="form.facilityId"
            input-id="e-facility"
            :options="options?.facilities ?? []"
            option-label="name"
            option-value="id"
            :disabled="!options"
            fluid
          />
        </FormField>
        <FormField :label="t('calendar.coach')" for="e-coach" required :error="err('coach_ids.0')">
          <Select
            v-model="form.coachId"
            input-id="e-coach"
            :options="options?.coaches ?? []"
            option-label="name"
            option-value="id"
            :disabled="!options"
            filter
            fluid
          />
        </FormField>
        <FormField
          :label="t('event.capacity')"
          for="e-capacity"
          :help="t('event.capacityHint')"
          :error="err('capacity') ?? err('session_capacity')"
        >
          <InputNumber
            v-model="form.capacity"
            input-id="e-capacity"
            :min="1"
            :max="10000"
            show-buttons
            fluid
          />
        </FormField>
      </div>
      <small v-if="facility && form.capacity > facility.capacity" class="hint">{{
        t('event.sessionCapped', { n: facility.capacity })
      }}</small>

      <fieldset class="dates">
        <legend>{{ t('event.dates') }}</legend>
        <div v-for="(r, i) in rows" :key="i" class="date-row">
          <span class="date-row__n num">{{ i + 1 }}</span>
          <DatePicker
            v-model="r.date"
            :first-day-of-week="firstDayOfWeek"
            date-format="yy-mm-dd"
            show-icon
            icon-display="input"
            class="date-row__date"
            :invalid="!!err(`dates.${i}.date`)"
            :aria-label="t('session.date')"
          />
          <div class="date-row__times" dir="ltr">
            <TimeField v-model="r.start" :hour-format="hourFormat" class="date-row__time" />
            <span>–</span>
            <TimeField
              v-model="r.end"
              :hour-format="hourFormat"
              class="date-row__time"
              :invalid="r.end <= r.start || !!err(`dates.${i}.end_time`)"
            />
          </div>
          <Button
            icon="pi pi-trash"
            size="small"
            variant="text"
            severity="secondary"
            :aria-label="t('event.removeDate')"
            :disabled="rows.length === 1"
            @click="rows.splice(i, 1)"
          />
        </div>
        <Button
          :label="t('event.addDate')"
          icon="pi pi-plus"
          variant="text"
          size="small"
          class="add-date"
          :disabled="rows.length >= 30"
          @click="addRow"
        />
        <small v-if="err('dates')" class="error">{{ err('dates') }}</small>
      </fieldset>

      <div class="grid">
        <FormField :label="t('event.opens')" for="e-opens" :error="err('registration_opens_on')">
          <DatePicker
            v-model="form.opensOn"
            input-id="e-opens"
            :first-day-of-week="firstDayOfWeek"
            date-format="yy-mm-dd"
            :max-date="firstDate"
            show-icon
            icon-display="input"
            show-clear
            :placeholder="t('event.rightAway')"
            fluid
          />
        </FormField>
        <FormField :label="t('event.closes')" for="e-closes" :error="err('registration_closes_on')">
          <DatePicker
            v-model="form.closesOn"
            input-id="e-closes"
            :first-day-of-week="firstDayOfWeek"
            date-format="yy-mm-dd"
            :min-date="form.opensOn ?? undefined"
            :max-date="firstDate"
            show-icon
            icon-display="input"
            show-clear
            :placeholder="t('event.untilStart')"
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
          />
        </FormField>
      </div>

      <Message severity="info" :closable="false">{{ t('event.willCreate', rows.length) }}</Message>
    </form>

    <template #footer>
      <div class="footer">
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          :label="confirm ? t('session.saveAnyway') : t('event.save')"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        />
      </div>
    </template>
  </Drawer>
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
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid__full {
  grid-column: 1 / -1;
}
.hint {
  margin-top: -8px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.dates {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dates legend {
  margin-bottom: 8px;
  padding: 0;
  font: var(--text-small);
  font-weight: 500;
}
.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.date-row__n {
  width: 20px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.date-row__date,
.date-row__date :deep(input) {
  width: 170px;
}
.date-row__times {
  display: flex;
  align-items: center;
  gap: 6px;
}
.date-row__time,
.date-row__time :deep(input) {
  width: 110px;
}
.add-date {
  align-self: flex-start;
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
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
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
