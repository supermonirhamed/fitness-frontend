<script setup lang="ts">
// Cancel a membership or package (US-06.13): at the end of the current period (recurring
// memberships; the default) or today, with a reason for churn reports. Ending before the minimum
// commitment shows what is still owed, invoiced unless staff with memberships.waive_commitment
// waive it. Cancelling today may refund the unused part to account credit (payments.refund).
// Upcoming bookings after the end are cancelled without penalty.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import AffectedBookingsList from '@/components/memberships/AffectedBookingsList.vue'
import {
  MEMBERSHIP_CANCEL_REASONS,
  tenantApi,
  type CancellationPreview,
  type MembershipCancelReason,
  type ClientEntitlement,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const org = useOrganization()

const e = computed(() => props.entitlement)
const canEndPeriod = computed(() => !!e.value?.recurring && !!e.value.period_ends_on)
const when = ref<CancellationPreview['when']>('period_end')
const reason = ref<MembershipCancelReason | null>(null)
const note = ref('')
const waive = ref(false)
const refund = ref<number | null>(null)
const preview = ref<CancellationPreview | null>(null)
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  when.value = canEndPeriod.value ? 'period_end' : 'immediate'
  reason.value = null
  note.value = ''
  waive.value = false
  refund.value = null
  preview.value = null
  errors.value = {}
  error.value = null
  loadPreview()
})

let seq = 0
async function loadPreview() {
  if (!e.value) return
  const mine = ++seq
  try {
    const p = await tenantApi.clients.cancelPreview(props.clientId, e.value.id, when.value)
    if (mine === seq) preview.value = p
  } catch (err) {
    if (mine !== seq) return
    preview.value = null
    error.value = apiMessage(err) ?? t('common.genericError')
  }
}
watch(when, () => {
  refund.value = null
  loadPreview()
})

const whenOptions = computed(() =>
  [
    canEndPeriod.value && { value: 'period_end', label: t('cancelMembership.atPeriodEnd') },
    { value: 'immediate', label: t('cancelMembership.today') },
  ].filter(Boolean),
)
const reasonOptions = computed(() =>
  MEMBERSHIP_CANCEL_REASONS.map((r) => ({ value: r, label: t(`cancelMembership.reasons.${r}`) })),
)
const canWaive = computed(() => auth.can('memberships.waive_commitment'))
const canRefund = computed(
  () => when.value === 'immediate' && auth.can('payments.refund') && !!preview.value?.refundable,
)
const ready = computed(
  () =>
    !!preview.value &&
    !!reason.value &&
    (reason.value !== 'other' || !!note.value.trim()) &&
    (refund.value ?? 0) <= (preview.value?.refundable ?? 0),
)

async function save() {
  if (!e.value || !ready.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const saved = await tenantApi.clients.cancelEntitlement(props.clientId, e.value.id, {
      when: when.value,
      reason: reason.value!,
      note: note.value.trim() || null,
      waive_commitment: waive.value,
      refund: canRefund.value ? refund.value : null,
    })
    visible.value = false
    emit('saved', saved)
  } catch (err) {
    errors.value = validationErrors(err)
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('cancelMembership.title')"
    :subtitle="e?.name"
    icon="pi-ban"
    size="md"
    :save-label="t('cancelMembership.save')"
    danger
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <FormField :label="t('cancelMembership.when')" for="cancel-when">
      <SelectButton
        id="cancel-when"
        v-model="when"
        :options="whenOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
    </FormField>
    <template v-if="preview">
      <Message severity="secondary" :closable="false" icon="pi pi-calendar-times" size="small">{{
        when === 'period_end'
          ? t('cancelMembership.endsOn', { date: format.date(preview.ends_on) })
          : t('cancelMembership.endsToday')
      }}</Message>
      <div v-if="preview.owed" class="owed">
        <Message severity="warn" :closable="false" icon="pi pi-exclamation-triangle" size="small">{{
          waive
            ? t('cancelMembership.owedWaived')
            : t('cancelMembership.owed', {
                amount: format.money(preview.owed),
                n: preview.owed_periods,
                date: format.date(preview.commitment_ends_on!),
              })
        }}</Message>
        <div v-if="canWaive" class="check">
          <Checkbox v-model="waive" input-id="cancel-waive" binary />
          <label for="cancel-waive">{{ t('cancelMembership.waive') }}</label>
        </div>
      </div>
      <FormField
        v-if="canRefund"
        :label="t('cancelMembership.refund')"
        for="cancel-refund"
        :help="t('cancelMembership.refundHelp', { max: format.money(preview.refundable) })"
        :error="errors.refund?.[0]"
      >
        <InputNumber
          v-model="refund"
          input-id="cancel-refund"
          mode="currency"
          :currency="org.organization?.currency ?? 'SAR'"
          :min="0"
          :max="preview.refundable"
          :max-fraction-digits="3"
          :placeholder="t('cancelMembership.noRefund')"
          fluid
        />
      </FormField>
      <template v-if="preview.bookings.length">
        <AffectedBookingsList
          :bookings="preview.bookings"
          :title="t('cancelMembership.bookingsTitle', { n: preview.bookings.length })"
        />
      </template>
    </template>
    <FormField :label="t('cancelMembership.reason')" for="cancel-reason" required>
      <Select
        v-model="reason"
        input-id="cancel-reason"
        :options="reasonOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('cancelMembership.chooseReason')"
        fluid
      />
    </FormField>
    <FormField
      :label="t('cancelMembership.note')"
      for="cancel-note"
      :required="reason === 'other'"
      :error="errors.note?.[0]"
    >
      <Textarea id="cancel-note" v-model="note" rows="2" maxlength="500" auto-resize />
    </FormField>
  </FormDialog>
</template>

<style scoped>
.owed {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
