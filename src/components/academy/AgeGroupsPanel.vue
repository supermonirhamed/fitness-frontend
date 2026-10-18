<script setup lang="ts">
// Age groups (US-10.02): a minimum and maximum age counted today or on a cut-off date (e.g. 1
// January of the season). The organization's are shared by every program; a program can add its
// own. Includes a quick check of which age group a date of birth falls into.
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import {
  tenantApi,
  type AcademyTerm,
  type AgeGroup,
  type AgeGroupInput,
  type AgeRule,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { emptyTranslated, translatedErrors } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ programId: number; terms: AcademyTerm[] }>()
const { t, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('academy.create'))
const canUpdate = computed(() => auth.can('academy.update'))
const canDelete = computed(() => auth.can('academy.delete'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const groups = ref<AgeGroup[]>([])
async function load() {
  try {
    groups.value = await tenantApi.academy.ageGroups.list(props.programId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const monthName = (m: number) =>
  new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(2000, m - 1, 1))
const ruleLabel = (g: AgeGroup) =>
  g.age_rule === 'cutoff' && g.cutoff_month
    ? t('academy.ageGroups.onCutoff', { date: `${g.cutoff_day} ${monthName(g.cutoff_month)}` })
    : t('academy.ageGroups.today')
const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthName(i + 1) })),
)
const ruleOptions = computed(() =>
  (['today', 'cutoff'] as const).map((value) => ({
    value,
    label: t(`academy.ageGroups.rules.${value}`),
  })),
)
const scopeOptions = computed(() => [
  { value: 'program', label: t('academy.ageGroups.scopeProgram') },
  { value: 'organization', label: t('academy.ageGroups.scopeOrganization') },
])

const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })

