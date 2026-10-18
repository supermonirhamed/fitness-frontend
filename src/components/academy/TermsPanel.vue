<script setup lang="ts">
// Terms of a term-based program (US-10.03): dates, the enrollment window and excluded dates
// (holidays). Trainings also skip the branch's closures (US-01.07), shown per branch. Copying a
// term prepares the next one with the same groups, ready for re-enrollment (US-10.14).
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import { tenantApi, type AcademyTerm, type ExcludedDate, type Translated } from '@/api/tenant'
import { addDays, daysBetween, enrollmentState, fromYmd, showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { emptyTranslated, translatedErrors } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ programId: number; terms: AcademyTerm[] }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('academy.create'))
const canUpdate = computed(() => auth.can('academy.update'))
const canDelete = computed(() => auth.can('academy.delete'))
const day = (ymd: string) => showDay(format, ymd)
const STATE_SEVERITY = { upcoming: 'info', open: 'success', closed: 'secondary' } as const

const open = ref(false)
const mode = ref<'new' | 'edit' | 'copy'>('new')
const source = ref<AcademyTerm | null>(null)
const form = reactive<{
  name: Translated
  dates: (Date | null)[] | null
  window: (Date | null)[] | null
}>({ name: emptyTranslated(), dates: null, window: null })
const excluded = ref<{ date: Date | null; reason: string }[]>([])
const closures = ref<AcademyTerm['excluded_by_location']>([])
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const err = (...fields: string[]) => fields.map((f) => errors.value[f]?.[0]).find(Boolean)

function start(next: 'new' | 'edit' | 'copy', term: AcademyTerm | null) {
  mode.value = next
  source.value = term
  closures.value = []
  // A copy starts the day after the term ends and lasts as long, with the window moved along.
  const shift = next === 'copy' && term ? daysBetween(term.starts_on, term.ends_on) + 1 : 0
  const at = (ymd: string) => fromYmd(addDays(ymd, shift))
  form.name =
    term && next === 'edit' ? { ar: term.name.ar ?? '', en: term.name.en ?? '' } : emptyTranslated()
  form.dates = term ? [at(term.starts_on), at(term.ends_on)] : null
  form.window = term ? [at(term.enrollment_opens_on), at(term.enrollment_closes_on)] : null
  excluded.value =
    term && next === 'edit'
      ? term.excluded_dates.map((d) => ({ date: fromYmd(d.date), reason: d.reason ?? '' }))
      : []
  errors.value = {}
  formError.value = null
  open.value = true
  if (term && next === 'edit')
    tenantApi.academy.terms
      .get(term.id)
      .then((full) => (closures.value = full.excluded_by_location ?? []))
      .catch(() => null)
}
const title = computed(() =>
  mode.value === 'edit'
    ? t('academy.terms.editTitle')
    : mode.value === 'copy'
      ? t('academy.terms.copyTitle', { name: source.value?.display_name })
      : t('academy.terms.newTitle'),
)
const closureDates = computed(() =>
  (closures.value ?? [])
    .map((b) => ({ ...b, dates: b.dates.filter((d) => d.source === 'closure') }))
    .filter((b) => b.dates.length),
)

