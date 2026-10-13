<script setup lang="ts">
// Cancel a booking (US-04.04): says before confirming whether it is still free or a late
// cancellation, and the penalty the booking's policy brings (BR-03, BR-04). Staff with
// bookings.override can waive the penalty with a reason; it is audited.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { tenantApi, type Booking, type CancellationTerms } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ booking: Booking | null; session: string; timezone: string }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ cancelled: [booking: Booking] }>()
const { t } = useI18n()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const terms = ref<CancellationTerms | null>(null)
const reason = ref('')
const waive = ref(false)
const waiveReason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})

watch(visible, async (open) => {
  if (!open || !props.booking) return
  reason.value = ''
  waive.value = false
  waiveReason.value = ''
  error.value = null
  errors.value = {}
  state.value = 'loading'
  try {
    terms.value = await tenantApi.bookings.cancelTerms(props.booking.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

const penalized = computed(() => !!terms.value?.late && terms.value.penalty !== 'none')
const freeUntil = computed(() =>
  terms.value ? format.dateTime(terms.value.free_until, props.timezone) : '',
)
const ready = computed(
  () => state.value === 'ready' && (!waive.value || waiveReason.value.trim().length >= 3),
)

async function confirm() {
  if (!props.booking || !ready.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const booking = await tenantApi.bookings.cancel(props.booking.id, {
      reason: reason.value.trim() || null,
      waive_penalty: penalized.value && waive.value,
      waive_reason: waive.value ? waiveReason.value.trim() : null,
    })
    emit('cancelled', booking)
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = apiMessage(e) ?? errors.value.waive_reason?.[0] ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('cancelBooking.title')"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="cancel">
      <p v-if="booking" class="cancel__sub">
        {{ t('cancelBooking.subtitle', { client: booking.client.name, session }) }}
      </p>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <Skeleton v-if="state === 'loading'" height="64px" />
      <Message v-else-if="state === 'error'" severity="error" :closable="false">{{
        t('cancelBooking.loadError')
      }}</Message>
      <template v-else-if="terms">
        <Message v-if="!terms.late" severity="info" :closable="false" icon="pi pi-check-circle">
          {{ t('cancelBooking.onTime', { date: freeUntil }) }}
        </Message>
        <Message v-else severity="warn" :closable="false" icon="pi pi-clock">
          <div class="cancel__late">
            <strong>{{ t('cancelBooking.late', { date: freeUntil }) }}</strong>
            <span>{{
              t(`cancelBooking.penalty.${terms.penalty}`, {
                fee: terms.fee === null ? '' : format.money(terms.fee),
              })
            }}</span>
          </div>
        </Message>

        <div v-if="penalized && terms.can_waive" class="cancel__waive">
          <div class="cancel__toggle">
            <ToggleSwitch v-model="waive" input-id="cancel-waive" />
            <label for="cancel-waive">{{ t('cancelBooking.waive') }}</label>
          </div>
          <template v-if="waive">
            <label for="cancel-waive-reason" class="cancel__label"
              >{{ t('cancelBooking.waiveReason') }} <span aria-hidden="true">*</span></label
            >
            <Textarea
              id="cancel-waive-reason"
              v-model="waiveReason"
              rows="2"
              auto-resize
              :invalid="!!errors.waive_reason"
              maxlength="500"
            />
          </template>
        </div>

        <label for="cancel-reason" class="cancel__label">{{ t('cancelBooking.reason') }}</label>
        <Textarea id="cancel-reason" v-model="reason" rows="2" auto-resize maxlength="500" />
      </template>
    </div>
    <template #footer>
      <Button
        :label="t('cancelBooking.keep')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="t('cancelBooking.confirm')"
        severity="danger"
        :loading="saving"
        :disabled="!ready"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.cancel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cancel__sub {
  margin: 0;
  color: var(--text-secondary);
}
.cancel__late {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cancel__waive {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-sunken);
}
.cancel__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cancel__label {
  font: 500 14px var(--font-sans);
}
</style>
