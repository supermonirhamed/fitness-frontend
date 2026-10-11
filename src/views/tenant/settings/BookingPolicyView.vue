<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import BookingPolicyFields from '@/components/policies/BookingPolicyFields.vue'
import {
  tenantApi,
  type BookingPolicy,
  type BookingPolicyOptions,
  type BookingPolicyOverrides,
} from '@/api/tenant'
import { statusOf, validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const form = ref<BookingPolicyOverrides | null>(null)
const saved = ref<BookingPolicy | null>(null)
const options = ref<BookingPolicyOptions>({ penalties: [], waitlist_modes: [] })
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})
const canEdit = computed(() => auth.can('settings.update'))
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

async function load() {
  state.value = 'loading'
  try {
    const result = await tenantApi.bookingPolicy.get()
    options.value = result.options
    saved.value = result.data
    form.value = { ...result.data }
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function discard() {
  form.value = saved.value ? { ...saved.value } : null
  errors.value = {}
  error.value = null
}

async function save() {
  if (!form.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const result = await tenantApi.bookingPolicy.update(form.value as BookingPolicy)
    saved.value = result
    form.value = { ...result }
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

    <UnsavedBar v-if="canEdit && dirty" :saving="saving" @discard="discard" @save="save" />
  </form>
</template>

<style scoped>
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
