<script setup lang="ts">
// Settings → Payments → Online payments (US-07.12): the gateway that takes cards in the client app
// and charges saved cards on renewal (US-07.13), for the whole organization or a branch that uses
// another account. Secrets are write-only: leave a field empty to keep what is saved. The sandbox
// takes test cards and needs no account.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import { tenantApi, type GatewaySetup, type PaymentGatewaySettings } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'

defineProps<{ canEdit: boolean }>()
const { t } = useI18n()
const toast = useToast()
const settings = ref<PaymentGatewaySettings | null>(null)
const scope = ref<'org' | number>('org')
const driver = ref<string>('none')
const credentials = ref<Record<string, string>>({})
const saving = ref(false)
const errors = ref<Record<string, string[]>>({})
const error = ref<string | null>(null)

const current = computed<GatewaySetup | null>(() => {
  if (!settings.value) return null
  return scope.value === 'org'
    ? settings.value.organization
    : (settings.value.locations.find((l) => l.id === scope.value) ?? null)
})
const fields = computed<{ fields: string[]; secret: string[] }>(
  () => settings.value?.drivers.find((d) => d.key === driver.value) ?? { fields: [], secret: [] },
)
const scopeOptions = computed(() => [
  { value: 'org', label: t('notificationSettings.scopeOrg') },
  ...(settings.value?.locations ?? []).map((l) => ({ value: l.id, label: l.name })),
])
const driverOptions = computed(() => [
  {
    value: 'none',
    label: scope.value === 'org' ? t('gateway.none') : t('gateway.useOrganization'),
  },
  { value: 'sandbox', label: t('gateway.drivers.sandbox') },
  { value: 'stripe', label: t('gateway.drivers.stripe') },
])
function reset() {
  driver.value = current.value?.driver ?? 'none'
  credentials.value = {}
  errors.value = {}
  error.value = null
}
watch(scope, reset)
onMounted(async () => {
  settings.value = await tenantApi.paymentGateway.get().catch(() => null)
  reset()
})

async function save() {
  saving.value = true
  errors.value = {}
  error.value = null
  try {
    settings.value = await tenantApi.paymentGateway.update({
      location_id: scope.value === 'org' ? null : scope.value,
      driver: driver.value === 'none' ? null : driver.value,
      credentials: credentials.value,
    })
    reset()
    toast.add({ severity: 'success', summary: t('gateway.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length
      ? null
      : (firstMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
const dirty = computed(
  () =>
    driver.value !== (current.value?.driver ?? 'none') ||
    Object.values(credentials.value).some((v) => v),
)
</script>

<template>
  <SettingsCard>
    <div class="settings-group" role="heading" aria-level="3">{{ t('gateway.title') }}</div>
    <p class="muted small">{{ t('gateway.help') }}</p>
    <Skeleton v-if="!settings" height="80px" />
    <template v-else>
      <SettingRow v-if="settings.locations.length" :label="t('notificationSettings.scope')">
        <Select
          v-model="scope"
          :options="scopeOptions"
          option-label="label"
          option-value="value"
          class="select"
        />
      </SettingRow>
      <SettingRow
        :label="t('gateway.provider')"
        :help="t('gateway.providerHelp')"
        label-for="gw-driver"
      >
        <Select
          v-model="driver"
          input-id="gw-driver"
          :options="driverOptions"
          option-label="label"
          option-value="value"
          :disabled="!canEdit"
          class="select"
        />
      </SettingRow>
      <Message v-if="driver === 'sandbox'" severity="info" :closable="false">{{
        t('gateway.sandboxHelp')
      }}</Message>
      <SettingRow
        v-for="f in fields.fields"
        :key="f"
        :label="t(`gateway.fields.${f}`)"
        :help="
          fields.secret.includes(f) && current?.driver === driver && current?.credentials[f]
            ? t('gateway.keepSecret', { saved: current.credentials[f] })
            : undefined
        "
        :label-for="`gw-${f}`"
      >
        <div class="field">
          <InputText
            :id="`gw-${f}`"
            v-model="credentials[f]"
            :type="fields.secret.includes(f) ? 'password' : 'text'"
            :placeholder="(current?.driver === driver ? current?.credentials[f] : null) ?? ''"
            autocomplete="off"
            dir="ltr"
            :invalid="!!errors[`credentials.${f}`]"
            :disabled="!canEdit"
          />
          <small v-if="errors[`credentials.${f}`]" class="error">{{
            errors[`credentials.${f}`]?.[0]
          }}</small>
        </div>
      </SettingRow>
      <SettingRow
        v-if="driver === 'stripe'"
        :label="t('gateway.webhook')"
        :help="t('gateway.webhookHelp')"
      >
        <code dir="ltr" class="code">{{ settings.webhook_urls[driver] }}</code>
      </SettingRow>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <div v-if="canEdit" class="actions">
        <Button :label="t('gateway.save')" :loading="saving" :disabled="!dirty" @click="save" />
      </div>
    </template>
  </SettingsCard>
</template>

<style scoped>
.muted {
  margin: 0;
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.select {
  min-width: 220px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 260px;
}
.error {
  color: var(--sev-danger-fg, var(--red-600));
}
.code {
  font-family: var(--font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
