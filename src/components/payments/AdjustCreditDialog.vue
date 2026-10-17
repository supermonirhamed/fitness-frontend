<script setup lang="ts">
// A manual account credit adjustment (US-07.09, payments.adjust_credit): add or take an amount
// with a mandatory reason. It is audited, and the balance cannot go below zero.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ clientId: number; balance: number }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const format = useFormat()

const direction = ref<'add' | 'take'>('add')
const amount = ref<number | null>(null)
const reason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  direction.value = 'add'
  amount.value = null
  reason.value = ''
  error.value = null
})
const directions = computed(() => [
  { value: 'add', label: t('accountCredit.add') },
  { value: 'take', label: t('accountCredit.take') },
])
const after = computed(() =>
  amount.value ? props.balance + (direction.value === 'add' ? amount.value : -amount.value) : null,
)
const valid = computed(
  () => !!amount.value && amount.value > 0 && !!reason.value.trim() && (after.value ?? 0) >= 0,
)

async function save() {
  if (!valid.value || !amount.value) return
  saving.value = true
  error.value = null
  try {
    await tenantApi.clients.adjustCredit(
      props.clientId,
      direction.value === 'add' ? amount.value : -amount.value,
      reason.value.trim(),
    )
    visible.value = false
    emit('saved')
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
    :title="t('accountCredit.adjustTitle')"
    :subtitle="t('accountCredit.current', { amount: format.money(balance) })"
    icon="pi-wallet"
    size="sm"
    :save-label="t('accountCredit.adjust')"
    :saving="saving"
    :save-disabled="!valid"
    :error="error"
    @save="save"
  >
    <SelectButton
      v-model="direction"
      :options="directions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
    />
    <FormField :label="t('accountCredit.amount')" for="credit-amount" required>
      <InputNumber
        v-model="amount"
        input-id="credit-amount"
        :min="0"
        :max-fraction-digits="2"
        :invalid="after !== null && after < 0"
        fluid
      />
    </FormField>
    <p v-if="after !== null" :class="['after', { bad: after < 0 }]">
      {{
        after < 0
          ? t('accountCredit.belowZero')
          : t('accountCredit.after', { amount: format.money(after) })
      }}
    </p>
    <FormField :label="t('accountCredit.reason')" for="credit-reason" required>
      <Textarea id="credit-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
    </FormField>
  </FormDialog>
</template>

<style scoped>
.after {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.after.bad {
  color: var(--sev-danger-fg, var(--red-600));
}
</style>
