<script setup lang="ts">
// Port of the design system's PageHeader pattern: title + status + meta on the start side, actions on the end.
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <div class="page-header__title-row">
        <h1>{{ title }}</h1>
        <slot name="status" />
      </div>
      <p v-if="subtitle" class="page-header__meta">{{ subtitle }}</p>
    </div>
    <div class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.page-header__text {
  flex: 1;
  min-width: 240px;
}
.page-header__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font: var(--text-h1);
  color: var(--text-primary);
}
.page-header__meta {
  margin: 6px 0 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.page-header__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