async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const ymd = (d: Date | null | undefined) => (d ? isoDay(d) : null)
  const input = {
    name: form.name,
    starts_on: ymd(form.dates?.[0]),
    ends_on: ymd(form.dates?.[1]),
    enrollment_opens_on: ymd(form.window?.[0]),
    enrollment_closes_on: ymd(form.window?.[1]),
    excluded_dates: excluded.value
      .filter((d) => d.date)
      .map((d): ExcludedDate => ({ date: isoDay(d.date!), reason: d.reason || null })),
  }
  try {
    if (mode.value === 'edit') await tenantApi.academy.terms.update(source.value!.id, input)
    else if (mode.value === 'copy') {
      const copy = await tenantApi.academy.terms.copy(source.value!.id, input)
      toast.add({
        severity: 'success',
        summary: t('academy.terms.copied', { n: copy.groups_count ?? 0 }),
        life: 4000,
      })
    } else await tenantApi.academy.terms.create(props.programId, input)
    if (mode.value !== 'copy')
      toast.add({ severity: 'success', summary: t('academy.terms.saved'), life: 3000 })
    open.value = false
    emit('changed')
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
async function archive(term: AcademyTerm) {
  try {
    await tenantApi.academy.terms.archive(term.id, !term.archived)
    emit('changed')
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <div>
        <h2>{{ t('academy.terms.title') }}</h2>
        <p class="muted">{{ t('academy.terms.hint') }}</p>
      </div>
      <Button
        v-if="canCreate"
        :label="t('academy.terms.add')"
        icon="pi pi-plus"
        size="small"
        @click="start('new', null)"
      />
    </header>

    <EmptyState
      v-if="!terms.length"
      compact
      icon="pi-calendar"
      :title="t('academy.terms.none')"
      :body="t('academy.terms.noneHint')"
    />
    <ul v-else class="rows">
      <li v-for="term in terms" :key="term.id" :class="['row', { muted: term.archived }]">
        <div class="row__main">
          <div class="row__title">
            {{ term.display_name }}
            <Tag v-if="term.archived" :value="t('catalog.status.Archived')" severity="secondary" />
            <Tag
              v-else
              :value="t(`academy.terms.enrollment.${enrollmentState(term)}`)"
              :severity="STATE_SEVERITY[enrollmentState(term)]"
            />
          </div>
          <div class="small">{{ day(term.starts_on) }} – {{ day(term.ends_on) }}</div>
          <div class="muted small">
            {{
              t('academy.terms.window', {
                from: day(term.enrollment_opens_on),
                to: day(term.enrollment_closes_on),
              })
            }}
            · {{ t('academy.terms.groups', { n: term.groups_count ?? 0 }) }}
            <template v-if="term.excluded_dates.length">
              · {{ t('academy.terms.excludedCount', { n: term.excluded_dates.length }) }}
            </template>
          </div>
        </div>
        <div class="row__actions">
          <Button
            v-if="canUpdate"
            icon="pi pi-pencil"
            text
            rounded
            size="small"
            :aria-label="t('common.edit')"
            @click="start('edit', term)"
          />
          <Button
            v-if="canCreate && !term.archived"
            icon="pi pi-copy"
            text
            rounded
            size="small"
            v-tooltip.top="t('academy.terms.copy')"
            :aria-label="t('academy.terms.copy')"
            @click="start('copy', term)"
          />
          <RouterLink
            v-if="!term.archived"
            v-tooltip.top="t('academy.reenroll.title')"
            :to="{ name: 'tenant.academy.reenrollment', params: { id: term.id } }"
            :aria-label="t('academy.reenroll.title')"
            class="p-button p-button-text p-button-rounded p-button-sm p-button-icon-only"
            ><i class="pi pi-send" aria-hidden="true"
          /></RouterLink>
          <Button
            v-if="canDelete"
            :icon="term.archived ? 'pi pi-replay' : 'pi pi-inbox'"
            text
            rounded
            size="small"
            v-tooltip.top="term.archived ? t('academy.restore') : t('academy.archive')"
            :aria-label="term.archived ? t('academy.restore') : t('academy.archive')"
            @click="archive(term)"
          />
        </div>
      </li>
    </ul>

    <FormDrawer
      v-model:visible="open"
      :title="title"
      size="lg"
      :saving="saving"
      :error="formError"
      :save-label="mode === 'copy' ? t('academy.terms.copyAction') : undefined"
      @save="save"
    >
      <Message v-if="mode === 'copy'" severity="info" :closable="false">
        {{ t('academy.terms.copyHint') }}
      </Message>
      <TranslatedField
        id="term-name"
        v-model="form.name"
        :label="t('academy.name')"
        required
        :maxlength="80"
        :errors="translatedErrors(errors, 'name')"
      />
      <div class="two">
        <FormField
          :label="t('academy.terms.dates')"
          for="term-dates"
          required
          :error="err('starts_on', 'ends_on')"
        >
          <DatePicker
            v-model="form.dates"
            input-id="term-dates"
            selection-mode="range"
            :manual-input="false"
            show-icon
            fluid
          />
        </FormField>
        <FormField
          :label="t('academy.terms.enrollmentWindow')"
          for="term-window"
          required
          :help="t('academy.terms.enrollmentHint')"
          :error="err('enrollment_opens_on', 'enrollment_closes_on')"
        >
          <DatePicker
            v-model="form.window"
            input-id="term-window"
            selection-mode="range"
            :manual-input="false"
            show-icon
            fluid
          />
        </FormField>
      </div>

      <fieldset class="excluded">
        <legend>{{ t('academy.terms.excluded') }}</legend>
        <p class="muted small">{{ t('academy.terms.excludedHint') }}</p>
        <div v-for="(row, i) in excluded" :key="i" class="excluded__row">
          <DatePicker
            v-model="row.date"
            :input-id="`excluded-${i}`"
            :min-date="form.dates?.[0] ?? undefined"
            :max-date="form.dates?.[1] ?? undefined"
            :invalid="!!errors[`excluded_dates.${i}.date`]"
            :aria-label="t('academy.terms.excludedDate')"
            show-icon
          />
          <InputText
            v-model="row.reason"
            :placeholder="t('academy.terms.reason')"
            :aria-label="t('academy.terms.reason')"
            maxlength="120"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            :aria-label="t('academy.delete')"
            @click="excluded.splice(i, 1)"
          />
        </div>
        <Button
          :label="t('academy.terms.addExcluded')"
          icon="pi pi-plus"
          text
          size="small"
          @click="excluded.push({ date: null, reason: '' })"
        />
      </fieldset>

      <div v-if="closureDates.length" class="closures">
        <strong>{{ t('academy.terms.closures') }}</strong>
        <div v-for="b in closureDates" :key="b.location_id" class="small">
          {{ b.location }}:
          {{ b.dates.map((d) => `${day(d.date)}${d.reason ? ` (${d.reason})` : ''}`).join('، ') }}
        </div>
      </div>
    </FormDrawer>
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
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.excluded {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}
.excluded legend {
  font-weight: 600;
  padding: 0 4px;
}
.excluded p {
  margin: 0;
}
.excluded__row {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 8px;
  align-items: center;
}
.closures {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: var(--radius-card);
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
@media (max-width: 560px) {
  .two,
  .excluded__row {
    grid-template-columns: 1fr;
  }
}
</style>
