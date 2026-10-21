<script setup lang="ts">
// The organization's monthly SMS limit (US-12.16): its plan's, or one of its own in SMS parts;
// a hard limit stops even essential SMS. Audited on the platform.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import RadioButton from 'primevue/radiobutton'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import { platformApi, type Tenant } from '@/api/platform'
import { validationErrors } from '@/lib/http'

const props = defineProps<{ tenant: Tenant | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ updated: [tenant: Tenant] }>()
const { t } = useI18n()

const own = ref(false)
const limit = ref<number | null>(null)
const hard = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open || !props.tenant) return
  own.value = props.tenant.sms_monthly_limit !== null
  limit.value = props.tenant.sms_monthly_limit ?? props.tenant.sms?.limit ?? 1000
  hard.value = props.tenant.sms_hard_limit
  error.value = null
})

async function save() {
  if (!props.tenant) return
  saving.value = true
  error.value = null
  try {
    const updated = await platformApi.updateSmsLimit(props.tenant.id, {
      sms_monthly_limit: own.value ? (limit.value ?? 0) : null,
      sms_hard_limit: hard.value,
    })
    emit('updated', updated)
    visible.value = false
  } catch (e) {
    const errors = validationErrors(e)
    error.value =
      errors.sms_monthly_limit?.[0] ?? errors.sms_hard_limit?.[0] ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="t('platform.tenants.smsLimit.title')"
    :subtitle="tenant?.name"
    :saving="saving"
    :error="error"
    @save="save"
  >
    <p v-if="tenant?.sms" class="muted">
      {{
        tenant.sms.limit === null
          ? t('platform.tenants.smsLimit.usedNoLimit', { used: tenant.sms.used })
          : t('platform.tenants.smsLimit.used', { used: tenant.sms.used, limit: tenant.sms.limit })
      }}
    </p>
    <label class="choice">
      <RadioButton v-model="own" :value="false" input-id="sms-plan" />
      <span>{{ t('platform.tenants.smsLimit.plan', { plan: tenant?.plan ?? '—' }) }}</span>
    </label>
    <label class="choice">
      <RadioButton v-model="own" :value="true" input-id="sms-own" />
      <span>{{ t('platform.tenants.smsLimit.own') }}</span>
    </label>
    <InputNumber
      v-if="own"
      v-model="limit"
      :min="0"
      :max="10000000"
      :suffix="` ${t('platform.tenants.smsLimit.parts')}`"
      :aria-label="t('platform.tenants.smsLimit.own')"
      fluid
    />
    <label class="choice">
      <Checkbox v-model="hard" binary input-id="sms-hard" />
      <span>
        {{ t('platform.tenants.smsLimit.hard') }}
        <small class="muted">{{ t('platform.tenants.smsLimit.hardHelp') }}</small>
      </span>
    </label>
  </FormDrawer>
</template>

<style scoped>
.choice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}
.choice small {
  display: block;
}
.muted {
  margin: 0;
  color: var(--text-muted);
  font: var(--text-small);
}
</style>