const open = ref(false)
const editing = ref<AgeGroup | null>(null)
const scope = ref<'program' | 'organization'>('program')
const form = reactive<AgeGroupInput>({
  name: emptyTranslated(),
  min_age: null,
  max_age: null,
  age_rule: 'today',
  cutoff_month: 1,
  cutoff_day: 1,
})
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const err = (field: string) => errors.value[field]?.[0]
function edit(group: AgeGroup | null) {
  editing.value = group
  scope.value = group && group.program_id === null ? 'organization' : 'program'
  Object.assign(form, {
    name: { ar: group?.name.ar ?? '', en: group?.name.en ?? '' },
    min_age: group?.min_age ?? null,
    max_age: group?.max_age ?? null,
    age_rule: (group?.age_rule ?? 'today') as AgeRule,
    cutoff_month: group?.cutoff_month ?? 1,
    cutoff_day: group?.cutoff_day ?? 1,
  })
  errors.value = {}
  formError.value = null
  open.value = true
}
async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const input: AgeGroupInput = {
    ...form,
    cutoff_month: form.age_rule === 'cutoff' ? form.cutoff_month : null,
    cutoff_day: form.age_rule === 'cutoff' ? form.cutoff_day : null,
  }
  try {
    if (editing.value) await tenantApi.academy.ageGroups.update(editing.value.id, input)
    else
      await tenantApi.academy.ageGroups.create({
        ...input,
        program_id: scope.value === 'program' ? props.programId : null,
      })
    open.value = false
    toast.add({ severity: 'success', summary: t('academy.ageGroups.saved'), life: 3000 })
    await load()
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
async function archive(group: AgeGroup, archived: boolean) {
  try {
    await tenantApi.academy.ageGroups.archive(group.id, archived)
    await load()
  } catch (e) {
    fail(e)
  }
}
async function remove(group: AgeGroup) {
  try {
    await tenantApi.academy.ageGroups.remove(group.id)
    await load()
  } catch (e) {
    fail(e)
  }
}

// Which age group a child born on a date belongs to.
const birth = ref<Date | null>(null)
const checkTerm = ref<number | null>(null)
const fits = ref<Record<number, { age: number; fits: boolean }> | null>(null)
async function check() {
  if (!birth.value) {
    fits.value = null
    return
  }
  try {
    const result = await tenantApi.academy.ageGroups.suggest(props.programId, {
      date_of_birth: isoDay(birth.value),
      term_id: checkTerm.value ?? undefined,
    })
    fits.value = Object.fromEntries(result.groups.map((g) => [g.id, g]))
  } catch (e) {
    fail(e)
  }
}
const termOptions = computed(() => [
  { value: null, label: t('academy.ageGroups.noTerm') },
  ...props.terms.map((term) => ({ value: term.id, label: term.display_name ?? '' })),
])
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <div>
        <h2>{{ t('academy.ageGroups.title') }}</h2>
        <p class="muted">{{ t('academy.ageGroups.hint') }}</p>
      </div>
      <Button
        v-if="canCreate"
        :label="t('academy.ageGroups.add')"
        icon="pi pi-plus"
        size="small"
        @click="edit(null)"
      />
    </header>

    <div v-if="groups.length" class="checker">
      <FormField :label="t('academy.ageGroups.checkBirth')" for="age-check-dob">
        <DatePicker
          v-model="birth"
          input-id="age-check-dob"
          :max-date="new Date()"
          show-icon
          date-format="yy-mm-dd"
          @update:model-value="check"
        />
      </FormField>
      <FormField v-if="terms.length" :label="t('academy.ageGroups.checkTerm')" for="age-check-term">
        <Select
          v-model="checkTerm"
          input-id="age-check-term"
          :options="termOptions"
          option-label="label"
          option-value="value"
          @change="check"
        />
      </FormField>
    </div>

    <div v-if="state === 'loading'" class="pad">
      <Skeleton v-for="n in 3" :key="n" height="40px" />
    </div>
    <ErrorState v-else-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="!groups.length"
      compact
      icon="pi-users"
      :title="t('academy.ageGroups.none')"
      :body="t('academy.ageGroups.noneHint')"
    />
    <ul v-else class="rows">
      <li
        v-for="group in groups"
        :key="group.id"
        :class="['row', { muted: group.archived, fit: fits?.[group.id]?.fits }]"
      >
        <div class="row__main">
          <div class="row__title">
            {{ group.display_name }}
            <Tag
              :value="
                group.program_id === null
                  ? t('academy.ageGroups.scopeOrganization')
                  : t('academy.ageGroups.scopeProgram')
              "
              :severity="group.program_id === null ? 'info' : 'secondary'"
            />
            <Tag v-if="group.archived" :value="t('catalog.status.Archived')" severity="secondary" />
          </div>
          <div class="muted small">
            <span dir="ltr">{{
              t('academy.ageGroups.ages', { min: group.min_age, max: group.max_age })
            }}</span>
            · {{ ruleLabel(group) }}
          </div>
        </div>
        <span
          v-if="fits?.[group.id]"
          :class="['fit-tag', { 'fit-tag--yes': fits[group.id]!.fits }]"
        >
          <i :class="['pi', fits[group.id]!.fits ? 'pi-check' : 'pi-minus']" aria-hidden="true" />
          {{ t('academy.ageGroups.ageIs', { age: fits[group.id]!.age }) }}
        </span>
        <div v-if="canUpdate || canDelete" class="row__actions">
          <Button
            v-if="canUpdate"
            icon="pi pi-pencil"
            text
            rounded
            size="small"
            :aria-label="t('common.edit')"
            @click="edit(group)"
          />
          <template v-if="canDelete">
            <Button
              v-if="group.in_use || group.archived"
              :icon="group.archived ? 'pi pi-replay' : 'pi pi-inbox'"
              text
              rounded
              size="small"
              v-tooltip.top="group.archived ? t('academy.restore') : t('academy.archive')"
              :aria-label="group.archived ? t('academy.restore') : t('academy.archive')"
              @click="archive(group, !group.archived)"
            />
            <Button
              v-else
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :aria-label="t('academy.delete')"
              @click="remove(group)"
            />
          </template>
        </div>
      </li>
    </ul>

    <FormDialog
      v-model:visible="open"
      :title="editing ? t('academy.ageGroups.editTitle') : t('academy.ageGroups.newTitle')"
      icon="pi-users"
      :saving="saving"
      :error="formError"
      @save="save"
    >
      <TranslatedField
        id="age-group-name"
        v-model="form.name"
        :label="t('academy.name')"
        required
        :maxlength="60"
        :errors="translatedErrors(errors, 'name')"
      />
      <FormField v-if="!editing" :label="t('academy.ageGroups.scope')">
        <SelectButton
          v-model="scope"
          :options="scopeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <div class="two">
        <FormField
          :label="t('academy.ageGroups.minAge')"
          for="age-min"
          required
          :error="err('min_age')"
        >
          <InputNumber v-model="form.min_age" input-id="age-min" :min="0" :max="99" fluid />
        </FormField>
        <FormField
          :label="t('academy.ageGroups.maxAge')"
          for="age-max"
          required
          :error="err('max_age')"
        >
          <InputNumber v-model="form.max_age" input-id="age-max" :min="0" :max="99" fluid />
        </FormField>
      </div>
      <FormField
        :label="t('academy.ageGroups.rule')"
        :help="t(`academy.ageGroups.ruleHints.${form.age_rule}`)"
      >
        <SelectButton
          v-model="form.age_rule"
          :options="ruleOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <div v-if="form.age_rule === 'cutoff'" class="two">
        <FormField
          :label="t('academy.ageGroups.cutoffDay')"
          for="cutoff-day"
          :error="err('cutoff_day')"
        >
          <InputNumber v-model="form.cutoff_day" input-id="cutoff-day" :min="1" :max="31" fluid />
        </FormField>
        <FormField
          :label="t('academy.ageGroups.cutoffMonth')"
          for="cutoff-month"
          :error="err('cutoff_month')"
        >
          <Select
            v-model="form.cutoff_month"
            input-id="cutoff-month"
            :options="monthOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
      </div>
    </FormDialog>
  </section>
</template>

<style scoped>
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.panel__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}
.panel__head h2 {
  margin: 0;
  font-size: 1rem;
}
.panel__head p {
  margin: 4px 0 0;
}
.checker {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 20px;
  background: var(--surface-ground);
  border-bottom: 1px solid var(--border-default);
}
.pad {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-default);
}
.row:last-child {
  border-bottom: 0;
}
.row.fit {
  background: color-mix(in srgb, var(--p-green-500) 8%, transparent);
}
.row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-weight: 600;
}
.row__actions {
  display: flex;
}
.fit-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}
.fit-tag--yes {
  color: var(--p-green-600);
  font-weight: 600;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
