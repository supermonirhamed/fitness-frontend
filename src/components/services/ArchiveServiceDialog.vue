<script setup lang="ts">
// Archive a service (US-02.12): shows its upcoming sessions and asks to keep them until they
// finish or cancel them (with a reason for clients). No new sessions can be created afterwards.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import {
  tenantApi,
  type DeactivationImpact,
  type FutureSessionsChoice,
  type Service,
} from '@/api/tenant'
import { validationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ service: Pick<Service, 'id' | 'display_name'> }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ archived: [service: Service] }>()
const { t } = useI18n()

const impact = ref<DeactivationImpact | null>(null)
const loadState = ref<'loading' | 'ready' | 'error'>('loading')
const choice = ref<FutureSessionsChoice | null>(null)
const reason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const reasonError = ref<string | null>(null)

const hasUpcoming = computed(() => (impact.value?.upcoming_sessions ?? 0) > 0)
const canConfirm = computed(
  () =>
    loadState.value === 'ready' &&
    (!hasUpcoming.value ||
      choice.value === 'keep' ||
      (choice.value === 'cancel' && reason.value.trim() !== '')),
)

async function loadImpact() {
  loadState.value = 'loading'
  try {
    impact.value = await tenantApi.services.archiveImpact(props.service.id)
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
  }
}
watch(visible, (open) => {
  if (!open) return
  choice.value = null
  reason.value = ''
  error.value = null
  reasonError.value = null
  loadImpact()
})

async function confirm() {
  saving.value = true
  error.value = null
  reasonError.value = null
  try {
    const service = await tenantApi.services.archive(
      props.service.id,
      hasUpcoming.value
        ? {
            future_sessions: choice.value!,
            ...(choice.value === 'cancel' ? { reason: reason.value.trim() } : {}),
          }
        : {},
    )
    emit('archived', service)
    visible.value = false
  } catch (e) {
    reasonError.value = validationErrors(e).reason?.[0] ?? null
    error.value = apiMessage(e) ?? (reasonError.value ? null : t('common.genericError'))
    if (apiMessage(e)) loadImpact() // sessions may have been added meanwhile
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('archiveService.title', { name: service.display_name })"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="archive-service" class="body" @submit.prevent="canConfirm && confirm()">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <p class="lead">{{ t('archiveService.lead') }}</p>
      <Skeleton v-if="loadState === 'loading'" height="56px" />
      <Message v-else-if="loadState === 'error'" severity="error" :closable="false">
        {{ t('deactivateLocation.impactError') }}
        <Button variant="link" size="small" :label="t('common.retry')" @click="loadImpact" />
      </Message>
      <template v-else-if="impact">
        <Message v-if="!hasUpcoming" severity="info" :closable="false">{{
          t('archiveService.noUpcoming')
        }}</Message>
        <template v-else>
          <Message severity="warn" :closable="false">{{
            t('archiveService.upcoming', {
              sessions: t('deactivateLocation.sessions', impact.upcoming_sessions),
              bookings: t('deactivateLocation.bookings', impact.upcoming_bookings),
            })
          }}</Message>
          <fieldset class="choices">
            <legend class="label">{{ t('deactivateLocation.choose') }}</legend>
            <label class="choice">
              <RadioButton v-model="choice" input-id="as-keep" value="keep" name="future" />
              <span
                ><strong>{{ t('archiveService.keep') }}</strong
                ><small>{{ t('archiveService.keepHint') }}</small></span
              >
            </label>
            <label class="choice">
              <RadioButton v-model="choice" input-id="as-cancel" value="cancel" name="future" />
              <span
                ><strong>{{ t('archiveService.cancel') }}</strong
                ><small>{{ t('deactivateLocation.cancelHint') }}</small></span
              >
            </label>
          </fieldset>
          <div v-if="choice === 'cancel'" class="field">
            <label for="archive-reason" class="label">{{ t('deactivateLocation.reason') }} *</label>
            <Textarea
              id="archive-reason"
              v-model="reason"
              rows="3"
              maxlength="500"
              :invalid="!!reasonError"
              auto-resize
            />
            <small :class="reasonError ? 'error' : 'hint'">{{
              reasonError ?? t('deactivateLocation.reasonHint')
            }}</small>
          </div>
        </template>
      </template>
    </form>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="archive-service"
        severity="danger"
        :label="t('catalog.bulk.archive')"
        :disabled="!canConfirm"
        :loading="saving"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.lead {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}
.choice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  cursor: pointer;
}
.choice span {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.choice small,
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
