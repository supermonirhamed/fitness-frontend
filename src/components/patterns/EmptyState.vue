<script setup lang="ts">
// Port of the design system's EmptyState (patterns/EmptyState.jsx): icon in a sunken circle,
// title, one-line explanation, then the action in the default slot.
defineProps<{ icon: string; title: string; body?: string; compact?: boolean }>()
</script>

<template>
  <div :class="['empty-state', { 'empty-state--compact': compact }]" role="status">
    <span class="empty-state__icon" aria-hidden="true"><i :class="['pi', icon]" /></span>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="body" class="empty-state__body">{{ body }}</p>
    <div v-if="$slots.default" class="empty-state__action"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
}
.empty-state--compact {
  padding: 24px 16px;
}
.empty-state__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-sunken);
  color: var(--text-muted);
  font-size: 24px;
}
.empty-state__icon i {
  font-size: inherit;
}
.empty-state--compact .empty-state__icon {
  width: 40px;
  height: 40px;
  font-size: 18px;
}
.empty-state__title {
  margin: 0;
  font: var(--text-h3);
  color: var(--text-primary);
}
.empty-state__body {
  margin: 0;
  max-width: 360px;
  font: var(--text-body);
  color: var(--text-secondary);
  text-wrap: pretty;
}
.empty-state__action {
  display: flex;
  gap: var(--space-2);
  margin-top: 6px;
}
</style>
