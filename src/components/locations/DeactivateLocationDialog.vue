<script setup lang="ts">
// Deactivate a branch (US-01.05): shows upcoming sessions and bookings, asks to keep or cancel
// them, and asks for the branch name to be typed, since clients stop seeing the branch.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import {
  tenantApi,
  type DeactivationImpact,
  type FutureSessionsChoice,
  type LocationDetails,
} from '@/api/tenant'
import { validationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ location: Pick<LocationDetails, 'id' | 'name'> }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ deactivated: [location: LocationDetails] }>()
const { t } = useI18n()

const impact = ref<DeactivationImpact | null>(null)
const loadState = ref<'loading' | 'ready' | 'error'>('loading')
const choice = ref<FutureSessionsChoice | null>(null)
const reason = ref('')
const typedName = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const reasonError = ref<string | null>(null)

const hasUpcoming = computed(() => (impact.value?.upcoming_sessions ?? 0) > 0)
const nameMatches = computed(() => typedName.value.trim() === props.location.name.trim())
const canConfirm = computed(
  () =>
    loadState.value === 'ready' &&
    nameMatches.value &&
    (!hasUpcoming.value ||
      choice.value === 'keep' ||
      (choice.value === 'cancel' && reason.value.trim() !== '')),
)

async function loadImpact() {
  loadState.value = 'loading'
  try {
    impact.value = await tenantApi.deactivationImpact(props.location.id)
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
  }
}

watch(visible, (open) => {
  if (!open) return
  choice.value = null
  reason.value = ''
  typedName.value = ''
  error.value = null
  reasonError.value = null
  loadImpact()
})

async function confirm() {
  saving.value = true
  error.value = null
  reasonError.value = null
  try {
    const location = await tenantApi.deactivateLocation(
      props.location.id,
      hasUpcoming.value
        ? {
            future_sessions: choice.value!,
            ...(choice.value === 'cancel' ? { reason: reason.value.trim() } : {}),
          }
        : {},
    )
    emit('deactivated', location)
    visible.value = false
  } catch (e) {
    reasonError.value = validationErrors(e).reason?.[0] ?? null
    error.value = apiMessage(e) ?? (reasonError.value ? null : t('common.genericError'))
    // New sessions may have been added since the dialog opened.
    if (apiMessage(e)) loadImpact()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('deactivateLocation.title', { name: location.name })"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="deactivate-location" class="body" @submit.prevent="canConfirm && confirm()">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <p class="lead">{{ t('deactivateLocation.lead') }}</p>

      <Skeleton v-if="loadState === 'loading'" height="56px" />
      <Message v-else-if="loadState === 'error'" severity="error" :closable="false">
        {{ t('deactivateLocation.impactError') }}
        <Button
          variant="link"
          size="small"
          :label="t('common.retry')"
          class="retry"
          @click="loadImpact"
        />
      </Message>
      <template v-else-if="impact">
        <Message v-if="!hasUpcoming" severity="info" :closable="false">{{
          t('deactivateLocation.noUpcoming')
        }}</Message>
        <template v-else>
          <Message severity="warn" :closable="false">
            {{
              t('deactivateLocation.upcoming', {
                sessions: t('deactivateLocation.sessions', impact.upcoming_sessions),
                bookings: t('deactivateLocation.bookings', impact.upcoming_bookings),
              })
            }}
          </Message>
          <fieldset class="choices">
            <legend class="label">{{ t('deactivateLocation.choose') }}</legend>
            <label class="choice">
              <RadioButton v-model="choice" input-id="fs-keep" value="keep" name="future" />
              <span>
                <strong>{{ t('deactivateLocation.keep') }}</strong>
                <small>{{ t('deactivateLocation.keepHint') }}</small>
              </span>
            </label>
            <label class="choice">
              <RadioButton v-model="choice" input-id="fs-cancel" value="cancel" name="future" />
              <span>
                <strong>{{ t('deactivateLocation.cancel') }}</strong>
                <small>{{ t('deactivateLocation.cancelHint') }}</small>
              </span>
            </label>
          </fieldset>
          <div v-if="choice === 'cancel'" class="field">
            <label for="deactivate-reason" class="label"
              >{{ t('deactivateLocation.reason') }} *</label
            >
            <Textarea
              id="deactivate-reason"
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

        <div class="field">
          <label for="deactivate-name" class="label">{{
            t('deactivateLocation.typeName', { name: location.name })
          }}</label>
          <InputText id="deactivate-name" v-model="typedName" autocomplete="off" />
        </div>
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
        form="deactivate-location"
        severity="danger"
        :label="t('deactivateLocation.confirm')"
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
  color: var(--text-primary);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.retry {
  padding: 0;
  margin-inline-start: var(--space-2);
}
</style>
