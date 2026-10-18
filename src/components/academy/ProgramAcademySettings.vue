<script setup lang="ts">
// How a program runs its academy: fees (US-10.10) — one term fee, the term fee in instalments,
// or a monthly fee for rolling programs, with an optional registration and kit fee and the
// mid-term rule; trial trainings (US-10.15); pauses and what a withdrawal refunds (US-10.13);
// and whether late-cancel / no-show penalties apply to enrolled trainings (US-10.09).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type AcademyProgramSettings, type EnrollmentMode } from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ programId: number; enrollmentMode: EnrollmentMode }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()
const currency = computed(() => org.organization?.currency ?? 'SAR')
const canEdit = computed(() => auth.can('services.update'))
const termBased = computed(() => props.enrollmentMode === 'Term')

const state = ref<'loading' | 'ready' | 'error'>('loading')
const saved = ref<AcademyProgramSettings | null>(null)
const form = ref<AcademyProgramSettings | null>(null)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))
const clone = (s: AcademyProgramSettings) => JSON.parse(JSON.stringify(s)) as AcademyProgramSettings

const modelOptions = computed(() =>
  (termBased.value
    ? (['none', 'term', 'instalments'] as const)
    : (['none', 'monthly'] as const)
  ).map((m) => ({ value: m, label: t(`academySettings.models.${m}`) })),
)
const midTermOptions = computed(() =>
  (['pro_rata', 'full'] as const).map((m) => ({
    value: m,
    label: t(`academySettings.midTerm.${m}`),
  })),
)
const refundOptions = computed(() =>
  (['none', 'pro_rata', 'manual'] as const).map((m) => ({
    value: m,
    label: t(`academySettings.refunds.${m}`),
  })),
)

