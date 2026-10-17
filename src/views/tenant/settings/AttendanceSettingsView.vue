<script setup lang="ts">
// Settings → Check-in & attendance (EP-08): when check-in opens before a session and closes after
// it starts (US-08.01), how long the desk can undo a check-in without a manager (US-08.08), and
// for how long after a session coaches can still edit its attendance (US-08.04), and when a
// client's attendance rate is flagged as low (US-08.10).
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
import { tenantApi, type AttendanceSettings } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const saved = ref<AttendanceSettings>({
  opens_minutes_before: 60,
  closes_minutes_after: 15,
  undo_minutes: 30,
  coach_edit_hours: 24,
  low_rate_threshold: 50,
  min_sessions: 3,
})
const form = ref<AttendanceSettings>({ ...saved.value })
const saving = ref(false)
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

async function load() {
  state.value = 'loading'
  try {
    saved.value = await tenantApi.attendanceSettings.get()
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
    saved.value = await tenantApi.attendanceSettings.update(form.value)
    form.value = { ...saved.value }
    toast.add({ severity: 'success', summary: t('attendanceSettings.saved'), life: 3000 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
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
    <ErrorState :title="t('attendanceSettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('attendanceSettings.window') }}
      </div>
      <SettingRow
        :label="t('attendanceSettings.opensLabel')"
        :help="t('attendanceSettings.opensHelp')"
        label-for="att-opens"
      >
        <InputNumber
          v-model="form.opens_minutes_before"
          input-id="att-opens"
          :min="0"
          :max="1440"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('attendanceSettings.closesLabel')"
        :help="t('attendanceSettings.closesHelp')"
        label-for="att-closes"
      >
        <InputNumber
          v-model="form.closes_minutes_after"
          input-id="att-closes"
          :min="0"
          :max="1440"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('attendanceSettings.corrections') }}
      </div>
      <SettingRow
        :label="t('attendanceSettings.undoLabel')"
        :help="t('attendanceSettings.undoHelp')"
        label-for="att-undo"
      >
        <InputNumber
          v-model="form.undo_minutes"
          input-id="att-undo"
          :min="0"
          :max="1440"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('attendanceSettings.coachLabel')"
        :help="t('attendanceSettings.coachHelp')"
        label-for="att-coach"
      >
        <InputNumber
          v-model="form.coach_edit_hours"
          input-id="att-coach"
          :min="0"
          :max="720"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.hours')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('attendanceSettings.rates') }}
      </div>
      <SettingRow
        :label="t('attendanceSettings.thresholdLabel')"
        :help="t('attendanceSettings.thresholdHelp')"
        label-for="att-threshold"
      >
        <InputNumber
          v-model="form.low_rate_threshold"
          input-id="att-threshold"
          :min="0"
          :max="100"
          :allow-empty="false"
          suffix=" %"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('attendanceSettings.minSessionsLabel')"
        :help="t('attendanceSettings.minSessionsHelp')"
        label-for="att-min"
      >
        <InputNumber
          v-model="form.min_sessions"
          input-id="att-min"
          :min="1"
          :max="100"
          :allow-empty="false"
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
