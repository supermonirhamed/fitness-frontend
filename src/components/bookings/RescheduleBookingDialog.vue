<script setup lang="ts">
// Reschedule a booking (US-04.05): pick another upcoming session of the same service. Allowed
// before the free-cancellation window; later, or into a session the client isn't eligible for,
// only staff with bookings.override can move it, with a reason. The booking keeps its payment.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import CapacityIndicator from '@/components/patterns/CapacityIndicator.vue'
import {
  tenantApi,
  type Booking,
  type BookingEligibility,
  type OverridableCheck,
  type RescheduleOptions,
} from '@/api/tenant'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ booking: Booking | null; session: string; timezone: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ moved: [booking: Booking, label: string] }>()
const { t, locale } = useI18n()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const options = ref<RescheduleOptions | null>(null)
const pick = ref<number | null>(null)
const reason = ref('')
const refused = ref<BookingEligibility | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, async (open) => {
  if (!open || !props.booking) return
  pick.value = null
  reason.value = ''
  refused.value = null
  error.value = null
  state.value = 'loading'
  try {
    options.value = await tenantApi.bookings.rescheduleOptions(props.booking.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})
watch(pick, () => {
  refused.value = null
  error.value = null
})

const canOverride = computed(() => !!options.value?.can_override)
const late = computed(() => !!options.value?.late)
// A full session can still be picked by staff who may override capacity.
const selectable = (s: RescheduleOptions['sessions'][number]) =>
  s.booking.can_book || (s.booking.reason === 'full' && canOverride.value)
// Overrides the target needs after a refusal, when all of them can be overridden.
const overridable = computed<OverridableCheck[] | null>(() =>
  refused.value && refused.value.reasons.every((r) => r.overridable)
    ? (refused.value.reasons.map((r) => r.check) as OverridableCheck[])
    : null,
)
const needsReason = computed(() => late.value || !!overridable.value)
const ready = computed(
  () =>
    !!pick.value &&
    (!late.value || canOverride.value) &&
    (!needsReason.value || reason.value.trim().length >= 3),
)
const freeUntil = computed(() =>
  options.value ? format.dateTime(options.value.free_until, props.timezone) : '',
)
const picked = computed(() => options.value?.sessions.find((s) => s.id === pick.value) ?? null)

const dayLabel = (ymd: string) =>
  new Intl.DateTimeFormat(locale.value, {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${ymd}T12:00:00Z`))

async function confirm() {
  if (!props.booking || !picked.value || !ready.value) return
  saving.value = true
  error.value = null
  try {
    const moved = await tenantApi.bookings.reschedule(props.booking.id, {
      session_id: picked.value.id,
      override: overridable.value ?? [],
      override_window: late.value,
      override_reason: needsReason.value ? reason.value.trim() : null,
    })
    emit('moved', moved, `${dayLabel(picked.value.local.date)} ${picked.value.local.start}`)
    visible.value = false
  } catch (e) {
    if (errorCode(e) === 'not_eligible' && e instanceof AxiosError)
      refused.value = e.response?.data?.eligibility ?? null
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('reschedule.title')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="move">
      <p v-if="booking" class="move__sub">
        {{ t('reschedule.subtitle', { client: booking.client.name, session }) }}
      </p>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <div v-if="state === 'loading'" class="move__list" aria-busy="true">
        <Skeleton v-for="n in 3" :key="n" height="52px" />
      </div>
      <Message v-else-if="state === 'error'" severity="error" :closable="false">{{
        t('reschedule.loadError')
      }}</Message>
      <template v-else-if="options">
        <Message v-if="late" severity="warn" :closable="false" icon="pi pi-clock">{{
          canOverride
            ? t('reschedule.late', { date: freeUntil })
            : t('reschedule.lateNoPermission', { date: freeUntil })
        }}</Message>

        <p v-if="!options.sessions.length" class="move__empty">{{ t('reschedule.none') }}</p>
        <div v-else class="move__list" role="radiogroup" :aria-label="t('reschedule.pick')">
          <label
            v-for="s in options.sessions"
            :key="s.id"
            :class="['opt', { 'opt--on': pick === s.id, 'opt--off': !selectable(s) }]"
          >
            <input
              v-model="pick"
              type="radio"
              name="reschedule"
              :value="s.id"
              :disabled="!selectable(s)"
            />
            <span class="opt__text">
              <span class="opt__when"
                >{{ dayLabel(s.local.date) }} ·
                <span dir="ltr" class="num">{{ s.local.start }}–{{ s.local.end }}</span></span
              >
              <span class="opt__where">{{
                [s.location.name, s.facility].filter(Boolean).join(' · ')
              }}</span>
            </span>
            <CapacityIndicator :booked="s.booked" :capacity="s.capacity" size="sm" :bar="false" />
          </label>
        </div>

        <ul v-if="refused" class="move__reasons">
          <li v-for="r in refused.reasons" :key="r.code">
            <i class="pi pi-times-circle" aria-hidden="true" />{{ r.message }}
          </li>
        </ul>

        <div v-if="needsReason && canOverride" class="move__reason">
          <label for="reschedule-reason"
            >{{ t('reschedule.overrideReason') }} <span aria-hidden="true">*</span></label
          >
          <Textarea id="reschedule-reason" v-model="reason" rows="2" auto-resize maxlength="500" />
          <small>{{ t('reschedule.overrideHint') }}</small>
        </div>
        <small class="move__note"
          ><i class="pi pi-wallet" aria-hidden="true" /> {{ t('reschedule.entitlement') }}</small
        >
      </template>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="overridable || late ? t('reschedule.overrideConfirm') : t('reschedule.confirm')"
        :loading="saving"
        :disabled="!ready || (!!refused && !(overridable && canOverride))"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.move {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.move__sub,
.move__empty {
  margin: 0;
  color: var(--text-secondary);
}
.move__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
  cursor: pointer;
}
.opt input {
  accent-color: var(--primary);
}
.opt--on {
  border-color: var(--primary);
  background: var(--primary-subtle);
}
.opt--off {
  background: var(--surface-sunken);
  cursor: not-allowed;
  opacity: 0.75;
}
.opt__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.opt__when {
  font: 500 14px/1.4 var(--font-sans);
}
.opt__where {
  font: var(--text-small);
  color: var(--text-muted);
}
.move__reasons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--sev-danger-fg);
}
.move__reasons .pi {
  margin-inline-end: 6px;
}
.move__reason {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.move__reason label {
  font: 500 14px var(--font-sans);
}
.move__reason small,
.move__note {
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
