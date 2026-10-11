<script setup lang="ts">
// Port of the design system's ErrorState (patterns/ErrorState.jsx): message + retry.
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

defineProps<{ title?: string; message?: string; compact?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <div :class="['error-state', { 'error-state--compact': compact }]" role="alert">
    <span class="error-state__icon" aria-hidden="true"><i class="pi pi-exclamation-circle" /></span>
    <p class="error-state__title">{{ title ?? t('common.loadError') }}</p>
    <p class="error-state__body">{{ message ?? t('common.loadErrorHint') }}</p>
    <Button
      :label="t('common.retry')"
      icon="pi pi-refresh"
      severity="secondary"
      @click="emit('retry')"
    />
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
}
.error-state--compact {
  padding: 24px 16px;
}
.error-state__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
  font-size: 24px;
}
.error-state__icon i {
  font-size: inherit;
}
.error-state__title {
  margin: 0;
  font: var(--text-h3);
  color: var(--text-primary);
}
.error-state__body {
  margin: 0;
  font: var(--text-body);
  color: var(--text-secondary);
}
</style>
