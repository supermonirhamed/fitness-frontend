<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type RegionalSettings } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { statusOf, validationErrors } from '@/lib/http'
import { formatDate, formatTime, type DatePattern, type TimeFormat } from '@/lib/datetime'
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
const timeOptions = computed(() =>
  options.value.time_formats.map((f) => ({
    value: f,
    label: `${t(`regional.clock.${f}`)} — ${formatTime(sample, f as TimeFormat, form.value?.timezone, locale.value)}`,
  })),
)
const weekOptions = computed(() =>
  dayKeys.map((day, i) => ({ value: i, label: t(`regional.days.${day}`) })),
)
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
  <section class="card">
    <div v-if="state === 'loading'" class="body" aria-busy="true" :aria-label="t('common.loading')">
      <Skeleton v-for="n in 6" :key="n" height="40px" />
    </div>

    <EmptyState
      v-else-if="state === 'forbidden'"
      icon="pi-lock"
      :title="t('permissions.forbidden')"
      :body="t('permissions.forbiddenHint')"
    />

    <EmptyState
      v-else-if="state === 'error' || !form"
      icon="pi-exclamation-triangle"
      :title="t('regional.loadError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>

    <form v-else class="body" @submit.prevent="save">
      <p class="intro">{{ t('regional.intro') }}</p>
      <Message v-if="!canEdit" severity="secondary" :closable="false">{{
        t('regional.readOnly')
      }}</Message>

      <div class="grid">
        <div class="field">
          <label for="regional-currency">{{ t('regional.currency') }}</label>
          <Select
            v-model="form.currency"
            input-id="regional-currency"
            :options="currencyOptions"
            option-label="label"
            option-value="value"
            :disabled="!canEdit || currencyLocked"
            fluid
          />
          <small>{{
            currencyLocked ? t('regional.currencyLocked') : t('regional.currencyHint')
          }}</small>
        </div>
        <div class="field">
          <label for="regional-timezone">{{ t('regional.timezone') }}</label>
          <Select
            v-model="form.timezone"
            input-id="regional-timezone"
            :options="timezones"
            filter
            :disabled="!canEdit"
            fluid
          />
          <small>{{ t('regional.timezoneHint') }}</small>
        </div>
        <div class="field">
          <label for="regional-locale">{{ t('regional.language') }}</label>
          <Select
            v-model="form.locale"
            input-id="regional-locale"
            :options="localeOptions"
            option-label="label"
            option-value="value"
            :disabled="!canEdit"
            fluid
          />
          <small>{{ t('regional.languageHint') }}</small>
        </div>
        <div class="field">
          <label for="regional-week">{{ t('regional.weekStart') }}</label>
          <Select
            v-model="form.week_start"
            input-id="regional-week"
            :options="weekOptions"
            option-label="label"
            option-value="value"
            :disabled="!canEdit"
            fluid
          />
        </div>
        <div class="field">
          <label for="regional-date">{{ t('regional.dateFormat') }}</label>
          <Select
            v-model="form.date_format"
            input-id="regional-date"
            :options="dateOptions"
            option-label="label"
            option-value="value"
            :disabled="!canEdit"
            fluid
          />
        </div>
        <div class="field">
          <label for="regional-time">{{ t('regional.timeFormat') }}</label>
          <Select
            v-model="form.time_format"
            input-id="regional-time"
            :options="timeOptions"
            option-label="label"
            option-value="value"
            :disabled="!canEdit"
            fluid
          />
        </div>
      </div>

      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div v-if="canEdit" class="footer">
        <span class="audit"
          ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
        >
        <Button type="submit" :label="t('permissions.save')" :disabled="!dirty" :loading="saving" />
      </div>
    </form>
  </section>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
}
.intro {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-4) var(--space-5);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.field small {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
</style>