async function load() {
  state.value = 'loading'
  try {
    saved.value = await tenantApi.academy.settings.program(props.programId)
    form.value = clone(saved.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function save() {
  if (!form.value) return
  saving.value = true
  errors.value = {}
  try {
    saved.value = await tenantApi.academy.settings.updateProgram(props.programId, form.value)
    form.value = clone(saved.value)
    toast.add({ severity: 'success', summary: t('academySettings.programSaved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    toast.add({
      severity: 'error',
      summary: Object.values(errors.value)[0]?.[0] ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <Skeleton height="48px" />
  </SettingsCard>
  <SettingsCard v-else-if="state === 'error' || !form">
    <ErrorState @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('academySettings.fees') }}
      </div>
      <SettingRow
        :label="t('academySettings.modelLabel')"
        :help="t('academySettings.modelHelp')"
        label-for="ps-model"
      >
        <Select
          v-model="form.fee.model"
          input-id="ps-model"
          :options="modelOptions"
          option-label="label"
          option-value="value"
          :disabled="!canEdit"
          class="wide"
        />
      </SettingRow>
      <template v-if="form.fee.model !== 'none'">
        <SettingRow
          :label="
            form.fee.model === 'monthly'
              ? t('academySettings.monthlyAmount')
              : t('academySettings.termAmount')
          "
          :help="t('academySettings.amountHelp')"
          label-for="ps-amount"
        >
          <InputNumber
            v-model="form.fee.amount"
            input-id="ps-amount"
            :min="0"
            :max-fraction-digits="3"
            :allow-empty="false"
            :suffix="` ${currency}`"
            :disabled="!canEdit"
            :invalid="!!errors['fee.amount']"
            class="number"
          />
        </SettingRow>
        <SettingRow
          v-if="form.fee.model === 'instalments'"
          :label="t('academySettings.instalments')"
          :help="t('academySettings.instalmentsHelp')"
          label-for="ps-instalments"
        >
          <InputNumber
            v-model="form.fee.instalments"
            input-id="ps-instalments"
            :min="2"
            :max="12"
            :allow-empty="false"
            :disabled="!canEdit"
            show-buttons
            class="number"
          />
        </SettingRow>
        <SettingRow
          v-if="form.fee.model !== 'monthly'"
          :label="t('academySettings.midTermLabel')"
          :help="t('academySettings.midTermHelp')"
        >
          <SelectButton
            v-model="form.fee.mid_term"
            :options="midTermOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :disabled="!canEdit"
          />
        </SettingRow>
      </template>
      <SettingRow
        :label="t('academySettings.registration')"
        :help="t('academySettings.registrationHelp')"
        label-for="ps-registration"
      >
        <InputNumber
          v-model="form.fee.registration_fee"
          input-id="ps-registration"
          :min="0"
          :max-fraction-digits="3"
          :allow-empty="false"
          :suffix="` ${currency}`"
          :disabled="!canEdit"
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('academySettings.kit')"
        :help="t('academySettings.kitHelp')"
        label-for="ps-kit"
      >
        <InputNumber
          v-model="form.fee.kit_fee"
          input-id="ps-kit"
          :min="0"
          :max-fraction-digits="3"
          :allow-empty="false"
          :suffix="` ${currency}`"
          :disabled="!canEdit"
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('academySettings.penalties')"
        :help="t('academySettings.penaltiesHelp')"
        label-for="ps-penalties"
      >
        <ToggleSwitch v-model="form.penalties" input-id="ps-penalties" :disabled="!canEdit" />
      </SettingRow>

      <div class="settings-group" role="heading" aria-level="3">
        {{ t('academySettings.trials') }}
      </div>
      <SettingRow :label="t('academySettings.trialsAllowed')" label-for="ps-trials">
        <ToggleSwitch v-model="form.trial.enabled" input-id="ps-trials" :disabled="!canEdit" />
      </SettingRow>
      <template v-if="form.trial.enabled">
        <SettingRow
          :label="t('academySettings.trialPrice')"
          :help="t('academySettings.trialPriceHelp')"
          label-for="ps-trial-price"
        >
          <InputNumber
            v-model="form.trial.price"
            input-id="ps-trial-price"
            :min="0"
            :max-fraction-digits="3"
            :allow-empty="false"
            :suffix="` ${currency}`"
            :disabled="!canEdit"
            class="number"
          />
        </SettingRow>
        <SettingRow :label="t('academySettings.trialMax')" label-for="ps-trial-max">
          <InputNumber
            v-model="form.trial.max_per_child"
            input-id="ps-trial-max"
            :min="1"
            :max="10"
            :allow-empty="false"
            :disabled="!canEdit"
            show-buttons
            class="number"
          />
        </SettingRow>
      </template>

      <div class="settings-group" role="heading" aria-level="3">
        {{ t('academySettings.pauses') }}
      </div>
      <SettingRow :label="t('academySettings.pauseAllowed')" label-for="ps-pause">
        <ToggleSwitch v-model="form.pause.enabled" input-id="ps-pause" :disabled="!canEdit" />
      </SettingRow>
      <template v-if="form.pause.enabled">
        <SettingRow
          :label="t('academySettings.pauseLength')"
          :help="t('academySettings.pauseLengthHelp')"
        >
          <div class="pair">
            <InputNumber
              v-model="form.pause.min_days"
              :aria-label="t('academySettings.pauseMin')"
              :min="1"
              :max="365"
              :allow-empty="false"
              :suffix="` ${t('academySettings.days')}`"
              :disabled="!canEdit"
              class="number"
            />
            <span aria-hidden="true">–</span>
            <InputNumber
              v-model="form.pause.max_days"
              :aria-label="t('academySettings.pauseMax')"
              :min="1"
              :max="365"
              :allow-empty="false"
              :suffix="` ${t('academySettings.days')}`"
              :disabled="!canEdit"
              :invalid="!!errors['pause.max_days']"
              class="number"
            />
          </div>
        </SettingRow>
        <SettingRow :label="t('academySettings.pausePerTerm')" label-for="ps-pause-n">
          <InputNumber
            v-model="form.pause.max_per_term"
            input-id="ps-pause-n"
            :min="1"
            :max="10"
            :allow-empty="false"
            :disabled="!canEdit"
            show-buttons
            class="number"
          />
        </SettingRow>
        <SettingRow
          :label="t('academySettings.keepsPlace')"
          :help="t('academySettings.keepsPlaceHelp')"
          label-for="ps-keeps"
        >
          <ToggleSwitch v-model="form.pause.keeps_place" input-id="ps-keeps" :disabled="!canEdit" />
        </SettingRow>
      </template>
      <SettingRow
        :label="t('academySettings.refundLabel')"
        :help="t('academySettings.refundHelp')"
        label-for="ps-refund"
      >
        <Select
          v-model="form.refund"
          input-id="ps-refund"
          :options="refundOptions"
          option-label="label"
          option-value="value"
          :disabled="!canEdit"
          class="wide"
        />
      </SettingRow>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="form = saved ? clone(saved) : form"
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
.wide {
  min-width: 220px;
}
.pair {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
