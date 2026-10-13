<script setup lang="ts">
// Booking details (US-04.09, brief 05 §3): the session, client, status, payment source, the policy
// terms ("Cancel free until …"), and the timeline (made, moved, cancelled, no-show, attended,
// overrides with reasons). Actions: cancel, reschedule, mark no-show / undo it.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import BookingPaymentsPanel from '@/components/bookings/BookingPaymentsPanel.vue'
import CancelBookingDialog from '@/components/bookings/CancelBookingDialog.vue'
import RescheduleBookingDialog from '@/components/bookings/RescheduleBookingDialog.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type BookingDetails } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ bookingId: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [] }>()
const { t, te, locale } = useI18n()
const auth = useStaffAuth()
const format = useFormat()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const booking = ref<BookingDetails | null>(null)

async function load() {
  if (!props.bookingId) return
  state.value = 'loading'
  try {
    booking.value = await tenantApi.bookings.get(props.bookingId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(visible, (open) => open && load())

const timezone = computed(() => booking.value?.session?.location.timezone ?? undefined)
const started = computed(
  () => !!booking.value?.session && Date.parse(booking.value.session.starts_at) <= Date.now(),
)
const confirmed = computed(() => booking.value?.status === 'Confirmed')
const canCancel = computed(() => confirmed.value && !started.value && auth.can('bookings.delete'))
const canReschedule = computed(
  () => confirmed.value && !started.value && auth.can('bookings.update'),
)
const canNoShow = computed(() => confirmed.value && started.value && auth.can('attendance.update'))
const canUndoNoShow = computed(
  () => !!booking.value?.no_show_reversible && auth.can('attendance.update'),
)
const sessionLabel = computed(() => {
  const s = booking.value?.session
  return s ? `${s.service} · ${s.local.date} ${s.local.start}` : ''
})

const actionLabel = (action: string) => {
  const key = `bookingDetails.actions.${action.replace('.', '_')}`
  return te(key) ? t(key) : action
}

const cancelOpen = ref(false)
const rescheduleOpen = ref(false)
const noShowOpen = ref(false)
const undoOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
function changed() {
  emit('changed')
  load()
}
async function noShow(reason?: string) {
  if (!booking.value) return
  busy.value = true
  error.value = null
  try {
    if (reason === undefined) await tenantApi.bookings.markNoShow(booking.value.id)
    else await tenantApi.bookings.reverseNoShow(booking.value.id, reason)
    noShowOpen.value = false
    undoOpen.value = false
    changed()
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Drawer v-model:visible="visible" :position="position" :block-scroll="true">
    <template #header>
      <div>
        <div class="head__title">{{ t('bookingDetails.title') }}</div>
        <div v-if="booking?.session" class="head__sub">{{ sessionLabel }}</div>
      </div>
    </template>

    <div v-if="state === 'loading'" class="body" aria-busy="true">
      <Skeleton height="64px" /><Skeleton height="160px" />
    </div>
    <Message v-else-if="state === 'error' || !booking" severity="error" :closable="false">{{
      t('bookingDetails.loadError')
    }}</Message>
    <div v-else class="body">
      <RouterLink :to="{ name: 'tenant.client', params: { id: booking.client.id } }" class="who">
        <PersonAvatar :name="booking.client.name ?? ''" :image="booking.client.photo_url" />
        <span class="who__text">
          <span class="who__name">{{ booking.client.name }}</span>
          <small class="muted">{{ booking.client.member_id }}</small>
          <small v-if="booking.host" class="muted">{{
            t('booking.guestOf', { name: booking.host.name })
          }}</small>
        </span>
        <StatusTag :status="booking.status" />
      </RouterLink>

      <dl class="facts">
        <template v-if="booking.session">
          <dt>{{ t('bookingDetails.session') }}</dt>
          <dd>
            <RouterLink :to="{ name: 'tenant.session', params: { id: booking.session.id } }">{{
              booking.session.service
            }}</RouterLink>
            ·
            <span dir="ltr" class="num"
              >{{ booking.session.local.date }} {{ booking.session.local.start }}–{{
                booking.session.local.end
              }}</span
            >
          </dd>
          <dt>{{ t('session.branch') }}</dt>
          <dd>{{ booking.session.location.name }}</dd>
          <template v-if="booking.session.coach">
            <dt>{{ t('bookingDetails.coach') }}</dt>
            <dd>{{ booking.session.coach }}</dd>
          </template>
        </template>
        <dt>{{ t('booking.payment') }}</dt>
        <dd>
          {{
            booking.entitlement_source ? t(`booking.payments.${booking.entitlement_source}`) : '—'
          }}
        </dd>
        <template v-if="booking.terms">
          <dt>{{ t('bookingDetails.freeCancel') }}</dt>
          <dd>
            {{
              booking.terms.late
                ? t('bookingDetails.freeCancelEnded', {
                    date: format.dateTime(booking.terms.free_until, timezone),
                  })
                : t('bookingDetails.freeCancelUntil', {
                    date: format.dateTime(booking.terms.free_until, timezone),
                  })
            }}
          </dd>
        </template>
        <template v-if="booking.penalty">
          <dt>{{ t('bookingDetails.penalty') }}</dt>
          <dd>
            {{ t(`bookingPolicy.penalties.${booking.penalty}`) }}
            <template v-if="booking.penalty_fee"
              >· {{ format.money(booking.penalty_fee) }}</template
            >
          </dd>
        </template>
        <dt>{{ t('bookingDetails.bookedBy') }}</dt>
        <dd>
          {{ booking.booked_by ?? t(`bookingDetails.channels.${booking.channel}`) }}
          <template v-if="booking.created_at">
            · {{ format.dateTime(booking.created_at, timezone) }}</template
          >
        </dd>
      </dl>

      <BookingPaymentsPanel
        v-if="auth.can('payments.view') && booking.entitlement_source"
        :booking-id="booking.id"
        :timezone="timezone"
        @changed="changed"
      />

      <section>
        <h3 class="section-title">{{ t('bookingDetails.timeline') }}</h3>
        <ol class="timeline">
          <li v-for="(e, i) in booking.timeline" :key="i">
            <span class="timeline__title">{{ actionLabel(e.action) }}</span>
            <small class="muted"
              >{{ e.at ? format.dateTime(e.at, timezone) : '' }}
              <template v-if="e.user"> · {{ e.user }}</template></small
            >
            <small v-if="e.values.reason" class="muted">{{ e.values.reason }}</small>
            <small v-if="e.values.waive_reason" class="muted">{{ e.values.waive_reason }}</small>
          </li>
        </ol>
      </section>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
    </div>

    <template #footer>
      <div v-if="booking" class="footer">
        <Button
          v-if="canNoShow"
          icon="pi pi-user-minus"
          :label="t('noShow.mark')"
          severity="secondary"
          variant="outlined"
          @click="noShowOpen = true"
        />
        <Button
          v-if="canUndoNoShow"
          icon="pi pi-undo"
          :label="t('noShow.reverse')"
          severity="secondary"
          variant="outlined"
          @click="undoOpen = true"
        />
        <Button
          v-if="canReschedule"
          icon="pi pi-arrow-right-arrow-left"
          :label="t('reschedule.action')"
          severity="secondary"
          variant="outlined"
          @click="rescheduleOpen = true"
        />
        <Button
          v-if="canCancel"
          icon="pi pi-times"
          :label="t('cancelBooking.action')"
          severity="danger"
          variant="outlined"
          @click="cancelOpen = true"
        />
      </div>
    </template>
  </Drawer>

  <template v-if="booking">
    <CancelBookingDialog
      v-model:visible="cancelOpen"
      :booking="booking"
      :session="sessionLabel"
      :timezone="timezone ?? 'UTC'"
      @cancelled="changed"
      @cancelled-future="changed"
    />
    <RescheduleBookingDialog
      v-model:visible="rescheduleOpen"
      :booking="booking"
      :session="sessionLabel"
      :timezone="timezone ?? 'UTC'"
      @moved="
        () => {
          emit('changed')
          visible = false
        }
      "
    />
    <ConfirmActionDialog
      v-model:visible="noShowOpen"
      :title="t('noShow.markTitle', { client: booking.client.name })"
      :description="t('noShow.markBody')"
      :confirm-label="t('noShow.mark')"
      :loading="busy"
      destructive
      @confirm="noShow()"
    />
    <OverrideDialog
      v-model:visible="undoOpen"
      :title="t('noShow.reverseTitle', { client: booking.client.name })"
      :description="t('noShow.reverseBody')"
      :confirm-label="t('noShow.reverse')"
      :loading="busy"
      @confirm="noShow"
    />
  </template>
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}
.who__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.who__name {
  font: 500 14px/1.4 var(--font-sans);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.facts {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr;
  gap: 8px 16px;
  margin: 0;
  font: var(--text-body);
}
.facts dt {
  color: var(--text-secondary);
}
.facts dd {
  margin: 0;
}
.section-title {
  font: var(--text-h4);
  margin: 0 0 8px;
}
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-inline-start: 2px solid var(--border-default);
  padding-inline-start: 12px;
}
.timeline li {
  display: flex;
  flex-direction: column;
}
.timeline__title {
  font: 500 14px var(--font-sans);
}
.footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  width: 100%;
}
</style>
