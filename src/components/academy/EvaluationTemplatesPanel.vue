<script setup lang="ts">
// A program's evaluation templates (US-10.18): their sections and criteria at the current
// version; new, edit (a new version) and archive.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import TemplateFormDrawer from '@/components/academy/TemplateFormDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type EvaluationTemplate } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ programId: number }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('academy.create'))
const canUpdate = computed(() => auth.can('academy.update'))
const pick = (n: { ar?: string | null; en?: string | null }) =>
  locale.value === 'ar' ? n.ar || n.en : n.en || n.ar

const state = ref<'loading' | 'ready' | 'error'>('loading')
const templates = ref<EvaluationTemplate[]>([])
async function load() {
  state.value = 'loading'
  try {
    templates.value = await tenantApi.academy.evaluations.templates(props.programId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
const formOpen = ref(false)
const editing = ref<EvaluationTemplate | null>(null)
function open(tpl: EvaluationTemplate | null) {
  editing.value = tpl
  formOpen.value = true
}
async function archive(tpl: EvaluationTemplate) {
  await tenantApi.academy.evaluations.archiveTemplate(tpl.id, !tpl.archived).catch(() => null)
  load()
}
</script>

<template>
  <div class="card">
    <header class="head">
      <div>
        <h2>{{ t('academy.evaluations.templates') }}</h2>
        <p class="muted">{{ t('academy.evaluations.templatesHint') }}</p>
      </div>
      <Button
        v-if="canCreate"
        :label="t('academy.evaluations.newTemplate')"
        icon="pi pi-plus"
        size="small"
        @click="open(null)"
      />
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="state === 'ready' && !templates.length"
      compact
      icon="pi-chart-bar"
      :title="t('academy.evaluations.noTemplates')"
      :body="t('academy.evaluations.noTemplatesHint')"
    />
    <ul v-else class="list">
      <li v-for="tpl in templates" :key="tpl.id" class="tpl" :class="{ archived: tpl.archived }">
        <div class="tpl__head">
          <strong>{{ tpl.display_name }}</strong>
          <Tag severity="secondary" :value="t('academy.evaluations.version', { n: tpl.version })" />
          <Tag v-if="tpl.archived" severity="secondary" :value="t('status.Archived')" />
          <span class="spacer" />
          <Button
            v-if="canUpdate && !tpl.archived"
            icon="pi pi-pencil"
            size="small"
            variant="text"
            :aria-label="t('common.edit')"
            @click="open(tpl)"
          />
          <Button
            v-if="canUpdate"
            :icon="tpl.archived ? 'pi pi-replay' : 'pi pi-inbox'"
            size="small"
            variant="text"
            severity="secondary"
            :aria-label="tpl.archived ? t('academy.restore') : t('academy.archive')"
            @click="archive(tpl)"
          />
        </div>
        <div v-for="section in tpl.sections" :key="section.key" class="section">
          <span class="muted">{{ pick(section.name) }}:</span>
          <span v-for="c in section.criteria" :key="c.key" class="crit">
            {{ pick(c.name) }}
            <small class="muted"
              >({{
                c.scale === 'measure'
                  ? c.unit || t('academy.evaluations.scales.measure')
                  : t(`academy.evaluations.scales.${c.scale}`)
              }})</small
            >
          </span>
        </div>
      </li>
    </ul>
    <TemplateFormDrawer
      v-model:visible="formOpen"
      :program-id="programId"
      :template="editing"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
}
.head h2 {
  margin: 0;
  font-size: 1rem;
}
.head p {
  margin: 2px 0 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 16px 8px;
}
.tpl {
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tpl.archived {
  opacity: 0.6;
}
.tpl__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.875rem;
}
.spacer {
  flex: 1;
}
.muted {
  color: var(--text-secondary);
}
</style>
