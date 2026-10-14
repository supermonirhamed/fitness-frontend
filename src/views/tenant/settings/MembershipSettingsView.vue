<script setup lang="ts">
// Settings → Memberships (US-06.10): how many days a renewal invoice may stay unpaid before the
// membership is suspended (no booking or check-in until it is paid).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const saved = ref(7)
const graceDays = ref(7)
const saving = ref(false)
const error = ref<string | null>(null)
const dirty = computed(() => graceDays.value !== saved.value)

async function load() {
  state.value = 'loading'
  try {
    saved.value = graceDays.value = (await tenantApi.membershipSettings.get()).grace_days
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  saving.value = true
  error.value = null
  try {
    saved.value = graceDays.value = (
      await tenantApi.membershipSettings.update({ grace_days: graceDays.value })
    ).grace_days
    toast.add({ severity: 'success', summary: t('membershipSettings.saved'), life: 3000 })
  } catch {
    error.value = t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <Skeleton height="48px" />
  </SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('membershipSettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('membershipSettings.renewals') }}
      </div>
      <SettingRow
        :label="t('membershipSettings.graceLabel')"
        :help="t('membershipSettings.graceHelp')"
        :example="t('membershipSettings.graceExample', { n: graceDays })"
        label-for="membership-grace"
      >
        <InputNumber
          v-model="graceDays"
          input-id="membership-grace"
          :min="0"
          :max="90"
          :allow-empty="false"
          :suffix="` ${t('plans.units.days')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="graceDays = saved"
      @save="save"
    />
  </form>
</template>

<style scoped>
.number {
  max-width: 220px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
