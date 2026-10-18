<script setup lang="ts">
// Book an appointment (US-11.11): service → branch → trainer or "any available" → day → a free
// slot in the branch's time → confirm. Slots respect the trainers' availability and the booking
// rules; a slot taken meanwhile says so and the list reloads.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import BookTabs from '@/components/app/BookTabs.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  clientApi,
  type AppointmentDay,
  type AppointmentService,
  type BookingResult,
} from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { addDays, showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t, locale } = useI18n()
const format = useFormat()
const app = useClientApp()
const services = ref<AppointmentService[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const serviceId = ref<number | null>(null)
const locationId = ref<number | null>(null)
const coachId = ref<number | null>(null)
const today = new Intl.DateTimeFormat('en-CA', { timeZone: app.config?.timezone }).format(
  new Date(),
)
const from = ref(today)
const days = ref<AppointmentDay[] | null>(null)
const date = ref(today)
const picked = ref<AppointmentDay['slots'][number] | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const booked = ref<BookingResult | null>(null)

const service = computed(() => services.value.find((s) => s.id === serviceId.value) ?? null)
const location = computed(
  () => service.value?.locations.find((l) => l.id === locationId.value) ?? null,
)
const slotsOfDay = computed(() => days.value?.find((d) => d.date === date.value)?.slots ?? [])
const weekday = (ymd: string) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${ymd}T12:00:00Z`),
  )

onMounted(async () => {
  try {
    services.value = await clientApi.appointments.services()
    if (services.value.length === 1) serviceId.value = services.value[0]!.id
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})
watch(serviceId, () => {
  locationId.value = service.value?.locations.length === 1 ? service.value.locations[0]!.id : null
  coachId.value = null
})
async function loadSlots() {
  if (!serviceId.value || !locationId.value) return
  days.value = null
  days.value = await clientApi.appointments
    .slots({
      service_id: serviceId.value,
      location_id: locationId.value,
      from: from.value,
      coach_id: coachId.value,
    })
    .catch(() => [])
  if (!days.value.some((d) => d.date === date.value)) date.value = days.value[0]?.date ?? from.value
}
watch([serviceId, locationId, coachId, from], loadSlots)
const shiftWeek = (n: number) => {
  const next = addDays(from.value, n * 7)
  from.value = next < today ? today : next
  date.value = from.value
}

async function book() {
  if (!picked.value || !service.value || !location.value) return
  busy.value = true
  error.value = null
  try {
    booked.value = await clientApi.appointments.book({
      service_id: service.value.id,
      location_id: location.value.id,
      starts_at: picked.value.starts_at,
      coach_id: coachId.value ?? picked.value.coaches[0]?.id ?? null,
    })
    picked.value = null
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
    picked.value = null
    loadSlots()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.nav.schedule') }}</h1>
    <BookTabs />
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="80px" /></div>
    <ErrorState v-else-if="state === 'error'" />
    <div v-else-if="booked" class="ca-card done">
      <span class="done__icon"><i class="pi pi-check" aria-hidden="true" /></span>
      <h2 class="ca-title">{{ t('app.session.confirmed') }}</h2>
      <p>{{ booked.session.service }} · {{ booked.session.coach }}</p>
      <p class="ca-muted">
        {{ showDay(format, booked.session.date) }} · {{ booked.session.time }} ·
        {{ booked.session.location }}
      </p>
      <Message
        v-if="booked.entitlement_source === 'pay_at_desk'"
        severity="info"
        :closable="false"
        >{{
          booked.payment.due
            ? t('app.session.payAtDeskAmount', { amount: format.money(booked.payment.due) })
            : t('app.session.payAtDesk')
        }}</Message
      >
      <a :href="clientApi.calendarUrl(booked.id)">{{ t('app.session.addToCalendar') }}</a>
      <Button :label="t('app.appointments.another')" variant="text" @click="booked = null" />
    </div>
    <div v-else-if="!services.length" class="ca-card">
      <EmptyState compact icon="pi-user" :title="t('app.appointments.none')" />
    </div>
    <template v-else>
      <div class="ca-card ca-form">
        <FormField :label="t('app.appointments.service')" for="ap-service">
          <Select
            v-model="serviceId"
            input-id="ap-service"
            :options="services"
            option-label="name"
            option-value="id"
            fluid
          />
        </FormField>
        <FormField
          v-if="service && service.locations.length > 1"
          :label="t('app.schedule.branch')"
          for="ap-branch"
        >
          <Select
            v-model="locationId"
            input-id="ap-branch"
            :options="service.locations"
            option-label="name"
            option-value="id"
            fluid
          />
        </FormField>
        <FormField
          v-if="service?.trainers.length"
          :label="t('app.appointments.trainer')"
          for="ap-trainer"
        >
          <Select
            v-model="coachId"
            input-id="ap-trainer"
            :options="[{ id: null, name: t('app.appointments.anyone') }, ...service.trainers]"
            option-label="name"
            option-value="id"
            fluid
          />
        </FormField>
        <p v-if="service" class="ca-muted ca-small">
          {{ t('app.schedule.minutes', { n: service.duration }) }}
          <template v-if="location?.price"> · {{ format.money(location.price) }}</template>
        </p>
      </div>
      <Message v-if="error" severity="warn" :closable="false">{{ error }}</Message>
      <section v-if="service && location" class="ca-card">
        <div class="ca-spread">
          <Button
            icon="pi pi-angle-left pi-dir"
            variant="text"
            size="small"
            :disabled="from <= today"
            :aria-label="t('app.appointments.earlier')"
            @click="shiftWeek(-1)"
          />
          <div class="days">
            <button
              v-for="d in days ?? []"
              :key="d.date"
              type="button"
              class="day"
              :aria-pressed="d.date === date"
              :disabled="!d.slots.length"
              @click="date = d.date"
            >
              <span class="ca-small">{{ weekday(d.date) }}</span>
              <strong class="ca-num">{{ Number(d.date.slice(8)) }}</strong>
            </button>
          </div>
          <Button
            icon="pi pi-angle-right pi-dir"
            variant="text"
            size="small"
            :aria-label="t('app.appointments.later')"
            @click="shiftWeek(1)"
          />
        </div>
        <Skeleton v-if="days === null" height="80px" />
        <EmptyState
          v-else-if="!slotsOfDay.length"
          compact
          icon="pi-clock"
          :title="t('app.appointments.noSlots')"
        />
        <div v-else class="slots">
          <Button
            v-for="s in slotsOfDay"
            :key="s.starts_at"
            :label="s.start"
            variant="outlined"
            class="ca-num"
            @click="picked = s"
          />
        </div>
      </section>
    </template>

    <FormDialog
      :visible="!!picked"
      :title="t('app.session.confirmTitle')"
      :subtitle="
        picked && service ? `${service.name} · ${showDay(format, date)} ${picked.start}` : ''
      "
      :save-label="t('app.session.confirm')"
      :saving="busy"
      @update:visible="(v: boolean) => !v && (picked = null)"
      @save="book"
    >
      <p v-if="picked?.coaches.length" class="ca-small">
        {{
          t('app.appointments.with', {
            name: (service?.trainers.find((c) => c.id === coachId) ?? picked.coaches[0])?.name,
          })
        }}
      </p>
      <p class="ca-muted ca-small">{{ location?.name }}</p>
    </FormDialog>
  </div>
</template>

<style scoped>
.days {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
  padding: 6px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
}
.day[aria-pressed='true'] {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.day:disabled {
  opacity: 0.4;
  cursor: default;
}
.slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
  margin-top: 12px;
}
.done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.done p {
  margin: 0;
}
.done__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
  font-size: 24px;
}
</style>
