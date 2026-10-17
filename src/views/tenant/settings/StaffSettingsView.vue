<script setup lang="ts">
// Settings → Staff & scheduling (EP-09): whether time off a coach asks for needs a manager's
// approval (US-09.04), and the travel time between one coach's sessions at two branches (US-09.05).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type StaffSettings } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const saved = ref<StaffSettings>({ time_off_approval: false, travel_buffer_minutes: 0 })
const form = ref<StaffSettings>({ ...saved.value })
const saving = ref(false)
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))
async function load() {
  try {
    saved.value = await tenantApi.staffSettings.get()
    form.value = { ...saved.value }
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)
async function save() {
  saving.value = true
  try {
    saved.value = await tenantApi.staffSettings.update(form.value)
    form.value = { ...saved.value }
    toast.add({ severity: 'success', summary: t('staffSettings.saved'), life: 3000 })
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
  <SettingsCard v-else-if="state === 'error'"><ErrorState @retry="load" /></SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <SettingsCard>
      <SettingRow
        :label="t('staffSettings.approvalLabel')"
        :help="t('staffSettings.approvalHelp')"
        label-for="staff-approval"
      >
        <ToggleSwitch
          v-model="form.time_off_approval"
          input-id="staff-approval"
          :disabled="!canEdit"
        />
      </SettingRow>
      <SettingRow
        :label="t('staffSettings.travelLabel')"
        :help="t('staffSettings.travelHelp')"
        label-for="staff-travel"
      >
        <InputNumber
          v-model="form.travel_buffer_minutes"
          input-id="staff-travel"
          :min="0"
          :max="240"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="form = { ...saved }"
      @save="save"
    />
  </form>
</template>

<style scoped>
.number {
  width: 180px;
}
</style>
