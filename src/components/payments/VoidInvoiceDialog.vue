<script setup lang="ts">
// Void an invoice entered by mistake (US-07.06): only once no payment on it remains, with a
// reason. It stays, marked Void, and leaves revenue totals. What it sold (memberships, packages)
// is cancelled with it once staff confirm.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type InvoiceDocument } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ invoice: InvoiceDocument }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ voided: [invoice: InvoiceDocument] }>()
const { t } = useI18n()
const reason = ref('')
const confirmAccess = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  reason.value = ''
  confirmAccess.value = false
  error.value = null
})
const hasPayments = computed(() => props.invoice.paid > 0)
const ready = computed(
  () =>
    !hasPayments.value &&
    !!reason.value.trim() &&
    (!props.invoice.access.length || confirmAccess.value),
)
async function save() {
  if (!ready.value) return
  saving.value = true
  error.value = null
  try {
    const voided = await tenantApi.invoices.void(
      props.invoice.id,
      reason.value.trim(),
      confirmAccess.value,
    )
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
    :title="t('voiding.invoiceTitle', { number: invoice.number })"
    icon="pi-ban"
    size="sm"
    :save-label="t('voiding.voidInvoice')"
    danger
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <Message v-if="hasPayments" severity="warn" :closable="false" size="small">{{
      t('voiding.hasPayments')
    }}</Message>
    <template v-else>
      <p class="text">{{ t('voiding.invoiceText') }}</p>
      <div v-if="invoice.access.length" class="access">
        <Message severity="warn" :closable="false" size="small">{{
          t('voiding.cancelsAccess', { names: invoice.access.map((a) => a.name).join('، ') })
        }}</Message>
        <div class="check">
          <Checkbox v-model="confirmAccess" input-id="void-access" binary />
          <label for="void-access">{{ t('voiding.confirmAccess') }}</label>
        </div>
      </div>
      <FormField :label="t('voiding.reason')" for="void-inv-reason" required>
        <Textarea id="void-inv-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
      </FormField>
    </template>
  </FormDialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.access {
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
