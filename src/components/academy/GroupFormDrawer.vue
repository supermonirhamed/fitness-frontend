<script setup lang="ts">
// Create or edit an academy group (US-10.04): name, program, branch, the class service its
// trainings use, facility, level and/or age group, term (term-based programs), capacity, who can
// join and status. A new group also gets its head coach and assistants (US-10.05): only coaches
// eligible for the service who work at the branch are offered.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import {
  tenantApi,
  type AcademyGroup,
  type AcademyGroupInput,
  type AcademyGroupOptions,
  type Program,
} from '@/api/tenant'
import { emptyTranslated, translatedErrors } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const props = defineProps<{
  group: AcademyGroup | null
  /** Programs to pick from (a new group); the program is fixed once created. */
  programs: Program[]
  programId?: number | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [group: AcademyGroup, created: boolean] }>()
const { t, locale } = useI18n()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const editing = computed(() => props.group !== null)

const form = reactive<Required<AcademyGroupInput>>({
  name: emptyTranslated(),
  program_id: 0,
  service_id: null,
  level_id: null,
  age_group_id: null,
  location_id: null,
  facility_id: null,
  term_id: null,
  capacity: null,
  gender: 'Any',
  status: 'Draft',
  head_coach_id: null,
  assistant_ids: [],
  allow_drop_in: false,
  waitlist_enabled: true,
  accepts_trials: true,
  fee: null,
})
const options = ref<AcademyGroupOptions | null>(null)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const err = (field: string) => errors.value[field]?.[0]
const assistantError = computed(() => {
  const key = Object.keys(errors.value).find((k) => k.startsWith('assistant_ids'))
  return key ? errors.value[key]?.[0] : undefined
})

const program = computed(() => props.programs.find((p) => p.id === form.program_id) ?? null)
const termBased = computed(() => program.value?.enrollment_mode === 'Term')
const branchOptions = computed(() => program.value?.locations ?? [])
const statusOptions = computed(() =>
  (props.group?.status === 'Full'
    ? (['Draft', 'Published', 'Full', 'Archived'] as const)
    : editing.value
      ? (['Draft', 'Published', 'Archived'] as const)
      : (['Draft', 'Published'] as const)
  ).map((s) => ({ value: s, label: t(`academy.groups.status.${s}`) })),
)
const genderOptions = computed(() =>
  (['Any', 'Male', 'Female'] as const).map((g) => ({ value: g, label: t(`catalog.gender.${g}`) })),
)
const assistantOptions = computed(() =>
  (options.value?.coaches ?? []).filter((c) => c.id !== form.head_coach_id),
)
const facilityOptions = computed(() =>
  (options.value?.facilities ?? []).map((f) => ({
    ...f,
    label: f.capacity ? `${f.name} (${f.capacity})` : f.name,
  })),
)

let loadSeq = 0
async function loadOptions() {
  if (!form.program_id) return
  const seq = ++loadSeq
  const result = await tenantApi.academy.groups
    .options({
      program_id: form.program_id,
      location_id: form.location_id,
      service_id: form.service_id,
    })
    .catch(() => null)
  if (seq === loadSeq) options.value = result
}

watch(visible, async (open) => {
  if (!open) return
  const g = props.group
  Object.assign(form, {
    name: { ar: g?.name.ar ?? '', en: g?.name.en ?? '' },
    program_id: g?.program_id ?? props.programId ?? props.programs[0]?.id ?? 0,
    service_id: g?.service_id ?? null,
    level_id: g?.level_id ?? null,
    age_group_id: g?.age_group_id ?? null,
    location_id: g?.location_id ?? null,
    facility_id: g?.facility_id ?? null,
    term_id: g?.term_id ?? null,
    capacity: g?.capacity ?? null,
    gender: g?.gender ?? program.value?.gender ?? 'Any',
    status: g?.status ?? 'Draft',
    head_coach_id: null,
    assistant_ids: [],
    allow_drop_in: g?.allow_drop_in ?? false,
    waitlist_enabled: g?.waitlist_enabled ?? true,
    accepts_trials: g?.accepts_trials ?? true,
    fee: g?.fee ?? null,
  })
  if (!g && branchOptions.value.length === 1) form.location_id = branchOptions.value[0]!.id
  errors.value = {}
  formError.value = null
  options.value = null
  await loadOptions()
  const loaded = options.value as AcademyGroupOptions | null
  if (!g && loaded?.services.length === 1) {
    form.service_id = loaded.services[0]!.id
    await onService()
  }
  if (!g && termBased.value && loaded?.terms.length === 1) form.term_id = loaded.terms[0]!.id
})

