<script setup lang="ts">
// Settings → Payments (US-07.06): whether whoever entered a payment or invoice may void it on the
// same day without a manager (otherwise voiding needs payments.void).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import { tenantApi } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const selfVoid = ref(false)
const saving = ref(false)
async function load() {
  state.value = 'loading'
  try {
    selfVoid.value = (await tenantApi.paymentSettings.get()).self_void_same_day
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function toggle(value: boolean) {
  saving.value = true
  try {
    selfVoid.value = (
      await tenantApi.paymentSettings.update({ self_void_same_day: value })
    ).self_void_same_day
    toast.add({ severity: 'success', summary: t('paymentSettings.saved'), life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'"><Skeleton height="48px" /></SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('paymentSettings.loadError')" @retry="load" />
  </SettingsCard>
  <div v-else class="stack">
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
          :model-value="selfVoid"
          input-id="self-void"
          :disabled="!canEdit || saving"
          @update:model-value="toggle"
        />
      </SettingRow>
    </SettingsCard>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
