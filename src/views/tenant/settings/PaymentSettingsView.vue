<script setup lang="ts">
// Settings → Payments: whether whoever entered a payment or invoice may void it on the same day
// without a manager (US-07.06), and how much each role may take off by hand (US-07.07; empty: no
// limit). Above a role's limit, a manager applies the discount.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PaymentGatewayCard from '@/components/payments/PaymentGatewayCard.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type PaymentSettings } from '@/api/tenant'
import Select from 'primevue/select'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

type Form = {
  self_void_same_day: boolean
  session_cancel_refund: PaymentSettings['session_cancel_refund']
  overdue_blocks_booking: boolean
  manual_discount_limits: Record<string, number | null>
}
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const roles = ref<string[]>([])
const form = ref<Form>({
  self_void_same_day: false,
  session_cancel_refund: 'account_credit',
  overdue_blocks_booking: false,
  manual_discount_limits: {},
})
const saved = ref('')
const saving = ref(false)
const dirty = computed(() => JSON.stringify(form.value) !== saved.value)

function apply(data: PaymentSettings) {
  roles.value = data.roles
  form.value = {
    self_void_same_day: data.self_void_same_day,
    session_cancel_refund: data.session_cancel_refund,
    overdue_blocks_booking: data.overdue_blocks_booking,
    manual_discount_limits: Object.fromEntries(
      data.roles.map((r) => [r, data.manual_discount_limits[r] ?? null]),
    ),
  }
  saved.value = JSON.stringify(form.value)
}
async function load() {
  state.value = 'loading'
  try {
    apply(await tenantApi.paymentSettings.get())
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  saving.value = true
  try {
    const limits = Object.fromEntries(
      Object.entries(form.value.manual_discount_limits).filter(([, v]) => v !== null),
    ) as Record<string, number>
    apply(
      await tenantApi.paymentSettings.update({
        self_void_same_day: form.value.self_void_same_day,
        session_cancel_refund: form.value.session_cancel_refund,
        overdue_blocks_booking: form.value.overdue_blocks_booking,
        manual_discount_limits: limits,
      }),
    )
    toast.add({ severity: 'success', summary: t('paymentSettings.saved'), life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}
const roleName = (r: string) => {
  const key = `roles.${r}`
  return te(key) ? t(key) : r
}
</script>

<template>
  <div class="page">
    <SettingsCard v-if="state === 'loading'"><Skeleton height="48px" /></SettingsCard>
    <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
    <SettingsCard v-else-if="state === 'error'">
      <ErrorState :title="t('paymentSettings.loadError')" @retry="load" />
    </SettingsCard>
    <form v-else class="stack" @submit.prevent="save">
      <Message v-if="!canEdit" severity="secondary" :closable="false">{{
        t('regional.readOnly')
      }}</Message>
      <SettingsCard>
        <div class="settings-group" role="heading" aria-level="3">
          {{ t('paymentSettings.voiding') }}
        </div>
        <SettingRow
          :label="t('paymentSettings.selfVoidLabel')"
          :help="t('paymentSettings.selfVoidHelp')"
          label-for="self-void"
        >
          <ToggleSwitch
            v-model="form.self_void_same_day"
            input-id="self-void"
            :disabled="!canEdit"
          />
        </SettingRow>
        <div class="settings-group" role="heading" aria-level="3">
          {{ t('paymentSettings.refunds') }}
        </div>
        <SettingRow
          :label="t('paymentSettings.sessionRefundLabel')"
          :help="t('paymentSettings.sessionRefundHelp')"
          label-for="session-refund"
        >
          <Select
            v-model="form.session_cancel_refund"
            input-id="session-refund"
            :options="[
              { value: 'account_credit', label: t('refunds.toCredit') },
              { value: 'original', label: t('paymentSettings.originalMethod') },
              { value: 'none', label: t('paymentSettings.noAutoRefund') },
            ]"
            option-label="label"
            option-value="value"
            :disabled="!canEdit"
            class="select"
          />
        </SettingRow>
        <div class="settings-group" role="heading" aria-level="3">
          {{ t('paymentSettings.overdue') }}
        </div>
        <SettingRow
          :label="t('paymentSettings.overdueBlocksLabel')"
          :help="t('paymentSettings.overdueBlocksHelp')"
          label-for="overdue-blocks"
        >
          <ToggleSwitch
            v-model="form.overdue_blocks_booking"
            input-id="overdue-blocks"
            :disabled="!canEdit"
          />
        </SettingRow>
        <div class="settings-group" role="heading" aria-level="3">
          {{ t('paymentSettings.discounts') }}
        </div>
        <SettingRow
          :label="t('paymentSettings.limitsLabel')"
          :help="t('paymentSettings.limitsHelp')"
        >
          <ul class="limits">
            <li v-for="r in roles" :key="r">
              <label :for="`limit-${r}`">{{ roleName(r) }}</label>
              <InputNumber
                v-model="form.manual_discount_limits[r]"
                :input-id="`limit-${r}`"
                :min="0"
                :max="100"
                suffix="%"
                :placeholder="t('paymentSettings.noLimit')"
                :disabled="!canEdit"
                class="limit"
              />
            </li>
          </ul>
        </SettingRow>
      </SettingsCard>
      <UnsavedBar
        v-if="canEdit && dirty"
        :saving="saving"
        @discard="form = JSON.parse(saved)"
        @save="save"
      />
    </form>
    <PaymentGatewayCard v-if="state === 'ready'" :can-edit="canEdit" />
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.limits {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 260px;
}
.limits li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.select {
  min-width: 220px;
}
.limit {
  width: 120px;
}
.limit :deep(input) {
  width: 100%;
  min-width: 0;
}
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
</style>
