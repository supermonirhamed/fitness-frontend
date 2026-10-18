<script setup lang="ts">
// Change a group's head coach and assistants (US-10.05), for all upcoming trainings or from a
// date. Only coaches eligible for the group's service at its branch are offered. Trainings whose
// coaches were changed on their own keep them; conflicts are checked like a series edit (US-03.06):
// hard ones block, warnings can be confirmed.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import ConflictList from '@/components/patterns/ConflictList.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type AcademyGroup, type SessionConflictItem } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const props = defineProps<{ group: AcademyGroup }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [group: AcademyGroup, trainingsUpdated: number] }>()
const { t } = useI18n()

const coaches = ref<{ id: number; name: string }[]>([])
const head = ref<number | null>(null)
const assistants = ref<number[]>([])
const scope = ref<'all' | 'from'>('all')
const from = ref<Date | null>(null)
const conflicts = ref<SessionConflictItem[]>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const onlyWarnings = computed(
  () => conflicts.value.length > 0 && conflicts.value.every((c) => c.level === 'soft'),
)
const assistantOptions = computed(() => coaches.value.filter((c) => c.id !== head.value))
const err = (prefix: string) => {
  const key = Object.keys(errors.value).find((k) => k.startsWith(prefix))
  return key ? errors.value[key]?.[0] : undefined
}

watch(visible, async (open) => {
  if (!open) return
  head.value = props.group.coaches?.find((c) => c.role === 'head')?.id ?? null
  assistants.value = (props.group.coaches ?? [])
    .filter((c) => c.role === 'assistant')
    .map((c) => c.id)
  scope.value = 'all'
  from.value = null
  conflicts.value = []
  errors.value = {}
  formError.value = null
  const options = await tenantApi.academy.groups
    .options({
      program_id: props.group.program_id,
      location_id: props.group.location_id,
      service_id: props.group.service_id,
    })
    .catch(() => null)
  // Current coaches stay listed even if they no longer qualify.
  const listed = options?.coaches ?? []
  const current = (props.group.coaches ?? []).filter((c) => !listed.some((l) => l.id === c.id))
  coaches.value = [...listed, ...current.map((c) => ({ id: c.id, name: c.name }))]
})

async function save() {
  if (!head.value) return
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const result = await tenantApi.academy.groups.coaches(props.group.id, {
      head_coach_id: head.value,
      assistant_ids: assistants.value,
      from: scope.value === 'from' && from.value ? isoDay(from.value) : null,
      confirm_warnings: onlyWarnings.value,
    })
    emit('saved', result.group, result.trainingsUpdated)
    visible.value = false
  } catch (e) {
    const data = e instanceof AxiosError ? e.response?.data : null
    if (e instanceof AxiosError && e.response?.status === 409 && Array.isArray(data?.conflicts)) {
      conflicts.value = data.conflicts
      formError.value = null
    } else {
      conflicts.value = []
      errors.value = validationErrors(e)
      formError.value = Object.keys(errors.value).length
        ? t('locationForm.checkFields')
        : (apiMessage(e) ?? t('common.genericError'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('academy.coaches.changeTitle')"
    :subtitle="group.display_name ?? undefined"
    icon="pi-users"
    :saving="saving"
    :save-disabled="!head || (scope === 'from' && !from)"
    :save-label="onlyWarnings ? t('academy.coaches.saveAnyway') : undefined"
    :error="formError"
    @save="save"
  >
    <FormField
      :label="t('academy.coaches.head')"
      for="coach-head"
      required
      :help="t('academy.coaches.headHint')"
      :error="err('head_coach_id')"
    >
      <Select
        v-model="head"
        input-id="coach-head"
        :options="coaches"
        option-label="name"
        option-value="id"
        filter
        :empty-message="t('academy.coaches.noneEligible')"
        fluid
        @change="conflicts = []"
      />
    </FormField>
    <FormField
      :label="t('academy.coaches.assistants')"
      for="coach-assistants"
      :error="err('assistant_ids')"
    >
      <MultiSelect
        v-model="assistants"
        input-id="coach-assistants"
        :options="assistantOptions"
        option-label="name"
        option-value="id"
        display="chip"
        filter
        fluid
        @change="conflicts = []"
      />
    </FormField>
    <fieldset class="scope">
      <legend>{{ t('academy.coaches.applyTo') }}</legend>
      <label class="radio">
        <RadioButton v-model="scope" input-id="scope-all" value="all" />
        <span>{{ t('academy.coaches.allUpcoming') }}</span>
      </label>
      <label class="radio">
        <RadioButton v-model="scope" input-id="scope-from" value="from" />
        <span>{{ t('academy.coaches.fromDate') }}</span>
      </label>
      <DatePicker
        v-if="scope === 'from'"
        v-model="from"
        :min-date="new Date()"
        :aria-label="t('academy.coaches.fromDate')"
        show-icon
      />
      <small class="muted">{{ t('academy.coaches.keepsOwn') }}</small>
    </fieldset>
    <div v-if="conflicts.length" class="conflicts">
      <strong>{{
        onlyWarnings ? t('academy.coaches.warnings') : t('academy.coaches.blocked')
      }}</strong>
      <ConflictList :items="conflicts" />
    </div>
  </FormDialog>
</template>

<style scoped>
.scope {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scope legend {
  font-weight: 600;
  margin-bottom: 4px;
}
.radio {
  display: flex;
  align-items: center;
  gap: 8px;
}
.conflicts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.muted {
  color: var(--text-secondary);
}
</style>
