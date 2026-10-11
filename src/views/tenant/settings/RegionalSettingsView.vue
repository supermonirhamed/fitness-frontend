<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import SelectButton from 'primevue/selectbutton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type RegionalSettings } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf, validationErrors } from '@/lib/http'
import {
  formatDate,
  formatTime,
  zoneAbbreviation,
  type DatePattern,
  type TimeFormat,
} from '@/lib/datetime'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const form = ref<RegionalSettings | null>(null)
const saved = ref<RegionalSettings | null>(null)
const currencyLocked = ref(false)
const options = ref({
  currencies: [] as string[],
  locales: [] as string[],
  date_formats: [] as string[],
  time_formats: [] as string[],
})
const saving = ref(false)
const error = ref<string | null>(null)
const canEdit = computed(() => auth.can('settings.update'))

const sample = new Date()
const timezones = Intl.supportedValuesOf('timeZone')
const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const currencyOptions = computed(() =>
  options.value.currencies.map((c) => ({ value: c, label: `${c} — ${currencyName(c)}` })),
)
const localeOptions = computed(() =>
  options.value.locales.map((l) => ({ value: l, label: t(`profile.languages.${l}`) })),
)
const dateOptions = computed(() =>
  options.value.date_formats.map((f) => ({
    value: f,
    label: formatDate(sample, f as DatePattern, form.value?.timezone, locale.value),
  })),
)
// The design offers Saturday, Sunday and Monday; another saved day stays selectable.
const weekOptions = computed(() =>
  [
    6,
    0,
    1,
    ...(form.value && ![6, 0, 1].includes(form.value.week_start) ? [form.value.week_start] : []),
  ].map((i) => ({ value: i, label: t(`regional.days.${dayKeys[i]}`) })),
)
const clockOptions = computed(() =>
  options.value.time_formats.map((f) => ({ value: f, label: t(`regional.clock.${f}`) })),
)
const timeExample = computed(() =>
  options.value.time_formats
    .map((f) => formatTime(sample, f as TimeFormat, form.value?.timezone, locale.value))
    .join(' / '),
)
const dateExample = computed(() =>
  form.value
    ? formatDate(sample, form.value.date_format as DatePattern, form.value.timezone, locale.value)
    : '',
)
const timezoneOptions = computed(() =>
  timezones.map((zone) => ({
    value: zone,
    label: zone,
    meta: zoneAbbreviation(zone, locale.value),
  })),
)

function discard() {
  form.value = saved.value ? { ...saved.value } : null
  error.value = null
}
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

function pick(s: RegionalSettings): RegionalSettings {
  const { currency, timezone, locale: lang, date_format, time_format, week_start } = s
  return { currency, timezone, locale: lang, date_format, time_format, week_start }
}

async function load() {
  state.value = 'loading'
  try {
    const result = await tenantApi.regional.get()
    options.value = result.options
    currencyLocked.value = result.data.currency_locked
    saved.value = pick(result.data)
    form.value = pick(result.data)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  if (!form.value) return
  saving.value = true
  error.value = null
  try {
    const result = await tenantApi.regional.update(form.value)
    saved.value = pick(result)
    form.value = pick(result)
    currencyLocked.value = result.currency_locked
    await org.load(true) // dates, money and the calendar follow the new settings
    toast.add({ severity: 'success', summary: t('regional.saved'), life: 3000 })
  } catch (e) {
    error.value =
      errorCode(e) === 'currency_locked'
        ? t('regional.currencyLocked')
        : Object.keys(validationErrors(e)).length
          ? t('regional.invalid')
          : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <div v-for="n in 6" :key="n" class="skeleton-row">
      <Skeleton width="40%" /><Skeleton height="36px" />
    </div>
  </SettingsCard>

  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>

  <SettingsCard v-else-if="state === 'error' || !form">
    <ErrorState :title="t('regional.loadError')" @retry="load" />
  </SettingsCard>

  <form v-else @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false" class="note">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="error" severity="error" :closable="false" role="alert" class="note">{{
      error
    }}</Message>
    <SettingsCard>
      <SettingRow
        :label="t('regional.currency')"
        :help="t('regional.currencyHelp')"
        label-for="regional-currency"
      >
        <Select
          v-model="form.currency"
          input-id="regional-currency"
          :options="currencyOptions"
          option-label="label"
          option-value="value"
          :disabled="!canEdit || currencyLocked"
          fluid
        />
        <Message severity="info" icon="pi pi-lock" :closable="false">{{
          currencyLocked ? t('regional.currencyLocked') : t('regional.currencyHint')
        }}</Message>
      </SettingRow>

      <SettingRow
        :label="t('regional.timezone')"
        :help="t('regional.timezoneHint')"
        label-for="regional-timezone"
      >
        <Select
          v-model="form.timezone"
          input-id="regional-timezone"
          :options="timezoneOptions"
          option-label="label"
          option-value="value"
          filter
          :disabled="!canEdit"
          fluid
        >
          <template #option="{ option }">
            <span class="option">
              <span>{{ option.label }}</span>
              <span class="option__meta" dir="ltr">{{ option.meta }}</span>
            </span>
          </template>
        </Select>
      </SettingRow>

      <SettingRow :label="t('regional.language')" :help="t('regional.languageHint')">
        <SelectButton
          v-model="form.locale"
          :options="localeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!canEdit"
          :aria-label="t('regional.language')"
        />
      </SettingRow>

      <SettingRow
        :label="t('regional.dateFormat')"
        :example="dateExample"
        label-for="regional-date"
      >
        <Select
          v-model="form.date_format"
          input-id="regional-date"
          :options="dateOptions"
          option-label="label"
          option-value="value"
          :disabled="!canEdit"
          fluid
        />
      </SettingRow>

      <SettingRow :label="t('regional.timeFormat')" :example="timeExample">
        <SelectButton
          v-model="form.time_format"
          :options="clockOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!canEdit"
          :aria-label="t('regional.timeFormat')"
        />
      </SettingRow>

      <SettingRow :label="t('regional.weekStart')">
        <SelectButton
          v-model="form.week_start"
          :options="weekOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!canEdit"
          :aria-label="t('regional.weekStart')"
        />
      </SettingRow>
    </SettingsCard>

    <UnsavedBar v-if="canEdit && dirty" :saving="saving" @discard="discard" @save="save" />
  </form>
</template>
<style scoped>
.note {
  margin-bottom: 12px;
}
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
}
.option {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
}
.option__meta {
  font: var(--text-caption);
  color: var(--text-muted);
}
</style>
