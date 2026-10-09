<script setup lang="ts">
// Block time on a facility, e.g. maintenance (US-01.10/US-01.11). Times are at the branch.
// When the time is taken, the conflicts are listed (409 facility_conflict).
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import FacilityConflictList from '@/components/locations/FacilityConflictList.vue'
import { tenantApi, type FacilityConflictItem, type FacilityReservation } from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { errorCode } from '@/lib/apiErrors'
import { addDays } from '@/lib/timeline'

const props = defineProps<{
  facilityId: number
  facilityName: string
  timezone: string
  /** Prefilled from the clicked slot. */
  initial: { date: string; start: string; end: string } | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ blocked: [block: FacilityReservation] }>()
const { t } = useI18n()

const form = ref({ title: '', date: '', start: '', end: '' })
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const error = ref<string | null>(null)
const conflicts = ref<FacilityConflictItem[]>([])

watch(visible, (open) => {
  if (!open) return
  form.value = {
    title: '',
    date: props.initial?.date ?? '',
    start: props.initial?.start ?? '',
    end: props.initial?.end ?? '',
  }
  errors.value = {}
  error.value = null
  conflicts.value = []
})

const err = (field: string) => errors.value[field]?.[0]

async function submit() {
  saving.value = true
  errors.value = {}
  error.value = null
  conflicts.value = []
  // 00:00 as an end time means midnight, the start of the next day.
  const endDate = form.value.end === '00:00' ? addDays(form.value.date, 1) : form.value.date
  try {
    const block = await tenantApi.facilities.block(props.facilityId, {
      title: form.value.title,
      starts_at: `${form.value.date} ${form.value.start}`,
      ends_at: `${endDate} ${form.value.end}`,
    })
    emit('blocked', block)
    visible.value = false
  } catch (e) {
    if (errorCode(e) === 'facility_conflict') {
      const data = (e as AxiosError<{ message: string; conflicts: FacilityConflictItem[] }>)
        .response?.data
      error.value = data?.message ?? t('common.genericError')
      conflicts.value = data?.conflicts ?? []
      return
    }
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length ? null : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('blockTime.title', { name: facilityName })"
    :style="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="block-time" class="form" @submit.prevent="submit">
      <div class="field">
        <label for="block-title">{{ t('blockTime.reason') }} *</label>
        <InputText
          id="block-title"
          v-model="form.title"
          maxlength="160"
          :placeholder="t('blockTime.reasonPlaceholder')"
          :invalid="!!err('title')"
          fluid
        />
        <small v-if="err('title')" class="error">{{ err('title') }}</small>
      </div>
      <div class="row">
        <div class="field">
          <label for="block-date">{{ t('blockTime.date') }} *</label>
          <InputText id="block-date" v-model="form.date" type="date" fluid />
        </div>
        <div class="field">
          <label for="block-start">{{ t('blockTime.from') }} *</label>
          <InputText
            id="block-start"
            v-model="form.start"
            type="time"
            :invalid="!!err('starts_at')"
            fluid
          />
        </div>
        <div class="field">
          <label for="block-end">{{ t('blockTime.to') }} *</label>
          <InputText
            id="block-end"
            v-model="form.end"
            type="time"
            :invalid="!!err('ends_at')"
            fluid
          />
        </div>
      </div>
      <small :class="err('starts_at') || err('ends_at') ? 'error' : 'hint'">{{
        err('starts_at') ?? err('ends_at') ?? t('blockTime.hint', { zone: timezone })
      }}</small>

      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <FacilityConflictList v-if="conflicts.length" :conflicts="conflicts" :timezone="timezone" />
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
        form="block-time"
        :label="t('blockTime.confirm')"
        :loading="saving"
        :disabled="!form.title.trim() || !form.date || !form.start || !form.end"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: var(--space-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.field label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
@media (max-width: 480px) {
  .row {
    grid-template-columns: 1fr 1fr;
  }
  .row .field:first-child {
    grid-column: 1 / -1;
  }
}
</style>
