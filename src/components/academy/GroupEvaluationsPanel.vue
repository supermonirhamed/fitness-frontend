<script setup lang="ts">
// Evaluating a group's players (US-10.19): choose the template and the period (mid-term, end of
// term or a label of your own), then each player — not started, draft or published — opens their
// evaluation. Published ones can be printed for the family.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import EvaluationFormDrawer from '@/components/academy/EvaluationFormDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyGroupDetails,
  type EvaluationSheet,
  type EvaluationTemplate,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ group: AcademyGroupDetails }>()
const { t, te } = useI18n()
const format = useFormat()

const templates = ref<EvaluationTemplate[]>([])
const templateId = ref<number | null>(null)
const period = ref('mid_term')
const custom = ref('')
const sheet = ref<EvaluationSheet | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const periodLabel = (p: string) =>
  te(`academy.evaluations.periods.${p}`) ? t(`academy.evaluations.periods.${p}`) : p
const periodOptions = computed(() => [
  ...[...new Set(['mid_term', 'end_term', ...(sheet.value?.periods ?? [])])].map((p) => ({
    value: p,
    label: periodLabel(p),
  })),
  { value: '__custom', label: t('academy.evaluations.otherPeriod') },
])
const effectivePeriod = computed(() =>
  period.value === '__custom' ? custom.value.trim() : period.value,
)

onMounted(async () => {
  templates.value = (
    await tenantApi.academy.evaluations.templates(props.group.program_id).catch(() => [])
  ).filter((x) => !x.archived)
  templateId.value = templates.value[0]?.id ?? null
})
async function load() {
  if (!templateId.value || !effectivePeriod.value) return
  state.value = 'loading'
  try {
    sheet.value = await tenantApi.academy.evaluations.sheet(
      props.group.id,
      templateId.value,
      effectivePeriod.value,
    )
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch([templateId, period], () => {
  if (period.value !== '__custom') load()
})

const open = ref(false)
const player = ref<EvaluationSheet['players'][number] | null>(null)
function edit(p: EvaluationSheet['players'][number]) {
  player.value = p
  open.value = true
}
</script>

<template>
  <div class="card">
    <EmptyState
      v-if="!templates.length"
      compact
      icon="pi-chart-bar"
      :title="t('academy.evaluations.noTemplates')"
      :body="t('academy.evaluations.noTemplatesGroupHint')"
    />
    <template v-else>
      <header class="head">
        <Select
          v-model="templateId"
          :options="templates"
          option-label="display_name"
          option-value="id"
          :aria-label="t('academy.evaluations.template')"
        />
        <Select
          v-model="period"
          :options="periodOptions"
          option-label="label"
          option-value="value"
          :aria-label="t('academy.evaluations.period')"
        />
        <template v-if="period === '__custom'">
          <InputText
            v-model="custom"
            maxlength="60"
            :placeholder="t('academy.evaluations.periodName')"
            :aria-label="t('academy.evaluations.periodName')"
          />
          <Button
            :label="t('academy.evaluations.open')"
            size="small"
            :disabled="!custom.trim()"
            @click="load"
          />
        </template>
      </header>
      <ErrorState v-if="state === 'error'" compact @retry="load" />
      <EmptyState
        v-else-if="state === 'ready' && sheet && !sheet.players.length"
        compact
        icon="pi-users"
        :title="t('academy.groups.noPlayers')"
      />
      <ul v-else-if="sheet" class="list">
        <li v-for="p in sheet.players" :key="p.client.id" class="item">
          <button type="button" class="name" @click="edit(p)">{{ p.client.name }}</button>
          <span class="muted small">
            <template v-if="p.evaluation">
              {{ p.evaluation.author }} ·
              {{ p.evaluation.updated_at ? format.date(p.evaluation.updated_at) : '' }}
            </template>
            <template v-else>{{ t('academy.evaluations.notStarted') }}</template>
          </span>
          <StatusTag v-if="p.evaluation" :status="p.evaluation.status" size="sm" />
          <RouterLink
            v-if="p.evaluation?.status === 'Published'"
            :to="{ name: 'tenant.academy.evaluation.print', params: { id: p.evaluation.id } }"
            target="_blank"
            class="small"
            >{{ t('academy.evaluations.print') }}</RouterLink
          >
        </li>
      </ul>
    </template>
    <EvaluationFormDrawer
      v-if="sheet && templateId"
      v-model:visible="open"
      :group-id="group.id"
      :program-id="group.program_id"
      :template-id="templateId"
      :period="effectivePeriod"
      :player="player"
      :sections="sheet.template.sections"
      :readonly="!sheet.can_edit"
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
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 16px 8px;
}
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
}
.name {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--primary-700);
  cursor: pointer;
  flex: 1;
  text-align: start;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
