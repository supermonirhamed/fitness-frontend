<script setup lang="ts">
// Settings → Academy (EP-10): the sibling discount for a family's 2nd, 3rd… child in the same term
// (US-10.10), how long a waiting-list family has to take an offered place (US-10.11), and whether
// guardians hear when a child misses a training without notice (US-10.16). Fees, trials, pauses
// and refunds are set per program.
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
import { tenantApi, type AcademyOrganizationSettings } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const saved = ref<AcademyOrganizationSettings>({
  sibling_discount_percent: 0,
  waitlist_offer_hours: 48,
  notify_absence: true,
})
const form = ref<AcademyOrganizationSettings>({ ...saved.value })
const saving = ref(false)
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

async function load() {
  state.value = 'loading'
  try {
    saved.value = await tenantApi.academy.settings.get()
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
    saved.value = await tenantApi.academy.settings.update(form.value)
    form.value = { ...saved.value }
    toast.add({ severity: 'success', summary: t('academySettings.saved'), life: 3000 })
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
    <ErrorState :title="t('academySettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <SettingsCard>
      <SettingRow
        :label="t('academySettings.siblingLabel')"
        :help="t('academySettings.siblingHelp')"
        label-for="acad-sibling"
      >
        <InputNumber
          v-model="form.sibling_discount_percent"
          input-id="acad-sibling"
          :min="0"
          :max="100"
          :max-fraction-digits="2"
          :allow-empty="false"
          suffix=" %"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('academySettings.offerLabel')"
        :help="t('academySettings.offerHelp')"
        label-for="acad-offer"
      >
        <InputNumber
          v-model="form.waitlist_offer_hours"
          input-id="acad-offer"
          :min="1"
          :max="336"
          :allow-empty="false"
          :suffix="` ${t('attendanceSettings.hours')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('academySettings.absenceLabel')"
        :help="t('academySettings.absenceHelp')"
        label-for="acad-absence"
      >
        <ToggleSwitch v-model="form.notify_absence" input-id="acad-absence" :disabled="!canEdit" />
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
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.number {
  width: 180px;
}
</style>
