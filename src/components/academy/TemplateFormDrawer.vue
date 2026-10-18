<script setup lang="ts">
// An evaluation template (US-10.18): sections of criteria, each rated 1–5, 1–10, by level (needs
// improvement / good / excellent) or as a measured value with a unit (e.g. a 50 m time in seconds,
// where lower is better). Saving a change creates a new version; evaluations already made keep
// theirs.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import {
  tenantApi,
  type EvaluationScale,
  type EvaluationSection,
  type EvaluationTemplate,
  type Translated,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { translatedErrors } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const props = defineProps<{ programId: number; template: EvaluationTemplate | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [template: EvaluationTemplate] }>()
const { t } = useI18n()

const name = ref<Translated>({ ar: '', en: '' })
const sections = ref<EvaluationSection[]>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const scales: { value: EvaluationScale; label: string }[] = (
  ['1-5', '1-10', 'levels', 'measure'] as const
).map((s) => ({
  value: s,
  label: t(`academy.evaluations.scales.${s}`),
}))
const blankCriterion = () => ({
  name: { ar: '', en: '' },
  scale: '1-5' as EvaluationScale,
  unit: null,
  lower_is_better: false,
})

watch(visible, (open) => {
  if (!open) return
  name.value = { ar: props.template?.name.ar ?? '', en: props.template?.name.en ?? '' }
  sections.value = props.template
    ? JSON.parse(JSON.stringify(props.template.sections))
    : [{ name: { ar: '', en: '' }, criteria: [blankCriterion()] }]
  errors.value = {}
  formError.value = null
})

const addSection = () =>
  sections.value.push({ name: { ar: '', en: '' }, criteria: [blankCriterion()] })
const removeSection = (i: number) => sections.value.splice(i, 1)
const addCriterion = (s: EvaluationSection) => s.criteria.push(blankCriterion())
const removeCriterion = (s: EvaluationSection, i: number) => s.criteria.splice(i, 1)

async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const input = { name: name.value, sections: sections.value }
    const saved = props.template
      ? await tenantApi.academy.evaluations.updateTemplate(props.template.id, input)
      : await tenantApi.academy.evaluations.createTemplate(props.programId, input)
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="template ? t('academy.evaluations.editTemplate') : t('academy.evaluations.newTemplate')"
    :subtitle="template ? t('academy.evaluations.version', { n: template.version }) : undefined"
    size="lg"
    :saving="saving"
    :error="formError"
    @save="save"
  >
    <Message v-if="template" severity="info" :closable="false">{{
      t('academy.evaluations.versionHint')
    }}</Message>
    <TranslatedField
      id="tpl-name"
      v-model="name"
      :label="t('academy.name')"
      required
      :maxlength="120"
      :errors="translatedErrors(errors, 'name')"
    />

    <fieldset v-for="(section, si) in sections" :key="si" class="section">
      <legend>{{ t('academy.evaluations.section', { n: si + 1 }) }}</legend>
      <div class="pair">
        <InputText
          v-model="section.name.ar"
          :placeholder="t('academy.evaluations.sectionName') + ' (ع)'"
          :aria-label="t('academy.evaluations.sectionName')"
          maxlength="120"
          dir="rtl"
          :invalid="!!errors[`sections.${si}.name.ar`]"
          fluid
        />
        <InputText
          v-model="section.name.en"
          :placeholder="t('academy.evaluations.sectionName') + ' (EN)'"
          :aria-label="t('academy.evaluations.sectionName')"
          maxlength="120"
          dir="ltr"
          fluid
        />
        <Button
          v-if="sections.length > 1"
          icon="pi pi-trash"
          size="small"
          variant="text"
          severity="danger"
          :aria-label="t('academy.delete')"
          @click="removeSection(si)"
        />
      </div>
      <div v-for="(criterion, ci) in section.criteria" :key="ci" class="criterion">
        <InputText
          v-model="criterion.name.ar"
          :placeholder="t('academy.evaluations.criterion') + ' (ع)'"
          :aria-label="t('academy.evaluations.criterion')"
          maxlength="120"
          dir="rtl"
          :invalid="!!errors[`sections.${si}.criteria.${ci}.name.ar`]"
        />
        <InputText
          v-model="criterion.name.en"
          :placeholder="t('academy.evaluations.criterion') + ' (EN)'"
          :aria-label="t('academy.evaluations.criterion')"
          maxlength="120"
          dir="ltr"
        />
        <Select
          v-model="criterion.scale"
          :options="scales"
          option-label="label"
          option-value="value"
          :aria-label="t('academy.evaluations.scale')"
        />
        <template v-if="criterion.scale === 'measure'">
          <InputText
            v-model="criterion.unit"
            :placeholder="t('academy.evaluations.unit')"
            :aria-label="t('academy.evaluations.unit')"
            maxlength="20"
            class="unit"
          />
          <label class="check">
            <Checkbox v-model="criterion.lower_is_better" binary />
            <span>{{ t('academy.evaluations.lowerIsBetter') }}</span>
          </label>
        </template>
        <Button
          v-if="section.criteria.length > 1"
          icon="pi pi-times"
          size="small"
          variant="text"
          severity="secondary"
          :aria-label="t('academy.delete')"
          @click="removeCriterion(section, ci)"
        />
      </div>
      <Button
        :label="t('academy.evaluations.addCriterion')"
        icon="pi pi-plus"
        size="small"
        variant="text"
        @click="addCriterion(section)"
      />
    </fieldset>
    <Button
      :label="t('academy.evaluations.addSection')"
      icon="pi pi-plus"
      size="small"
      severity="secondary"
      @click="addSection"
    />
  </FormDrawer>
</template>

<style scoped>
.section {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section legend {
  font-weight: 600;
  padding: 0 4px;
}
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
}
.criterion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-inline-start: 12px;
  border-inline-start: 2px solid var(--border-default);
}
.criterion > :deep(input) {
  flex: 1 1 140px;
}
.unit {
  max-width: 90px;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}
</style>
