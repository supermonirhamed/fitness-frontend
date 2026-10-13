<script setup lang="ts">
// Booking & cancellation policy fields (US-01.02). Without `inherited` it edits the organization
// defaults; with it, each setting can inherit (shows the inherited value) or be overridden.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import type {
  BookingPolicy,
  BookingPolicyOptions,
  BookingPolicyOverrides,
  Penalty,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import {
  FEE_OF,
  POLICY_GROUPS,
  feeAfterPenaltyChange,
  isPenalty,
  setOverride,
  type PolicyField,
} from '@/lib/bookingPolicy'

const model = defineModel<BookingPolicyOverrides>({ required: true })
const props = defineProps<{
  options: BookingPolicyOptions
  /** Override mode: the values a setting inherits when not overridden… */
  inherited?: BookingPolicy
  /** …and where they come from, e.g. "Organization". */
  inheritedLabel?: string
  /** Per setting, when sources differ (e.g. some from a branch, US-02.07). */
  inheritedSources?: Partial<Record<string, string>>
  disabled?: boolean
  errors?: Record<string, string[]>
}>()

const { t } = useI18n()
const fmt = useFormat()
const org = useOrganization()

const NUMBER_LIMITS: Partial<Record<PolicyField, { max: number; unit: string }>> = {
  booking_opens_days: { max: 365, unit: 'days' },
  booking_closes_minutes: { max: 10080, unit: 'minutes' },
  cancellation_window_hours: { max: 720, unit: 'hours' },
  waitlist_closes_minutes: { max: 10080, unit: 'minutes' },
  waitlist_max_size: { max: 500, unit: 'people' },
}

const penaltyOptions = computed(() =>
  props.options.penalties.map((p) => ({ value: p, label: t(`bookingPolicy.penalties.${p}`) })),
)
const modeOptions = computed(() =>
  props.options.waitlist_modes.map((m) => ({ value: m, label: t(`bookingPolicy.modes.${m}`) })),
)

const overriding = (field: PolicyField) => !props.inherited || model.value[field] !== null

function toggle(field: PolicyField, on: boolean) {
  if (props.inherited) model.value = setOverride(model.value, field, on, props.inherited)
}

function setValue(field: keyof BookingPolicy, value: unknown) {
  const next = { ...model.value, [field]: value } as BookingPolicyOverrides
  if (isPenalty(field)) {
    next[FEE_OF[field]] = feeAfterPenaltyChange(value as Penalty, model.value[FEE_OF[field]])
  }
  model.value = next
}

/** Value shown in words: the inherited one, and the helper example under each input. */
function describe(field: PolicyField, values: BookingPolicy | BookingPolicyOverrides): string {
  const value = values[field]
  if (value === null) return '—'
  const limits = NUMBER_LIMITS[field]
  if (limits)
    return t(`bookingPolicy.units.${limits.unit}`, { n: value as number }, value as number)
  if (isPenalty(field)) {
    const fee = values[FEE_OF[field]]
    return value === 'fixed_fee' && fee !== null
      ? `${t('bookingPolicy.penalties.fixed_fee')} · ${fmt.money(fee)}`
      : t(`bookingPolicy.penalties.${value}`)
  }
  if (typeof value === 'boolean') return t(`bookingPolicy.onOff.${value}`)
  return t(`bookingPolicy.modes.${value}`)
}

/** Live example under a setting, using the value that applies. */
function example(field: PolicyField): string {
  const values = overriding(field) ? model.value : props.inherited!
  const value = values[field]
  if (value === null) return ''
  return NUMBER_LIMITS[field]
    ? t(`bookingPolicy.examples.${field}`, { n: value as number }, value as number)
    : t(`bookingPolicy.examples.${field}.${value}`)
}

const errorOf = (field: string) => props.errors?.[field]?.[0]
const numberOf = (field: PolicyField) => model.value[field] as number | null
</script>

<template>
  <SettingsCard>
    <template v-for="(fields, group) in POLICY_GROUPS" :key="group">
      <div class="settings-group" role="heading" aria-level="3">
        {{ t(`bookingPolicy.groups.${group}`) }}
      </div>

      <SettingRow
        v-for="field in fields"
        :key="field"
        :label="t(`bookingPolicy.fields.${field}`)"
        :help="field === 'waitlist_mode' ? example(field) : t(`bookingPolicy.help.${field}`)"
        :example="field === 'waitlist_mode' ? undefined : example(field)"
        :label-for="NUMBER_LIMITS[field] && overriding(field) ? `policy-${field}` : undefined"
      >
        <label v-if="inherited" class="override">
          <ToggleSwitch
            :model-value="overriding(field)"
            :disabled="disabled"
            :aria-label="
              t('bookingPolicy.overrideField', { field: t(`bookingPolicy.fields.${field}`) })
            "
            @update:model-value="toggle(field, $event)"
          />
          <span>{{ t('bookingPolicy.override') }}</span>
        </label>

        <div v-if="!overriding(field)" class="inherited">
          <span class="value">{{ describe(field, inherited!) }}</span>
          <Tag
            class="tag-sm"
            icon="pi pi-building"
            :value="inheritedSources?.[field] ?? inheritedLabel"
          />
        </div>

        <template v-else>
          <InputNumber
            v-if="NUMBER_LIMITS[field]"
            :model-value="numberOf(field)"
            :input-id="`policy-${field}`"
            :min="0"
            :max="NUMBER_LIMITS[field]!.max"
            :step="NUMBER_LIMITS[field]!.unit === 'minutes' ? 15 : 1"
            :suffix="` ${t(`bookingPolicy.unitNames.${NUMBER_LIMITS[field]!.unit}`)}`"
            :disabled="disabled"
            :invalid="!!errorOf(field)"
            show-buttons
            class="number"
            @update:model-value="setValue(field, $event)"
          />
          <ToggleSwitch
            v-else-if="typeof model[field] === 'boolean'"
            :model-value="model[field] as boolean"
            :input-id="`policy-${field}`"
            :disabled="disabled"
            :aria-label="t(`bookingPolicy.fields.${field}`)"
            @update:model-value="setValue(field, $event)"
          />
          <SelectButton
            v-else
            :model-value="model[field]"
            :options="isPenalty(field) ? penaltyOptions : modeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :disabled="disabled"
            :invalid="!!errorOf(field)"
            :aria-label="t(`bookingPolicy.fields.${field}`)"
            @update:model-value="setValue(field, $event)"
          />

          <div v-if="isPenalty(field) && model[field] === 'fixed_fee'" class="fee">
            <InputNumber
              :model-value="model[FEE_OF[field]]"
              :input-id="`policy-${FEE_OF[field]}`"
              mode="currency"
              :currency="org.organization?.currency ?? 'SAR'"
              :min="0"
              :max="100000"
              :max-fraction-digits="3"
              :disabled="disabled"
              :invalid="!!errorOf(FEE_OF[field])"
              :aria-label="t('bookingPolicy.feeAmount')"
              class="number"
              @update:model-value="setValue(FEE_OF[field], $event)"
            />
            <small v-if="errorOf(FEE_OF[field])" class="error">{{
              t('bookingPolicy.feeRequired')
            }}</small>
          </div>

          <small v-if="errorOf(field)" class="error">{{ t('bookingPolicy.invalid') }}</small>
        </template>
      </SettingRow>
    </template>
  </SettingsCard>
</template>

<style scoped>
.number {
  max-width: 220px;
}
.fee {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.override {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: var(--text-small);
  color: var(--text-secondary);
  cursor: pointer;
}
.inherited {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 36px;
}
.inherited .value {
  font: var(--text-body);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
