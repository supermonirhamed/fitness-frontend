<script setup lang="ts">
// Add or edit a holiday or special hours (US-01.07): label, a date or date range, closed or
// custom hours. A closure over scheduled sessions asks first (ClosureImpactDialog).
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import ClosureImpactDialog from '@/components/locations/ClosureImpactDialog.vue'
import {
  tenantApi,
  type AffectedSession,
  type FutureSessionsChoice,
  type HourOverride,
  type TimeRange,
} from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { errorCode } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { fromInput, toInput } from '@/lib/businessHours'

const props = defineProps<{
  locationId: number
  timezone: string
  override?: HourOverride | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [override: HourOverride] }>()
const { t, locale } = useI18n()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const MAX_RANGES = 6
const form = reactive({ label: '', closed: true, hours: [] as TimeRange[] })
const dates = ref<(Date | null)[] | null>(null)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const impact = ref<AffectedSession[]>([])
const impactOpen = ref(false)

const editing = computed(() => !!props.override)
const kindOptions = computed(() => [
  { value: true, label: t('hourOverrides.closed') },
  { value: false, label: t('hourOverrides.customHours') },
])
const err = (field: string) => errors.value[field]?.[0]
const rangeErr = computed(() => {
  const key = Object.keys(errors.value).find((k) => k === 'hours' || k.startsWith('hours.'))
  return key ? errors.value[key]?.[0] : undefined
})

const fromYmd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

watch(visible, (open) => {
  if (!open) return
  const o = props.override
  form.label = o?.label ?? ''
  form.closed = o?.closed ?? true
  form.hours = (o?.hours ?? [{ start: '08:00', end: '14:00' }]).map(toInput)
  dates.value = o ? [fromYmd(o.start_date), fromYmd(o.end_date)] : null
  errors.value = {}
  formError.value = null
})

function addRange() {
  const last = form.hours[form.hours.length - 1]
  form.hours.push({ start: last?.end && last.end !== '00:00' ? last.end : '16:00', end: '00:00' })
}

async function submit(sessions?: FutureSessionsChoice) {
  saving.value = true
  errors.value = {}
  formError.value = null
  const [start, end] = dates.value ?? []
  const input = {
    label: form.label,
    start_date: start ? isoDay(start) : '',
    end_date: end ? isoDay(end) : start ? isoDay(start) : '',
    closed: form.closed,
    hours: form.closed ? null : form.hours.map(fromInput),
    ...(sessions ? { sessions } : {}),
  }
  try {
    const saved = props.override
      ? await tenantApi.hourOverrides.update(props.locationId, props.override.id, input)
      : await tenantApi.hourOverrides.create(props.locationId, input)
    impactOpen.value = false
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    if (errorCode(e) === 'closure_affects_sessions') {
      impact.value =
        (e as AxiosError<{ sessions: AffectedSession[] }>).response?.data?.sessions ?? []
      impactOpen.value = true
      return
    }
    impactOpen.value = false
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="editing ? t('hourOverrides.editTitle') : t('hourOverrides.newTitle')"
    class="override-drawer"
  >
    <form id="hour-override" class="form" @submit.prevent="submit()">
      <div class="field">
        <label for="ho-label">{{ t('hourOverrides.label') }} *</label>
        <InputText
          id="ho-label"
          v-model="form.label"
          maxlength="120"
          :placeholder="t('hourOverrides.labelPlaceholder')"
          :invalid="!!err('label')"
          fluid
        />
        <small v-if="err('label')" class="error">{{ err('label') }}</small>
      </div>

      <div class="field">
        <label for="ho-dates">{{ t('hourOverrides.dates') }} *</label>
        <DatePicker
          v-model="dates"
          input-id="ho-dates"
          selection-mode="range"
          :manual-input="false"
          date-format="yy-mm-dd"
          :invalid="!!(err('start_date') || err('end_date'))"
          fluid
        />
        <small :class="err('start_date') || err('end_date') ? 'error' : 'hint'">{{
          err('start_date') ?? err('end_date') ?? t('hourOverrides.datesHint', { zone: timezone })
        }}</small>
      </div>

      <div class="field">
        <span id="ho-kind" class="label">{{ t('hourOverrides.kind') }}</span>
        <SelectButton
          v-model="form.closed"
          :options="kindOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="ho-kind"
        />
      </div>

      <div v-if="!form.closed" class="field">
        <span class="label">{{ t('hourOverrides.hours') }} *</span>
        <div v-for="(range, i) in form.hours" :key="i" class="range">
          <InputText
            v-model="range.start"
            type="time"
            :aria-label="t('hourOverrides.opensAt')"
            :invalid="!!err(`hours.${i}.start`)"
            class="time"
          />
          <span aria-hidden="true">–</span>
          <InputText
            v-model="range.end"
            type="time"
            :aria-label="t('hourOverrides.closesAt')"
            :invalid="!!err(`hours.${i}.end`)"
            class="time"
          />
          <Button
            v-if="form.hours.length > 1"
            icon="pi pi-times"
            severity="secondary"
            variant="text"
            rounded
            size="small"
            :aria-label="t('businessHours.removeRange')"
            @click="form.hours.splice(i, 1)"
          />
        </div>
        <Button
          v-if="form.hours.length < MAX_RANGES"
          icon="pi pi-plus"
          :label="t('businessHours.addRange')"
          severity="secondary"
          variant="text"
          size="small"
          class="add"
          @click="addRange"
        />
        <small :class="rangeErr ? 'error' : 'hint'">{{
          rangeErr ?? t('businessHours.midnightHint')
        }}</small>
      </div>

      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
    </form>
    <template #footer>
      <div class="footer">
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="hour-override"
          :label="t('permissions.save')"
          :loading="saving && !impactOpen"
          :disabled="!form.label.trim() || !dates?.[0]"
        />
      </div>
    </template>
  </Drawer>

  <ClosureImpactDialog
    v-model:visible="impactOpen"
    :sessions="impact"
    :timezone="timezone"
    :loading="saving"
    @choose="submit"
  />
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.field label,
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.range {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.time {
  width: 8.5rem;
}
.add {
  align-self: flex-start;
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

<style>
.override-drawer.p-drawer {
  width: var(--drawer-w);
  max-width: 100vw;
}
</style>
