<script setup lang="ts">
// Port of the design system's BulkActionBar (patterns/BulkActionBar.jsx): dark floating bar shown
// while rows are selected — "N selected · Clear" on the start side, actions on the end.
import { useI18n } from 'vue-i18n'

defineProps<{ label: string }>()
const emit = defineEmits<{ clear: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="bulk-bar" role="toolbar" :aria-label="t('catalog.bulk.label')">
    <span class="bulk-bar__count">{{ label }}</span>
    <button type="button" class="bulk-bar__clear" @click="emit('clear')">
      {{ t('catalog.bulk.clear') }}
    </button>
    <span class="bulk-bar__spacer" />
    <div class="bulk-bar__actions"><slot /></div>
  </div>
</template>

<style scoped>
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px;
  padding-inline-start: 16px;
  border-radius: var(--radius-card);
  background: var(--surface-inverse);
  color: var(--text-inverse);
  box-shadow: var(--shadow-2);
}
.bulk-bar__count {
  font: 600 14px var(--font-sans);
  font-variant-numeric: tabular-nums;
}
.bulk-bar__clear {
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font: 500 13px var(--font-sans);
  text-decoration: underline;
  cursor: pointer;
}
.bulk-bar__spacer {
  flex: 1;
}
.bulk-bar__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
/* Actions are "contrast" buttons on the dark bar. */
.bulk-bar__actions :deep(.p-button) {
  background: var(--surface-0);
  border-color: transparent;
  color: var(--surface-900);
}
.bulk-bar__actions :deep(.p-button:not(:disabled):hover) {
  background: var(--surface-200);
  color: var(--surface-900);
}
</style>
