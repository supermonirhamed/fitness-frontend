<script setup lang="ts">
// Coach notes, newest first (US-10.17): category, who sees it, the player (in a group list), the
// training, the author and when; editable by its author for a day, then by academy admins; open
// injury notes can be resolved.
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { AcademyNote } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

defineProps<{ notes: AcademyNote[]; showPlayer?: boolean; canResolve?: boolean }>()
const emit = defineEmits<{ edit: [note: AcademyNote]; resolve: [note: AcademyNote] }>()
const { t } = useI18n()
const format = useFormat()
const severity = (c: string) =>
  ({ injury: 'danger', behaviour: 'warn', technical: 'info', fitness: 'success' })[c] ?? 'secondary'
</script>

<template>
  <ul class="notes">
    <li v-for="n in notes" :key="n.id" class="note">
      <div class="note__head">
        <Tag
          :severity="severity(n.category)"
          :value="t(`academy.notes.categories.${n.category}`)"
        />
        <Tag
          v-if="n.visibility === 'shared'"
          severity="secondary"
          icon="pi pi-users"
          :value="t('academy.notes.shared')"
        />
        <Tag
          v-if="n.category === 'injury' && !n.resolved_at"
          severity="danger"
          :value="t('academy.notes.open')"
        />
        <Tag v-else-if="n.resolved_at" severity="secondary" :value="t('academy.notes.resolved')" />
        <strong v-if="showPlayer && n.client.name">{{ n.client.name }}</strong>
        <span class="muted small">
          {{ n.author?.name }} · {{ n.created_at ? format.dateTime(n.created_at) : '' }}
          <template v-if="n.group"> · {{ n.group.display_name }}</template>
          <template v-if="n.session">
            ·
            {{
              t('academy.notes.trainingOf', { date: format.date(n.session.starts_at) })
            }}</template
          >
        </span>
        <span class="spacer" />
        <Button
          v-if="canResolve && n.category === 'injury' && !n.resolved_at"
          :label="t('academy.notes.resolve')"
          size="small"
          variant="text"
          @click="emit('resolve', n)"
        />
        <Button
          v-if="n.can_edit"
          icon="pi pi-pencil"
          size="small"
          variant="text"
          severity="secondary"
          :aria-label="t('common.edit')"
          @click="emit('edit', n)"
        />
      </div>
      <p class="note__body">{{ n.body }}</p>
    </li>
  </ul>
</template>

<style scoped>
.notes {
  list-style: none;
  margin: 0;
  padding: 0;
}
.note {
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
}
.note:first-child {
  border-top: 0;
}
.note__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.note__body {
  margin: 6px 0 0;
  white-space: pre-line;
}
.spacer {
  flex: 1;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
