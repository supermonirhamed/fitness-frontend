<script setup lang="ts">
// New session (US-03.02), as the design's drawer (ui_kits/admin/SessionDrawer.jsx): service, branch,
// facility, coach, local date and time (D4), duration and capacity from the service defaults (at
// most the facility's), Draft / Published, and a live conflict panel (US-03.06). Hard conflicts
// block saving; warnings (outside hours, holidays) are saved with "Save anyway".
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ConflictList from '@/components/patterns/ConflictList.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import {
  tenantApi,
  type CalendarSession,
  type Service,
  type SessionConflictItem,
  type SessionFormOptions,
  type SessionInput,
} from '@/api/tenant'
import { ACTIVITY_ICONS, activityKey } from '@/lib/catalog'
import { errorCode, apiMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { todayIn } from '@/lib/calendar'
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

const props = defineProps<{ prefill: SessionPrefill }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [session: CalendarSession] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const org = useOrganization()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

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
    if (!payload || !visible.value || overCapacity.value) {
      conflicts.value = []
      return
    }
    timer = setTimeout(async () => {
      const mine = ++checkId
      checking.value = true
      try {
        const found = await tenantApi.sessions.check(payload)
        if (mine === checkId) conflicts.value = found
      } catch {
        if (mine === checkId) conflicts.value = []
      } finally {
        if (mine === checkId) checking.value = false
      }
    }, 350)
  },
)

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
    const code = errorCode(e)
    if (
      code === 'session_conflicts' ||
      code === 'needs_confirmation' ||
      code === 'outside_hours_forbidden'
    ) {
      conflicts.value =
        (e as { response?: { data?: { conflicts?: SessionConflictItem[] } } }).response?.data
          ?.conflicts ?? conflicts.value
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

const canSave = computed(
  () => !!input() && !hard.value && !overCapacity.value && !saving.value && !checking.value,
)
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
    :header="t('session.newTitle')"
    class="session-drawer"
    :block-scroll="true"
  >
    <template #header>
      <div class="head">
        <div class="head__title">{{ t('session.newTitle') }}</div>
        <div class="head__sub" dir="auto">{{ subtitle }}</div>
      </div>
    </template>

    <form id="session-form" class="form" @submit.prevent="save">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>

      <FormField :label="t('session.service')" for="s-service" required :error="err('service_id')">
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
      <div v-if="options" class="defaults-note">
        <i class="pi pi-sparkles" aria-hidden="true" />{{ t('session.defaultsFilled') }}
      </div>

      <div class="grid">
        <FormField :label="t('session.branch')" for="s-branch" :error="err('location_id')">
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

      <section class="conflicts">
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

    <template #footer>
      <div class="footer">
        <span
          v-if="conflicts.length"
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
        <Button
          type="submit"
          form="session-form"
          :label="soft && !hard ? t('session.saveAnyway') : t('session.save')"
          :loading="saving"
          :disabled="!canSave"
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
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
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
