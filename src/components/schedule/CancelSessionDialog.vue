<script setup lang="ts">
// Cancel one session, as the design's CancelSessionDialog (ui_kits/admin/ScheduleDialogs.jsx): a
// reason, an optional note to clients, and what happens to bookings. Series-wide cancelling and
// credits come with US-03.12.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type CalendarSession, type CancelReason } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ session: CalendarSession | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ cancelled: [session: CalendarSession] }>()
const { t } = useI18n()

const REASONS: CancelReason[] = ['coach', 'facility', 'low_bookings', 'holiday', 'other']
const reason = ref<CancelReason | null>(null)
const note = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  reason.value = null
  note.value = ''
  error.value = null
})
const reasonOptions = computed(() =>
  REASONS.map((r) => ({ value: r, label: t(`session.cancel.reasons.${r}`) })),
)
const impact = computed(() =>
  props.session?.booked
    ? t('session.cancel.impact', { booked: props.session.booked, waitlist: props.session.waitlist })
    : t('session.cancel.noBookings'),
)

async function confirm() {
  if (!props.session || !reason.value) return
  busy.value = true
  error.value = null
  try {
    const session = await tenantApi.sessions.cancel(props.session.id, {
      reason: reason.value,
      note: note.value.trim() || null,
    })
    emit('cancelled', session)
    visible.value = false
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('session.cancel.title')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="cancel">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <Message severity="error" icon="pi pi-exclamation-triangle" :closable="false">{{
        impact
      }}</Message>
      <FormField :label="t('session.cancel.reason')" for="cancel-reason" required>
        <Select
          v-model="reason"
          input-id="cancel-reason"
          :options="reasonOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('session.cancel.pickReason')"
          fluid
        />
      </FormField>
      <FormField :label="t('session.cancel.note')" for="cancel-note">
        <Textarea
          v-model="note"
          input-id="cancel-note"
          rows="2"
          :maxlength="500"
          :placeholder="t('common.optional')"
          auto-resize
          fluid
        />
      </FormField>
    </div>
    <template #footer>
      <Button
        :label="t('session.cancel.keep')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="t('session.cancel.title')"
        severity="danger"
        :disabled="!reason"
        :loading="busy"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.cancel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
