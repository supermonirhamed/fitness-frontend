<script setup lang="ts">
// Appointment from availability (US-03.09): pick an appointment service, branch and (any) coach,
// then a free slot of the coming days. Slots come from the coaches' availability and business
// hours, minus their sessions, time off and busy rooms. Booking creates the 1:1 session; the
// client's booking joins it when bookings are released (EP-04).
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type AppointmentDay,
  type CalendarSession,
  type Service,
  type SessionFormOptions,
} from '@/api/tenant'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { addDays, todayIn } from '@/lib/calendar'
import { zoneAbbreviation } from '@/lib/datetime'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ locationId?: number | null; date?: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [session: CalendarSession] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const DAYS = 7

const services = ref<Service[]>([])
const options = ref<SessionFormOptions | null>(null)
const form = reactive({
  serviceId: null as number | null,
  locationId: null as number | null,
  coachId: null as number | null,
  from: '',
})
const days = ref<AppointmentDay[]>([])
const meta = ref<{ duration: number; interval: number; timezone: string } | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const day = ref('')
const picked = ref<{ start: string; coachId: number; facilityId: number } | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const service = computed(() => services.value.find((s) => s.id === form.serviceId) ?? null)
const branchOptions = computed(() =>
  (auth.user?.switchable_locations ?? [])
    .filter((l) => !service.value || service.value.locations?.some((x) => x.location_id === l.id))
    .map((l) => ({ value: l.id, label: l.name })),
)
const branch = computed(() => auth.user?.switchable_locations.find((l) => l.id === form.locationId))
const timezone = computed(() => meta.value?.timezone ?? branch.value?.timezone ?? 'Asia/Riyadh')
const coachOptions = computed(() => [
  { id: null as number | null, name: t('appointment.anyCoach') },
  ...(options.value?.coaches ?? []),
])
const today = computed(() => todayIn(timezone.value))

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  picked.value = null
  days.value = []
  state.value = 'idle'
  form.coachId = null
  form.locationId =
    props.locationId ?? auth.currentLocation?.id ?? auth.user?.switchable_locations[0]?.id ?? null
  form.from = props.date && props.date >= today.value ? props.date : today.value
  day.value = form.from
  if (!services.value.length) {
    services.value = (await tenantApi.services.list({}).catch(() => [])).filter(
      (s) => s.activity_type === 'Appointment' && s.status !== 'Archived',
    )
  }
  if (!form.serviceId && services.value.length === 1) form.serviceId = services.value[0]!.id
})

// The service and branch decide the coaches; then the slots load.
watch(
  () => [form.serviceId, form.locationId] as const,
  async ([serviceId, locationId]) => {
    options.value = null
    form.coachId = null
    if (!serviceId || !locationId) return
    if (!branchOptions.value.some((b) => b.value === locationId)) {
      form.locationId = branchOptions.value[0]?.value ?? null
      return
    }
    options.value = await tenantApi.sessions.options(serviceId, locationId).catch(() => null)
  },
)
let request = 0
async function loadSlots() {
  picked.value = null
  if (!form.serviceId || !form.locationId || !visible.value) return
  const mine = ++request
  state.value = 'loading'
  try {
    const result = await tenantApi.appointments.slots({
      service_id: form.serviceId,
      location_id: form.locationId,
      from: form.from,
      days: DAYS,
      coach_id: form.coachId,
    })
    if (mine !== request) return
    days.value = result.data
    meta.value = result.meta
    if (!days.value.some((d) => d.date === day.value))
      day.value = days.value.find((d) => d.slots.length)?.date ?? form.from
    state.value = 'ready'
  } catch {
    if (mine === request) state.value = 'error'
  }
}
watch(() => [form.serviceId, form.locationId, form.coachId, form.from, visible.value], loadSlots)

