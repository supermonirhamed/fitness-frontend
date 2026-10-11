<script setup lang="ts">
// Port of the design system's ConflictList (patterns/ConflictList.jsx): hard conflicts in red,
// warnings in amber, each with who / when.
import type { SessionConflictItem } from '@/api/tenant'

defineProps<{ items: SessionConflictItem[] }>()
</script>

<template>
  <ul class="conflicts">
    <li v-for="(c, i) in items" :key="i" :class="['conflict', `conflict--${c.level}`]">
      <i
        :class="['pi', c.level === 'hard' ? 'pi-times-circle' : 'pi-exclamation-triangle']"
        aria-hidden="true"
      />
      <div class="conflict__text">
        <div class="conflict__title">{{ c.title }}</div>
        <div v-if="c.who || c.when" class="conflict__meta">
          <span v-if="c.who">{{ c.who }}</span>
          <template v-if="c.who && c.when"> · </template>
          <span v-if="c.when" dir="ltr" class="num">{{ c.when }}</span>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.conflicts {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.conflict {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--sev-danger-border);
  background: var(--sev-danger-bg);
}
.conflict--soft {
  border-color: var(--sev-warn-border);
  background: var(--sev-warn-bg);
}
.conflict i {
  margin-top: 3px;
  color: var(--sev-danger-fg);
}
.conflict--soft i {
  color: var(--sev-warn-fg);
}
.conflict__text {
  flex: 1;
  min-width: 0;
  font: var(--text-small);
}
.conflict__title {
  font-weight: 600;
  color: var(--text-primary);
}
.conflict__meta {
  color: var(--text-secondary);
}
</style>
