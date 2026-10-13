<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import BookingPolicyFields from '@/components/policies/BookingPolicyFields.vue'
import {
  tenantApi,
  type BookingPolicyOptions,
  type BookingPolicyOverrides,
  type OrganizationBookingPolicy,
} from '@/api/tenant'
import { statusOf, validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const form = ref<BookingPolicyOverrides | null>(null)
const saved = ref<OrganizationBookingPolicy | null>(null)
// Organization-wide only (US-04.01, US-04.06), so they sit apart from the overridable settings.
const allowOverlap = ref(false)
const noShowAfter = ref(30)
const options = ref<BookingPolicyOptions>({ penalties: [], waitlist_modes: [] })
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})
const canEdit = computed(() => auth.can('settings.update'))
const current = computed(() => ({
  ...form.value,
  allow_overlapping_bookings: allowOverlap.value,
  no_show_after_minutes: noShowAfter.value,
}))
const dirty = computed(() => JSON.stringify(current.value) !== JSON.stringify(saved.value))

function fill(policy: OrganizationBookingPolicy) {
  saved.value = policy
  const { allow_overlapping_bookings, no_show_after_minutes, ...overridable } = policy
  form.value = overridable
  allowOverlap.value = allow_overlapping_bookings
  noShowAfter.value = no_show_after_minutes
}

async function load() {
  state.value = 'loading'
  try {
    const result = await tenantApi.bookingPolicy.get()
    options.value = result.options
    fill(result.data)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function discard() {
  if (saved.value) fill(saved.value)
  errors.value = {}
  error.value = null
}

async function save() {
  if (!form.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    fill(await tenantApi.bookingPolicy.update(current.value as OrganizationBookingPolicy))
    toast.add({ severity: 'success', summary: t('bookingPolicy.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length
      ? t('bookingPolicy.checkFields')
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
    <ErrorState :title="t('bookingPolicy.loadError')" @retry="load" />
  </SettingsCard>

  <form v-else class="stack" @submit.prevent="save">
    <Message severity="info" :closable="false">{{ t('bookingPolicy.inheritance') }}</Message>
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

    <BookingPolicyFields v-model="form" :options="options" :disabled="!canEdit" :errors="errors" />

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('bookingPolicy.overlap.group') }}
      </div>
      <SettingRow
        :label="t('bookingPolicy.overlap.label')"
        :help="t('bookingPolicy.overlap.help')"
        :example="t(`bookingPolicy.overlap.${allowOverlap ? 'on' : 'off'}`)"
        label-for="policy-overlap"
      >
        <ToggleSwitch v-model="allowOverlap" input-id="policy-overlap" :disabled="!canEdit" />
      </SettingRow>
      <SettingRow
        :label="t('bookingPolicy.overlap.noShowLabel')"
        :help="t('bookingPolicy.overlap.noShowHelp')"
        :example="t('bookingPolicy.overlap.noShowExample', { n: noShowAfter })"
        label-for="policy-no-show"
      >
        <InputNumber
          v-model="noShowAfter"
          input-id="policy-no-show"
          :min="0"
          :max="1440"
          :step="15"
          :allow-empty="false"
          :suffix="` ${t('bookingPolicy.overlap.noShowUnit')}`"
          :disabled="!canEdit"
          :invalid="!!errors.no_show_after_minutes"
          show-buttons
          class="number"
        />
      </SettingRow>
    </SettingsCard>

    <UnsavedBar v-if="canEdit && dirty" :saving="saving" @discard="discard" @save="save" />
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
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
}
</style>
