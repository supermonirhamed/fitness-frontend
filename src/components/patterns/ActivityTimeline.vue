<script setup lang="ts">
// A record's Activity tab (design: data/Timeline.jsx): audit entries newest first, as a timeline.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import { tenantApi, type AuditEntry } from '@/api/tenant'
import { actionKey, fieldChanges } from '@/lib/audit'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ entityType: string; entityId: number }>()
const { t, te } = useI18n()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const entries = ref<AuditEntry[]>([])
async function load() {
  state.value = 'loading'
  try {
    entries.value = (
      await tenantApi.auditLogs({ entity_type: props.entityType, entity_id: props.entityId }, 1)
    ).data
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const label = (action: string) =>
  te(`audit.actions.${actionKey(action)}`) ? t(`audit.actions.${actionKey(action)}`) : action
// Edits list what changed; a creation just says so.
const changed = (entry: AuditEntry) =>
  entry.old_values === null
    ? ''
    : fieldChanges(entry.old_values, entry.new_values)
        .map((c) => c.field)
        .filter((f) => f !== 'bulk')
        .join('، ')
const tone = (action: string) =>
  /creat/.test(action)
    ? 'info'
    : /activat|publish|restor/.test(action) && !/deactivat/.test(action)
      ? 'success'
      : /deactivat|archiv|delet|cancel/.test(action)
        ? 'warn'
        : 'secondary'
</script>

<template>
  <div v-if="state === 'loading'" class="panel pad">
    <Skeleton v-for="n in 3" :key="n" height="36px" />
  </div>
  <ErrorState v-else-if="state === 'error'" class="panel" compact @retry="load" />
  <EmptyState
    v-else-if="!entries.length"
    class="panel"
    compact
    icon="pi-history"
    :title="t('details.noActivity')"
  />
  <ol v-else class="panel timeline">
    <li v-for="entry in entries" :key="entry.id">
      <span :class="['dot', `dot--${tone(entry.action)}`]" aria-hidden="true" />
      <div>
        <div class="title">
          {{ label(entry.action) }}
          <small v-if="changed(entry)" class="muted">· {{ changed(entry) }}</small>
        </div>
        <div class="meta">
          {{ format.dateTime(entry.created_at) }} · {{ entry.actor?.name ?? t('details.system') }}
        </div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.timeline {
  margin: 0;
  padding: 20px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.timeline li {
  display: flex;
  gap: 12px;
  position: relative;
}
.timeline li:not(:last-child)::before {
  content: '';
  position: absolute;
  inset-inline-start: 4.5px;
  top: 18px;
  bottom: -16px;
  width: 1px;
  background: var(--border-default);
}
.dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  flex: none;
  background: var(--sev-secondary-solid);
}
.dot--info {
  background: var(--sev-info-solid);
}
.dot--success {
  background: var(--sev-success-solid);
}
.dot--warn {
  background: var(--sev-warn-solid);
}
.title {
  font: 500 14px/1.4 var(--font-sans);
}
.meta {
  font: var(--text-small);
  color: var(--text-secondary);
}
.muted {
  color: var(--text-muted);
}
</style>
