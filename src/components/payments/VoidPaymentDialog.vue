<script setup lang="ts">
// Void a payment entered by mistake (US-07.06): a reason is required; the invoices it paid reopen
// and any account credit it used or made is put back. The receipt stays, stamped Void.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type Payment } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ payment: Payment | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ voided: [payment: Payment] }>()
const { t } = useI18n()
const format = useFormat()
const reason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  reason.value = ''
  error.value = null
})
async function save() {
  if (!props.payment || !reason.value.trim()) return
  saving.value = true
  error.value = null
  try {
    const voided = await tenantApi.payments.void(props.payment.id, reason.value.trim())
    visible.value = false
    emit('voided', voided)
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('voiding.paymentTitle', { receipt: payment?.receipt_number ?? '' })"
    :subtitle="payment ? format.money(payment.amount) : ''"
    icon="pi-ban"
    size="sm"
    :save-label="t('voiding.voidPayment')"
    danger
    :saving="saving"
    :save-disabled="!reason.trim()"
    :error="error"
    @save="save"
  >
    <p class="text">{{ t('voiding.paymentText') }}</p>
    <FormField :label="t('voiding.reason')" for="void-pay-reason" required>
      <Textarea id="void-pay-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
    </FormField>
  </FormDialog>
</template>

<style scoped>
.text {
  margin: 0;
}
</style>
