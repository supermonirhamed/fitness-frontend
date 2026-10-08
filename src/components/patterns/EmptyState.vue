<script setup lang="ts">
defineProps<{ icon: string; title: string; body?: string }>()
</script>

<template>
  <div class="empty-state" role="status">
    <i :class="['pi', icon]" aria-hidden="true" />
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="body" class="empty-state__body">{{ body }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}
.empty-state i {
  font-size: 24px;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}
.empty-state__title {
  margin: 0;
  font: var(--text-h3);
  color: var(--text-primary);
}
.empty-state__body {
  margin: 0 0 var(--space-2);
  font: var(--text-small);
  max-width: 360px;
}
</style>
