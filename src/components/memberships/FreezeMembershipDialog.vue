<script setup lang="ts">
// Freeze a membership (US-06.11) within its plan's policy: from a start date (today or later) to
// the last frozen day, with a reason. The preview shows the freeze fee, the new renewal or end
// date, and the upcoming bookings in the freeze, which must be cancelled (without penalty) first.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import AffectedBookingsList from '@/components/memberships/AffectedBookingsList.vue'
import { tenantApi, type ClientEntitlement, type FreezePreview } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePlanSummary } from '@/composables/usePlanSummary'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()
const format = useFormat()
const { freezeSummary } = usePlanSummary()

const e = computed(() => props.entitlement)
const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const startsOn = ref<Date | null>(null)
const endsOn = ref<Date | null>(null)
const reason = ref('')
const cancelBookings = ref(false)
const preview = ref<FreezePreview | null>(null)
const previewErrors = ref<Record<string, string[]>>({})
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open || !e.value) return
  startsOn.value = today()
  endsOn.value = addDays(today(), Math.max(1, e.value.freeze_policy?.min_days ?? 7) - 1)
  reason.value = ''
  cancelBookings.value = false
  preview.value = null
  previewErrors.value = {}
  error.value = null
})

let seq = 0
async function loadPreview() {
  if (!visible.value || !e.value || !startsOn.value || !endsOn.value) return
  const mine = ++seq
  try {
    const p = await tenantApi.clients.freezePreview(props.clientId, e.value.id, {
      starts_on: isoDay(startsOn.value),
      ends_on: isoDay(endsOn.value),
    })
    if (mine !== seq) return
    preview.value = p
    previewErrors.value = {}
  } catch (err) {
    if (mine !== seq) return
    preview.value = null
    previewErrors.value = validationErrors(err)
    error.value = Object.keys(previewErrors.value).length ? null : (apiMessage(err) ?? null)
  }
}
watch([startsOn, endsOn, visible], loadPreview)

const fieldError = (f: string) => previewErrors.value[f]?.[0]
const hasBookings = computed(() => !!preview.value?.bookings.length)
const ready = computed(
  () => !!preview.value && !!reason.value.trim() && (!hasBookings.value || cancelBookings.value),
)

async function save() {
  if (!e.value || !ready.value || !startsOn.value || !endsOn.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await tenantApi.clients.freeze(props.clientId, e.value.id, {
      starts_on: isoDay(startsOn.value),
      ends_on: isoDay(endsOn.value),
      reason: reason.value.trim(),
      cancel_bookings: cancelBookings.value,
    })
    visible.value = false
    emit('saved', saved)
  } catch (err) {
    previewErrors.value = validationErrors(err)
    error.value = apiMessage(err) ?? t('common.genericError')
    loadPreview()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('freeze.title')"
    :subtitle="e?.name"
    icon="pi-pause-circle"
    size="md"
    :save-label="t('freeze.save')"
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <Message
      v-if="e?.freeze_policy"
      severity="secondary"
      :closable="false"
      icon="pi pi-info-circle"
      size="small"
    >
      {{ freezeSummary(e.freeze_policy) }}
      <template v-if="e.freeze_policy.max_per_year">
        · {{ t('freeze.usedThisYear', { n: e.freezes_this_year }) }}</template
      >
    </Message>
    <div class="grid2">
      <FormField
        :label="t('freeze.startsOn')"
        for="freeze-start"
        required
        :error="fieldError('starts_on')"
      >
        <DatePicker
          v-model="startsOn"
          input-id="freeze-start"
          :min-date="today()"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
      <FormField
        :label="t('freeze.endsOn')"
        for="freeze-end"
        required
        :help="preview ? t('freeze.days', { n: preview.days }) : undefined"
        :error="fieldError('ends_on')"
      >
        <DatePicker
          v-model="endsOn"
          input-id="freeze-end"
          :min-date="startsOn ?? today()"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
    </div>
    <dl v-if="preview" class="facts">
      <div v-if="preview.renews_on">
        <dt>{{ t('freeze.renewsOn') }}</dt>
        <dd>{{ format.date(preview.renews_on) }}</dd>
      </div>
      <div v-if="preview.ends_on">
        <dt>{{ t('freeze.newEnd') }}</dt>
        <dd>{{ format.date(preview.ends_on) }}</dd>
      </div>
      <div>
        <dt>{{ t('freeze.fee') }}</dt>
        <dd>{{ preview.fee ? format.money(preview.fee) : t('plans.noFee') }}</dd>
      </div>
    </dl>
    <template v-if="hasBookings">
      <AffectedBookingsList :bookings="preview!.bookings" :title="t('freeze.bookingsTitle')" />
      <div class="check">
        <Checkbox v-model="cancelBookings" input-id="freeze-cancel" binary />
        <label for="freeze-cancel">{{
          t('freeze.cancelBookings', { n: preview!.bookings.length })
        }}</label>
      </div>
    </template>
    <FormField :label="t('freeze.reason')" for="freeze-reason" required>
      <Textarea id="freeze-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
    </FormField>
  </FormDialog>
</template>

<style scoped>
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.facts dt {
  font: var(--text-caption);
  color: var(--text-muted);
}
.facts dd {
  margin: 2px 0 0;
  font: 500 14px var(--font-sans);
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
