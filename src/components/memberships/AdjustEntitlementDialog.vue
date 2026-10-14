<script setup lang="ts">
// Manual adjustment (US-06.09, entitlements.adjust): add or remove a package's credits and/or move
// the end date later, always with a reason. Audited.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type ClientEntitlement } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()

const credits = ref<number | null>(null)
const endsOn = ref<Date | null>(null)
const reason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  credits.value = null
  endsOn.value = null
  reason.value = ''
  error.value = null
})

const e = computed(() => props.entitlement)
const minEnd = computed(() => {
  if (!e.value?.ends_on) return undefined
  const d = new Date(`${e.value.ends_on}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d
})
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ready = computed(() => (!!credits.value || !!endsOn.value) && !!reason.value.trim())

async function save() {
  if (!e.value || !ready.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await tenantApi.clients.adjustEntitlement(props.clientId, e.value.id, {
      credits: credits.value || null,
      ends_on: endsOn.value ? ymd(endsOn.value) : null,
      reason: reason.value.trim(),
    })
    visible.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('adjust.title')"
    :subtitle="e?.name"
    icon="pi-sliders-h"
    size="sm"
    :save-label="t('adjust.save')"
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <FormField
      v-if="e?.credits_total !== null"
      :label="t('adjust.credits')"
      for="adjust-credits"
      :help="t('adjust.creditsHelp', { n: e?.credits_left ?? 0 })"
    >
      <InputNumber
        v-model="credits"
        input-id="adjust-credits"
        :min="-(e?.credits_left ?? 0)"
        :max="500"
        show-buttons
        fluid
      />
    </FormField>
    <FormField
      v-if="e?.ends_on"
      :label="t('adjust.endsOn')"
      for="adjust-ends"
      :help="t('adjust.endsOnHelp')"
    >
      <DatePicker
        v-model="endsOn"
        input-id="adjust-ends"
        :min-date="minEnd"
        show-icon
        icon-display="input"
        fluid
      />
    </FormField>
    <FormField :label="t('adjust.reason')" for="adjust-reason" required>
      <Textarea id="adjust-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
    </FormField>
  </FormDialog>
</template>
