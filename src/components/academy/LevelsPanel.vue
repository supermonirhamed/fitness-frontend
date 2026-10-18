<script setup lang="ts">
// A program's levels (US-10.01): in order, reorderable, with entry requirements. Levels are
// optional; one a group uses is archived instead of deleted.
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import { tenantApi, type ProgramLevel, type Translated } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { emptyTranslated, translatedErrors } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ programId: number }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('academy.create'))
const canUpdate = computed(() => auth.can('academy.update'))
const canDelete = computed(() => auth.can('academy.delete'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const levels = ref<ProgramLevel[]>([])
async function load() {
  try {
    levels.value = await tenantApi.academy.levels.list(props.programId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })

async function move(index: number, by: -1 | 1) {
  const ids = levels.value.map((l) => l.id)
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  try {
    levels.value = await tenantApi.academy.levels.reorder(props.programId, ids)
  } catch (e) {
    fail(e)
  }
}

const open = ref(false)
const editing = ref<ProgramLevel | null>(null)
const form = reactive<{
  name: Translated
  description: Translated
  entry_requirements: Translated
}>({
  name: emptyTranslated(),
  description: emptyTranslated(),
  entry_requirements: emptyTranslated(),
})
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
function edit(level: ProgramLevel | null) {
  editing.value = level
  const copy = (v?: Translated) => ({ ar: v?.ar ?? '', en: v?.en ?? '' })
  Object.assign(form, {
    name: copy(level?.name),
    description: copy(level?.description),
    entry_requirements: copy(level?.entry_requirements),
  })
  errors.value = {}
  formError.value = null
  open.value = true
}
async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    if (editing.value) await tenantApi.academy.levels.update(editing.value.id, form)
    else await tenantApi.academy.levels.create(props.programId, form)
    open.value = false
    toast.add({ severity: 'success', summary: t('academy.levels.saved'), life: 3000 })
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

async function archive(level: ProgramLevel, archived: boolean) {
  try {
    await tenantApi.academy.levels.archive(level.id, archived)
    await load()
  } catch (e) {
    fail(e)
  }
}
async function remove(level: ProgramLevel) {
  try {
    await tenantApi.academy.levels.remove(level.id)
    toast.add({ severity: 'success', summary: t('academy.levels.deleted'), life: 3000 })
    await load()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <div>
        <h2>{{ t('academy.levels.title') }}</h2>
        <p class="muted">{{ t('academy.levels.hint') }}</p>
      </div>
      <Button
        v-if="canCreate"
        :label="t('academy.levels.add')"
        icon="pi pi-plus"
        size="small"
        @click="edit(null)"
      />
    </header>

    <div v-if="state === 'loading'" class="pad">
      <Skeleton v-for="n in 3" :key="n" height="40px" />
    </div>
    <ErrorState v-else-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="!levels.length"
      compact
      icon="pi-sort-amount-up"
      :title="t('academy.levels.none')"
      :body="t('academy.levels.noneHint')"
    />
    <ol v-else class="rows">
      <li v-for="(level, i) in levels" :key="level.id" :class="['row', { muted: level.archived }]">
        <span class="order" aria-hidden="true">{{ i + 1 }}</span>
        <div class="row__main">
          <div class="row__title">
            {{ level.display_name }}
            <Tag v-if="level.archived" :value="t('catalog.status.Archived')" severity="secondary" />
          </div>
          <div v-if="level.description.en || level.description.ar" class="muted small">
            {{ level.description.ar || level.description.en }}
          </div>
          <div v-if="level.entry_requirements.en || level.entry_requirements.ar" class="small">
            <i class="pi pi-check-square" aria-hidden="true" />
            {{ level.entry_requirements.ar || level.entry_requirements.en }}
          </div>
        </div>
        <div v-if="canUpdate || canDelete" class="row__actions">
          <template v-if="canUpdate">
            <Button
              icon="pi pi-arrow-up"
              text
              rounded
              size="small"
              :disabled="i === 0"
              :aria-label="t('academy.levels.moveUp')"
              @click="move(i, -1)"
            />
            <Button
              icon="pi pi-arrow-down"
              text
              rounded
              size="small"
              :disabled="i === levels.length - 1"
              :aria-label="t('academy.levels.moveDown')"
              @click="move(i, 1)"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              :aria-label="t('common.edit')"
              @click="edit(level)"
            />
          </template>
          <template v-if="canDelete">
            <Button
              v-if="level.in_use || level.archived"
              :icon="level.archived ? 'pi pi-replay' : 'pi pi-inbox'"
              text
              rounded
              size="small"
              :aria-label="level.archived ? t('academy.restore') : t('academy.archive')"
              v-tooltip.top="level.archived ? t('academy.restore') : t('academy.archive')"
              @click="archive(level, !level.archived)"
            />
            <Button
              v-else
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              :aria-label="t('academy.delete')"
              @click="remove(level)"
            />
          </template>
        </div>
      </li>
    </ol>

    <FormDialog
      v-model:visible="open"
      :title="editing ? t('academy.levels.editTitle') : t('academy.levels.newTitle')"
      icon="pi-sort-amount-up"
      :saving="saving"
      :error="formError"
      @save="save"
    >
      <TranslatedField
        id="level-name"
        v-model="form.name"
        :label="t('academy.name')"
        required
        :maxlength="80"
        :errors="translatedErrors(errors, 'name')"
      />
      <TranslatedField
        id="level-description"
        v-model="form.description"
        :label="t('catalog.description')"
        multiline
        :maxlength="1000"
      />
      <TranslatedField
        id="level-requirements"
        v-model="form.entry_requirements"
        :label="t('academy.levels.requirements')"
        multiline
        :maxlength="1000"
      />
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
.order {
  inline-size: 28px;
  block-size: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-ground);
  font-weight: 600;
  flex: none;
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
  gap: 8px;
  align-items: center;
  font-weight: 600;
}
.row__actions {
  display: flex;
  flex-wrap: wrap;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
