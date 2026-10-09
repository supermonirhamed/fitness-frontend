<script setup lang="ts">
// Create or edit a program (US-02.09): name, sport/category, description, branches, status,
// enrollment (a term with dates, or rolling monthly), age range and who can join.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import {
  tenantApi,
  type Location,
  type Program,
  type ProgramInput,
  type ServiceCategory,
} from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { isoDay } from '@/lib/audit'
import { emptyTranslated, translatedErrors } from '@/lib/catalog'

const props = defineProps<{
  program: Program | null
  categories: ServiceCategory[]
  locations: Location[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [program: Program, created: boolean] }>()
const { t, locale } = useI18n()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const editing = computed(() => props.program !== null)

const form = reactive<Omit<ProgramInput, 'term_start' | 'term_end' | 'location_ids'>>({
  name: emptyTranslated(),
  description: emptyTranslated(),
  category_id: null,
  status: 'Draft',
  enrollment_mode: 'Term',
  age_min: null,
  age_max: null,
  gender: 'Any',
})
const term = ref<(Date | null)[] | null>(null)
const branches = ref<number[]>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)

const categoryOptions = computed(() =>
  props.categories.filter((c) => !c.archived_at || c.id === props.program?.category_id),
)
const modeOptions = computed(() => [
  { value: 'Term', label: t('programs.modes.Term') },
  { value: 'Rolling', label: t('programs.modes.Rolling') },
])
const statusOptions = computed(() =>
  (['Draft', 'Published', 'Archived'] as const)
    .slice(0, editing.value ? 3 : 2)
    .map((s) => ({ value: s, label: t(`catalog.status.${s}`) })),
)
const genderOptions = computed(() =>
  (['Any', 'Male', 'Female'] as const).map((g) => ({ value: g, label: t(`catalog.gender.${g}`) })),
)
const err = (field: string) => errors.value[field]?.[0]
const branchError = computed(() => {
  const key = Object.keys(errors.value).find((k) => k.startsWith('location_ids'))
  return key ? errors.value[key]?.[0] : undefined
})
const fromYmd = (ymd: string | null) => {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

watch(visible, (open) => {
  if (!open) return
  const p = props.program
  Object.assign(form, {
    name: { ar: p?.name.ar ?? '', en: p?.name.en ?? '' },
    description: { ar: p?.description.ar ?? '', en: p?.description.en ?? '' },
    category_id: p?.category_id ?? categoryOptions.value[0]?.id ?? null,
    status: p?.status ?? 'Draft',
    enrollment_mode: p?.enrollment_mode ?? 'Term',
    age_min: p?.age_min ?? null,
    age_max: p?.age_max ?? null,
    gender: p?.gender ?? 'Any',
  })
  term.value = p?.term_start ? [fromYmd(p.term_start), fromYmd(p.term_end)] : null
  branches.value = p
    ? (p.locations ?? []).map((l) => l.id)
    : props.locations.length === 1
      ? [props.locations[0]!.id]
      : []
  errors.value = {}
  formError.value = null
})

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const isTerm = form.enrollment_mode === 'Term'
  const input: ProgramInput = {
    ...form,
    term_start: isTerm && term.value?.[0] ? isoDay(term.value[0]) : null,
    term_end: isTerm && term.value?.[1] ? isoDay(term.value[1]) : null,
    location_ids: branches.value,
  }
  try {
    const saved = props.program
      ? await tenantApi.programs.update(props.program.id, input)
      : await tenantApi.programs.create(input)
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
      editing ? t('programs.editTitle', { name: program?.display_name }) : t('programs.newTitle')
    "
    class="program-drawer"
  >
    <form id="program-form" class="form" @submit.prevent="submit">
      <Message severity="info" :closable="false">{{ t('programs.academyNote') }}</Message>
      <TranslatedField
        id="program-name"
        v-model="form.name"
        :label="t('catalog.serviceName')"
        required
        :maxlength="120"
        :errors="translatedErrors(errors, 'name')"
      />
      <div class="row">
        <div class="field">
          <label for="program-category">{{ t('programs.category') }} *</label>
          <Select
            v-model="form.category_id"
            input-id="program-category"
            :options="categoryOptions"
            option-label="display_name"
            option-value="id"
            :invalid="!!err('category_id')"
            fluid
          />
          <small v-if="err('category_id')" class="error">{{ err('category_id') }}</small>
        </div>
        <div class="field">
          <span id="program-status" class="label">{{ t('catalog.statusLabel') }} *</span>
          <SelectButton
            v-model="form.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            aria-labelledby="program-status"
          />
        </div>
      </div>

      <div class="field">
        <span id="program-mode" class="label">{{ t('programs.enrollment') }} *</span>
        <SelectButton
          v-model="form.enrollment_mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="program-mode"
        />
        <small class="hint">{{ t(`programs.modeHints.${form.enrollment_mode}`) }}</small>
      </div>
      <div v-if="form.enrollment_mode === 'Term'" class="field">
        <label for="program-term">{{ t('programs.term') }} *</label>
        <DatePicker
          v-model="term"
          input-id="program-term"
          selection-mode="range"
          :manual-input="false"
          date-format="yy-mm-dd"
          :invalid="!!(err('term_start') || err('term_end'))"
          fluid
        />
        <small v-if="err('term_start') || err('term_end')" class="error">{{
          err('term_start') ?? err('term_end')
        }}</small>
      </div>

      <fieldset class="field branches">
        <legend class="label">{{ t('programs.branches') }} *</legend>
        <label v-for="l in locations" :key="l.id" class="check">
          <Checkbox v-model="branches" :value="l.id" :input-id="`program-branch-${l.id}`" />{{
            l.name
          }}
        </label>
        <small v-if="branchError" class="error">{{ branchError }}</small>
      </fieldset>

      <div class="row">
        <div class="field">
          <span class="label">{{ t('catalog.ageRange') }}</span>
          <div class="ages">
            <InputNumber
              v-model="form.age_min"
              :min="0"
              :max="100"
              :placeholder="t('catalog.from')"
              :aria-label="t('catalog.ageFrom')"
            />
            <span aria-hidden="true">–</span>
            <InputNumber
              v-model="form.age_max"
              :min="0"
              :max="100"
              :placeholder="t('catalog.to')"
              :aria-label="t('catalog.ageTo')"
              :invalid="!!err('age_max')"
            />
          </div>
          <small v-if="err('age_max')" class="error">{{ err('age_max') }}</small>
        </div>
        <div class="field">
          <label for="program-gender">{{ t('catalog.genderLabel') }}</label>
          <Select
            v-model="form.gender"
            input-id="program-gender"
            :options="genderOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>
      </div>

      <TranslatedField
        id="program-description"
        v-model="form.description!"
        :label="t('catalog.description')"
        multiline
        :maxlength="2000"
        :errors="translatedErrors(errors, 'description')"
      />
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
          form="program-form"
          :label="editing ? t('permissions.save') : t('programs.create')"
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
.field label,
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.branches {
  margin: 0;
  padding: 0;
  border: 0;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  font-weight: normal;
}
.ages {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ages :deep(input) {
  width: 80px;
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
@media (max-width: 480px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.program-drawer.p-drawer {
  width: min(520px, 100vw);
}
</style>