function shiftWeek(step: number) {
  const next = addDays(form.from, step * DAYS)
  form.from = next < today.value ? today.value : next
  day.value = form.from
}
const dayLabel = (ymd: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${ymd}T12:00:00Z`))
const selectedDay = computed(() => days.value.find((d) => d.date === day.value) ?? null)
const pickedSlot = computed(() =>
  picked.value ? selectedDay.value?.slots.find((s) => s.start === picked.value!.start) : null,
)
function pick(start: string, coach: { id: number; facility_id: number }) {
  picked.value = { start, coachId: coach.id, facilityId: coach.facility_id }
}
const pickedCoach = computed(() =>
  pickedSlot.value?.coaches.find((c) => c.id === picked.value?.coachId),
)

async function book() {
  if (!picked.value || !form.serviceId || !form.locationId) return
  saving.value = true
  error.value = null
  try {
    const session = await tenantApi.appointments.book({
      service_id: form.serviceId,
      location_id: form.locationId,
      coach_id: picked.value.coachId,
      facility_id: picked.value.facilityId,
      date: day.value,
      start_time: picked.value.start,
    })
    emit('saved', session)
    visible.value = false
  } catch (e) {
    // Taken meanwhile: show the fresh slots.
    error.value =
      errorCode(e) === 'session_conflicts'
        ? t('appointment.taken')
        : (apiMessage(e) ?? t('common.genericError'))
    loadSlots()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="t('appointment.title')"
    class="session-drawer"
    :block-scroll="true"
  >
    <template #header>
      <div>
        <div class="head__title">{{ t('appointment.title') }}</div>
        <div class="head__sub" dir="auto">
          {{
            t('session.timesIn', {
              zone: `${zoneAbbreviation(timezone, locale)} · ${timezone}`,
            })
          }}
        </div>
      </div>
    </template>

    <div class="form">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <EmptyState
        v-if="visible && !services.length"
        compact
        icon="pi-user"
        :title="t('appointment.noServices')"
        :body="t('appointment.noServicesHint')"
      />
      <template v-else>
        <FormField :label="t('session.service')" for="a-service" required>
          <Select
            v-model="form.serviceId"
            input-id="a-service"
            :options="services"
            option-label="display_name"
            option-value="id"
            :placeholder="t('session.pickService')"
            filter
            fluid
          />
        </FormField>
        <div class="grid">
          <FormField :label="t('session.branch')" for="a-branch">
            <Select
              v-model="form.locationId"
              input-id="a-branch"
              :options="branchOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </FormField>
          <FormField :label="t('calendar.coach')" for="a-coach">
            <Select
              v-model="form.coachId"
              input-id="a-coach"
              :options="coachOptions"
              option-label="name"
              option-value="id"
              :disabled="!options"
              fluid
            />
          </FormField>
        </div>

        <section v-if="form.serviceId" class="slots">
          <div class="week">
            <Button
              icon="pi pi-chevron-left pi-dir"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="form.from <= today"
              :aria-label="t('calendar.previous')"
              @click="shiftWeek(-1)"
            />
            <div class="week__days" role="tablist">
              <button
                v-for="d in days"
                :key="d.date"
                type="button"
                role="tab"
                :aria-selected="d.date === day"
                :class="['wday', { 'wday--on': d.date === day, 'wday--none': !d.slots.length }]"
                @click="((day = d.date), (picked = null))"
              >
                <span class="wday__name">{{ dayLabel(d.date, { weekday: 'short' }) }}</span>
                <span class="wday__num num">{{ dayLabel(d.date, { day: 'numeric' }) }}</span>
                <span class="wday__count num">{{ d.slots.length }}</span>
              </button>
            </div>
            <Button
              icon="pi pi-chevron-right pi-dir"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('calendar.next')"
              @click="shiftWeek(1)"
            />
          </div>

          <div v-if="state === 'loading'" class="slot-grid" aria-busy="true">
            <Skeleton v-for="n in 8" :key="n" height="36px" />
          </div>
          <Message v-else-if="state === 'error'" severity="error" :closable="false">{{
            t('appointment.loadError')
          }}</Message>
          <EmptyState
            v-else-if="!selectedDay?.slots.length"
            compact
            icon="pi-calendar-times"
            :title="t('appointment.noSlots')"
            :body="t('appointment.noSlotsHint')"
          />
          <template v-else>
            <p class="muted">
              {{ dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' }) }} ·
              {{ t('appointment.lasts', { n: meta?.duration ?? 0 }) }}
            </p>
            <div class="slot-grid">
              <Button
                v-for="s in selectedDay.slots"
                :key="s.start"
                :label="s.start"
                size="small"
                :severity="picked?.start === s.start ? undefined : 'secondary'"
                :variant="picked?.start === s.start ? undefined : 'outlined'"
                class="slot num"
                dir="ltr"
                @click="pick(s.start, s.coaches[0]!)"
              />
            </div>
            <div v-if="pickedSlot && pickedSlot.coaches.length > 1" class="who">
              <span class="who__label">{{ t('appointment.withCoach') }}</span>
              <div class="who__list">
                <Button
                  v-for="c in pickedSlot.coaches"
                  :key="c.id"
                  :label="c.name"
                  size="small"
                  :severity="picked?.coachId === c.id ? undefined : 'secondary'"
                  :variant="picked?.coachId === c.id ? undefined : 'outlined'"
                  @click="pick(pickedSlot.start, c)"
                />
              </div>
            </div>
          </template>
        </section>

        <Message severity="info" icon="pi pi-info-circle" :closable="false">{{
          t('appointment.clientLater')
        }}</Message>
      </template>
    </div>

    <template #footer>
      <div class="footer">
        <span v-if="pickedSlot" class="footer__summary">
          <span dir="ltr" class="num">{{ pickedSlot.start }}–{{ pickedSlot.end }}</span>
          · {{ pickedCoach?.name }}
        </span>
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          :label="t('appointment.book')"
          :loading="saving"
          :disabled="!picked"
          @click="book"
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
.slots {
  border-top: 1px solid var(--border-default);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.week {
  display: flex;
  align-items: center;
  gap: 4px;
}
.week__days {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.wday {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
}
.wday--on {
  border-color: var(--primary);
  background: var(--primary-subtle);
}
.wday--none {
  color: var(--text-muted);
}
.wday__name {
  font: var(--text-caption);
}
.wday__num {
  font: 600 15px/1.2 var(--font-sans);
}
.wday__count {
  font: var(--text-caption);
  color: var(--text-muted);
}
.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 6px;
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.who {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.who__label {
  font: var(--text-small);
  font-weight: 500;
}
.who__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
.footer__summary {
  font: var(--text-small);
  color: var(--text-secondary);
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
