<script setup lang="ts">
// Refund all or part of a payment (US-07.08): up to what was paid and not refunded yet, with a
// reason; back by the original method (recorded here, with a reference) or to account credit. A
// credit note reverses the VAT. For each membership or package it bought, staff keep it, take
// credits off (never the used ones) or cancel it; the credits used are shown first.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type Payment, type RefundTerms } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{ payment: Payment | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ refunded: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const org = useOrganization()

const terms = ref<RefundTerms | null>(null)
const amount = ref<number | null>(null)
const destination = ref<'original' | 'account_credit'>('original')
const reference = ref('')
const reason = ref('')
const access = ref<
  Record<number, { action: 'keep' | 'reduce' | 'cancel'; credits: number | null }>
>({})
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})

watch(visible, async (open) => {
  if (!open || !props.payment) return
  terms.value = null
  error.value = null
  errors.value = {}
  reason.value = ''
  reference.value = ''
  destination.value = props.payment.method === 'account_credit' ? 'account_credit' : 'original'
  try {
    terms.value = await tenantApi.payments.refundTerms(props.payment.id)
    amount.value = terms.value.refundable
    access.value = Object.fromEntries(
      terms.value.access.map((a) => [a.id, { action: 'keep' as const, credits: null }]),
    )
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  }
})

const destinationOptions = computed(() => [
  {
    value: 'original',
    label: t('refunds.toOriginal', {
      method: t(`payments.methods.${props.payment?.method ?? 'cash'}`),
    }),
  },
  { value: 'account_credit', label: t('refunds.toCredit') },
])
const actionOptions = computed(() =>
  (['keep', 'reduce', 'cancel'] as const).map((v) => ({
    value: v,
    label: t(`refunds.actions.${v}`),
  })),
)
const ready = computed(
  () =>
    !!terms.value &&
    !!amount.value &&
    amount.value > 0 &&
    amount.value <= terms.value.refundable &&
    !!reason.value.trim() &&
    Object.values(access.value).every((a) => a.action !== 'reduce' || (a.credits ?? 0) > 0),
)

async function save() {
  if (!props.payment || !ready.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const refund = await tenantApi.payments.refund(props.payment.id, {
      amount: amount.value!,
      destination: destination.value,
      reference: reference.value.trim() || null,
      reason: reason.value.trim(),
      access: access.value,
    })
    visible.value = false
    toast.add({
      severity: 'success',
      summary: t('refunds.done', { note: refund.credit_note }),
      detail: format.money(refund.amount),
      life: 5000,
    })
    emit('refunded')
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = apiMessage(e) ?? Object.values(errors.value)[0]?.[0] ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('refunds.title', { receipt: payment?.receipt_number ?? '' })"
    :subtitle="payment ? format.money(payment.amount) : ''"
    icon="pi-replay"
    size="md"
    :save-label="t('refunds.save')"
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <Skeleton v-if="!terms && !error" height="120px" />
    <template v-else-if="terms">
      <p v-if="terms.refunded" class="muted">
        {{ t('refunds.alreadyRefunded', { amount: format.money(terms.refunded) }) }}
      </p>
      <div class="grid2">
        <FormField
          :label="t('refunds.amount')"
          for="refund-amount"
          required
          :help="t('refunds.upTo', { amount: format.money(terms.refundable) })"
          :error="errors.amount?.[0]"
        >
          <InputNumber
            v-model="amount"
            input-id="refund-amount"
            mode="currency"
            :currency="org.organization?.currency ?? 'SAR'"
            :min="0"
            :max="terms.refundable"
            :max-fraction-digits="3"
            fluid
          />
        </FormField>
        <FormField
          v-if="destination === 'original'"
          :label="t('payments.reference')"
          for="refund-ref"
          :help="t('refunds.referenceHelp')"
        >
          <InputText id="refund-ref" v-model="reference" maxlength="100" fluid />
        </FormField>
      </div>
      <FormField :label="t('refunds.destination')" for="refund-dest">
        <SelectButton
          v-model="destination"
          :options="destinationOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="payment?.method === 'account_credit'"
        />
      </FormField>
      <Message severity="secondary" :closable="false" size="small" icon="pi pi-file">{{
        t('refunds.creditNoteNote')
      }}</Message>

      <div v-if="terms.access.length" class="access">
        <span class="label">{{ t('refunds.accessTitle') }}</span>
        <div v-for="a in terms.access" :key="a.id" class="access__row">
          <div class="access__what">
            <strong>{{ a.name }}</strong>
            <small v-if="a.credits_total !== null" class="muted">{{
              t('refunds.creditsUsed', { used: a.credits_used, left: a.credits_left ?? 0 })
            }}</small>
          </div>
          <SelectButton
            v-model="access[a.id]!.action"
            :options="actionOptions.filter((o) => o.value !== 'reduce' || a.credits_total !== null)"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
          />
          <InputNumber
            v-if="access[a.id]!.action === 'reduce'"
            v-model="access[a.id]!.credits"
            :min="1"
            :max="a.credits_left ?? 0"
            :placeholder="t('refunds.credits')"
            size="small"
            class="credits"
          />
        </div>
      </div>

      <FormField :label="t('refunds.reason')" for="refund-reason" required>
        <Textarea id="refund-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
      </FormField>
    </template>
  </FormDialog>
</template>

<style scoped>
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.label {
  font: 500 14px var(--font-sans);
}
.access {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.access__row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.access__what {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 160px;
}
.credits {
  width: 100px;
}
</style>
