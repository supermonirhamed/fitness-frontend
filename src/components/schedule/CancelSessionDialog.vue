<script setup lang="ts">
// Cancel sessions (US-03.12), as the design's CancelSessionDialog (ui_kits/admin/ScheduleDialogs.jsx):
// a reason, an optional note to clients, what is affected (sessions, bookings, waitlist), and for
// a series occurrence: this session only, this and following, or a date range at its branch.
// Picked sessions (the calendar's bulk bar) are cancelled together.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type CalendarSession, type CancelReason, type CancelTarget } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { addDays } from '@/lib/calendar'
import { useOrganization } from '@/stores/organization'

type Scope = 'one' | 'following' | 'range'

const props = defineProps<{
  /** One session (with series choices), or… */
  session?: CalendarSession | null
  /** …several picked sessions. */
  ids?: number[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ cancelled: [result: { cancelled: number; name: string | null }] }>()
const { t } = useI18n()
const org = useOrganization()

const REASONS: CancelReason[] = ['coach', 'facility', 'low_bookings', 'holiday', 'other']
const reason = ref<CancelReason | null>(null)
const note = ref('')
const scope = ref<Scope>('one')
const range = ref<Date[] | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const impact = ref<{ sessions: number; bookings: number; waitlist: number } | null>(null)

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inSeries = computed(() => !!props.session?.series_id)
const bulk = computed(() => !props.session && !!props.ids?.length)

watch(visible, (open) => {
  if (!open) return
  reason.value = null
  note.value = ''
  error.value = null
  scope.value = 'one'
  const day = props.session?.local.date
  range.value = day ? [new Date(`${day}T12:00:00`), new Date(`${addDays(day, 14)}T12:00:00`)] : null
  loadImpact()
})

const target = computed<CancelTarget | null>(() => {
  const s = props.session
  if (!s) return props.ids?.length ? { mode: 'ids', ids: props.ids } : null
  if (scope.value === 'following') return { mode: 'following', session_id: s.id }
  if (scope.value === 'range') {
    const [from, to] = range.value ?? []
    return from && to
      ? { mode: 'range', location_id: s.location.id, from: ymd(from), to: ymd(to) }
      : null
  }
  return { mode: 'ids', ids: [s.id] }
})
let request = 0
async function loadImpact() {
  const t = target.value
  impact.value = null
  if (!t || !visible.value) return
  const mine = ++request
  const result = await tenantApi.sessions.cancelPreview(t).catch(() => null)
  if (mine === request) impact.value = result
}
watch(() => JSON.stringify(target.value), loadImpact)

const reasonOptions = computed(() =>
  REASONS.map((r) => ({ value: r, label: t(`session.cancel.reasons.${r}`) })),
)
const impactText = computed(() => {
  const i = impact.value
  if (!i) return null
  if (!i.sessions) return t('session.cancel.nothing')
  return [
    t('session.cancel.sessions', i.sessions),
    i.bookings || i.waitlist
      ? t('session.cancel.impact', { booked: i.bookings, waitlist: i.waitlist })
      : t('session.cancel.noBookings'),
  ].join(' ')
})
const confirmLabel = computed(() =>
  (impact.value?.sessions ?? 1) > 1
    ? t('session.cancel.cancelN', impact.value!.sessions)
    : t('session.cancel.title'),
)

async function confirm() {
  if (!target.value || !reason.value) return
  busy.value = true
  error.value = null
  try {
    const result = await tenantApi.sessions.cancelMany({
      ...target.value,
      reason: reason.value,
      note: note.value.trim() || null,
    })
    emit('cancelled', { cancelled: result.cancelled, name: props.session?.service.name ?? null })
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
    :header="bulk ? t('session.cancel.titleMany') : t('session.cancel.title')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="cancel">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <Message
        v-if="impactText"
        :severity="impact?.sessions ? 'error' : 'secondary'"
        icon="pi pi-exclamation-triangle"
        :closable="false"
        >{{ impactText }}</Message
      >
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
      <fieldset v-if="inSeries" class="scope">
        <legend>{{ t('session.cancel.partOfSeries') }}</legend>
        <div v-for="s in ['one', 'following', 'range'] as Scope[]" :key="s" class="scope__option">
          <RadioButton v-model="scope" :input-id="`cscope-${s}`" name="cancel-scope" :value="s" />
          <label :for="`cscope-${s}`">{{ t(`session.cancel.scopes.${s}`) }}</label>
        </div>
        <DatePicker
          v-if="scope === 'range'"
          v-model="range"
          selection-mode="range"
          :first-day-of-week="org.organization?.week_start ?? 6"
          date-format="yy-mm-dd"
          :manual-input="false"
          show-icon
          icon-display="input"
          fluid
        />
        <small v-if="scope === 'range'" class="hint">{{ t('session.cancel.rangeHint') }}</small>
      </fieldset>
    </div>
    <template #footer>
      <Button
        :label="t('session.cancel.keep')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="confirmLabel"
        severity="danger"
        :disabled="!reason || !target || impact?.sessions === 0"
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
.scope {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scope legend {
  margin-bottom: 10px;
  padding: 0;
  font: var(--text-small);
  font-weight: 500;
}
.scope__option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