// A new program, branch or service changes what the form offers.
function onProgram() {
  Object.assign(form, {
    location_id: null,
    service_id: null,
    level_id: null,
    age_group_id: null,
    term_id: null,
  })
  form.gender = program.value?.gender ?? 'Any'
  if (branchOptions.value.length === 1) form.location_id = branchOptions.value[0]!.id
  loadOptions()
}
function onBranch() {
  Object.assign(form, {
    service_id: null,
    facility_id: null,
    head_coach_id: null,
    assistant_ids: [],
  })
  loadOptions()
}
async function onService() {
  form.facility_id = null
  await loadOptions()
  const service = options.value?.services.find((s) => s.id === form.service_id)
  if (!form.capacity && service?.default_capacity) form.capacity = service.default_capacity
  const coaches = new Set(options.value?.coaches.map((c) => c.id))
  if (form.head_coach_id && !coaches.has(form.head_coach_id)) form.head_coach_id = null
  form.assistant_ids = form.assistant_ids.filter((id) => coaches.has(id))
}

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const { program_id, head_coach_id, assistant_ids, ...values } = form
  const input: AcademyGroupInput = editing.value
    ? { ...values, term_id: termBased.value ? values.term_id : null }
    : {
        ...values,
        program_id,
        head_coach_id,
        assistant_ids,
        term_id: termBased.value ? values.term_id : null,
      }
  if (!editing.value) delete input.status
  try {
    const saved = props.group
      ? await tenantApi.academy.groups.update(props.group.id, input)
      : await tenantApi.academy.groups.create(input)
    emit('saved', saved, !editing.value)
    visible.value = false
  } catch (e) {
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
    :header="
      editing
        ? t('academy.groups.editTitle', { name: group?.display_name })
        : t('academy.groups.newTitle')
    "
    class="group-drawer"
  >
    <form id="group-form" class="form" @submit.prevent="submit">
      <TranslatedField
        id="group-name"
        v-model="form.name"
        :label="t('academy.name')"
        required
        :maxlength="120"
        :errors="translatedErrors(errors, 'name')"
      />
      <div v-if="!editing && !programId" class="field">
        <label for="group-program">{{ t('academy.groups.program') }} *</label>
        <Select
          v-model="form.program_id"
          input-id="group-program"
          :options="programs"
          option-label="display_name"
          option-value="id"
          :invalid="!!err('program_id')"
          fluid
          @change="onProgram"
        />
        <small v-if="err('program_id')" class="error">{{ err('program_id') }}</small>
      </div>
      <div class="row">
        <div class="field">
          <label for="group-branch">{{ t('academy.groups.branch') }} *</label>
          <Select
            v-model="form.location_id"
            input-id="group-branch"
            :options="branchOptions"
            option-label="name"
            option-value="id"
            :invalid="!!err('location_id')"
            fluid
            @change="onBranch"
          />
          <small v-if="err('location_id')" class="error">{{ err('location_id') }}</small>
        </div>
        <div class="field">
          <label for="group-service">{{ t('academy.groups.service') }} *</label>
          <Select
            v-model="form.service_id"
            input-id="group-service"
            :options="options?.services ?? []"
            option-label="display_name"
            option-value="id"
            :disabled="!form.location_id"
            :empty-message="t('academy.groups.noServices')"
            :invalid="!!err('service_id')"
            fluid
            @change="onService"
          />
          <small v-if="err('service_id')" class="error">{{ err('service_id') }}</small>
          <small v-else class="hint">{{ t('academy.groups.serviceHint') }}</small>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label for="group-facility">{{ t('academy.groups.facility') }}</label>
          <Select
            v-model="form.facility_id"
            input-id="group-facility"
            :options="facilityOptions"
            option-label="label"
            option-value="id"
            :disabled="!form.service_id"
            show-clear
            :invalid="!!err('facility_id')"
            fluid
          />
          <small v-if="err('facility_id')" class="error">{{ err('facility_id') }}</small>
        </div>
        <div class="field">
          <label for="group-capacity">{{ t('academy.groups.capacity') }} *</label>
          <InputNumber
            v-model="form.capacity"
            input-id="group-capacity"
            :min="1"
            :max="1000"
            :invalid="!!err('capacity')"
            fluid
          />
          <small v-if="err('capacity')" class="error">{{ err('capacity') }}</small>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label for="group-level">{{ t('academy.groups.level') }}</label>
          <Select
            v-model="form.level_id"
            input-id="group-level"
            :options="options?.levels ?? []"
            option-label="display_name"
            option-value="id"
            show-clear
            :empty-message="t('academy.groups.noLevels')"
            :invalid="!!err('level_id')"
            fluid
          />
        </div>
        <div class="field">
          <label for="group-age">{{ t('academy.groups.ageGroup') }}</label>
          <Select
            v-model="form.age_group_id"
            input-id="group-age"
            :options="options?.age_groups ?? []"
            option-label="display_name"
            option-value="id"
            show-clear
            :empty-message="t('academy.groups.noAgeGroups')"
            :invalid="!!err('age_group_id')"
            fluid
          />
        </div>
      </div>
      <div class="row">
        <div v-if="termBased" class="field">
          <label for="group-term">{{ t('academy.groups.term') }} *</label>
          <Select
            v-model="form.term_id"
            input-id="group-term"
            :options="options?.terms ?? []"
            option-label="display_name"
            option-value="id"
            :empty-message="t('academy.groups.noTerms')"
            :invalid="!!err('term_id')"
            fluid
          />
          <small v-if="err('term_id')" class="error">{{ err('term_id') }}</small>
        </div>
        <div class="field">
          <label for="group-gender">{{ t('catalog.genderLabel') }}</label>
          <Select
            v-model="form.gender"
            input-id="group-gender"
            :options="genderOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>
      </div>
      <div v-if="editing" class="field">
        <label for="group-status">{{ t('academy.groups.columns.status') }}</label>
        <Select
          v-model="form.status"
          input-id="group-status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :invalid="!!err('status')"
          fluid
        />
      </div>

      <fieldset class="options">
        <legend>{{ t('academy.groups.joining') }}</legend>
        <label class="toggle">
          <ToggleSwitch v-model="form.waitlist_enabled" input-id="group-waitlist" />
          <span>{{ t('academy.groups.waitlistEnabled') }}</span>
        </label>
        <label class="toggle">
          <ToggleSwitch v-model="form.accepts_trials" input-id="group-trials" />
          <span>{{ t('academy.groups.acceptsTrials') }}</span>
        </label>
        <label class="toggle">
          <ToggleSwitch v-model="form.allow_drop_in" input-id="group-dropin" />
          <span
            >{{ t('academy.groups.allowDropIn')
            }}<small class="hint">{{ t('academy.groups.allowDropInHint') }}</small></span
          >
        </label>
        <div class="field">
          <label for="group-fee">{{ t('academy.groups.fee') }}</label>
          <InputNumber
            v-model="form.fee"
            input-id="group-fee"
            :min="0"
            :max-fraction-digits="3"
            :invalid="!!err('fee')"
            fluid
          />
          <small v-if="err('fee')" class="error">{{ err('fee') }}</small>
          <small v-else class="hint">{{ t('academy.groups.feeHint') }}</small>
        </div>
      </fieldset>

      <template v-if="!editing">
        <div class="field">
          <label for="group-head">{{ t('academy.coaches.head') }} *</label>
          <Select
            v-model="form.head_coach_id"
            input-id="group-head"
            :options="options?.coaches ?? []"
            option-label="name"
            option-value="id"
            :disabled="!form.service_id"
            :empty-message="t('academy.coaches.noneEligible')"
            filter
            :invalid="!!err('head_coach_id')"
            fluid
          />
          <small v-if="err('head_coach_id')" class="error">{{ err('head_coach_id') }}</small>
          <small v-else class="hint">{{ t('academy.coaches.eligibleHint') }}</small>
        </div>
        <div class="field">
          <label for="group-assistants">{{ t('academy.coaches.assistants') }}</label>
          <MultiSelect
            v-model="form.assistant_ids"
            input-id="group-assistants"
            :options="assistantOptions"
            option-label="name"
            option-value="id"
            :disabled="!form.service_id"
            display="chip"
            filter
            :invalid="!!assistantError"
            fluid
          />
          <small v-if="assistantError" class="error">{{ assistantError }}</small>
        </div>
      </template>

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
          form="group-form"
          :label="editing ? t('permissions.save') : t('academy.groups.create')"
          :loading="saving"
        />
      </div>
    </template>
  </Drawer>
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
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
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
.options {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.options legend {
  font-weight: var(--fw-medium);
  padding: 0 4px;
}
.toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.toggle span {
  display: flex;
  flex-direction: column;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
@media (max-width: 480px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.group-drawer.p-drawer {
  width: min(560px, 100vw);
}
</style>
