<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
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
  <section class="card">
    <div v-if="state === 'loading'" class="body" aria-busy="true" :aria-label="t('common.loading')">
      <Skeleton v-for="n in 4" :key="n" height="120px" />
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
      :title="t('bookingPolicy.loadError')"
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
      <p class="intro">{{ t('bookingPolicy.intro') }}</p>
      <Message severity="info" :closable="false" icon="pi pi-info-circle">{{
        t('bookingPolicy.inheritance')
      }}</Message>
      <Message v-if="!canEdit" severity="secondary" :closable="false">{{
        t('regional.readOnly')
      }}</Message>

      <BookingPolicyFields
        v-model="form"
        :options="options"
        :disabled="!canEdit"
        :errors="errors"
      />

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
