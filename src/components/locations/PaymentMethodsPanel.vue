<script setup lang="ts">
// Payment methods of a branch (US-07.03): which it takes (cash, bank transfer, card terminal,
// cheque, account credit, other) and which need a reference (transfer ID, slip or cheque number).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import { tenantApi, type PaymentMethod, type PaymentMethodSettings } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { usePaymentMethods } from '@/composables/usePaymentMethods'

const props = defineProps<{ locationId: number; canEdit: boolean }>()
const { t } = useI18n()
const toast = useToast()
const { forget } = usePaymentMethods(ref(null))

const ALL: PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'card_terminal',
  'cheque',
  'account_credit',
  'other',
]
const ICONS: Record<PaymentMethod, string> = {
  cash: 'pi-money-bill',
  bank_transfer: 'pi-building-columns',
  card_terminal: 'pi-credit-card',
  cheque: 'pi-file-edit',
  account_credit: 'pi-wallet',
  other: 'pi-ellipsis-h',
}
const state = ref<'loading' | 'ready' | 'error'>('loading')
const form = ref<PaymentMethodSettings>({ methods: [], reference_required: [] })
const saved = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

async function load() {
  state.value = 'loading'
  try {
    form.value = await tenantApi.paymentMethods.get(props.locationId)
    saved.value = JSON.stringify(form.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

function toggle(method: PaymentMethod, on: boolean) {
  form.value.methods = on
    ? ALL.filter((m) => m === method || form.value.methods.includes(m))
    : form.value.methods.filter((m) => m !== method)
}
async function save() {
  saving.value = true
  error.value = null
  try {
    form.value = await tenantApi.paymentMethods.update(props.locationId, form.value)
    saved.value = JSON.stringify(form.value)
    forget(props.locationId)
    toast.add({ severity: 'success', summary: t('paymentMethods.saved'), life: 3000 })
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'"><Skeleton height="200px" /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('paymentMethods.loadError')" @retry="load" />
  </SettingsCard>
  <SettingsCard v-else>
    <div class="head">
      <div>
        <h3>{{ t('paymentMethods.title') }}</h3>
        <p class="muted">{{ t('paymentMethods.hint') }}</p>
      </div>
      <Button
        v-if="canEdit"
        :label="t('common.save')"
        :loading="saving"
        :disabled="JSON.stringify(form) === saved || !form.methods.length"
        @click="save"
      />
    </div>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <Message v-if="!form.methods.length" severity="warn" :closable="false" size="small">{{
      t('paymentMethods.atLeastOne')
    }}</Message>
    <ul class="methods">
      <li
        v-for="m in ALL"
        :key="m"
        :class="['method', { 'method--off': !form.methods.includes(m) }]"
      >
        <span class="method__icon"><i :class="['pi', ICONS[m]]" aria-hidden="true" /></span>
        <span class="method__name">{{ t(`payments.methods.${m}`) }}</span>
        <label v-if="m !== 'cash' && m !== 'account_credit'" class="ref">
          <Checkbox
            v-model="form.reference_required"
            :value="m"
            :disabled="!canEdit || !form.methods.includes(m)"
            :input-id="`ref-${m}`"
          />
          <span>{{ t('paymentMethods.referenceRequired') }}</span>
        </label>
        <ToggleSwitch
          :model-value="form.methods.includes(m)"
          :disabled="!canEdit"
          :aria-label="t('paymentMethods.takes', { method: t(`payments.methods.${m}`) })"
          @update:model-value="toggle(m, $event)"
        />
      </li>
    </ul>
  </SettingsCard>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.head h3 {
  margin: 0;
  font: var(--text-h4);
}
.muted {
  margin: 4px 0 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.methods {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.method {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--border-subtle);
}
.method--off .method__name,
.method--off .method__icon {
  opacity: 0.5;
}
.method__icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.method__name {
  flex: 1;
  font: 500 14px var(--font-sans);
}
.ref {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
