<script setup lang="ts">
// Sticky "Unsaved changes" bar from the design (OrgSettings.jsx): fixed to the bottom of the content
// area while a form has changes.
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

defineProps<{ saving?: boolean; saveDisabled?: boolean; saveLabel?: string }>()
const emit = defineEmits<{ discard: []; save: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="unsaved-bar" role="region" :aria-label="t('common.unsavedChanges')">
    <span class="unsaved-bar__text"
      ><i class="pi pi-circle-fill" aria-hidden="true" />{{ t('common.unsavedChanges') }}</span
    >
    <Button
      :label="t('common.discard')"
      variant="text"
      severity="secondary"
      :disabled="saving"
      @click="emit('discard')"
    />
    <Button
      :label="saveLabel ?? t('common.saveChanges')"
      :loading="saving"
      :disabled="saveDisabled"
      @click="emit('save')"
    />
  </div>
</template>

<style scoped>
.unsaved-bar {
  position: fixed;
  bottom: 0;
  inset-inline-start: var(--content-start, var(--sidebar-w));
  inset-inline-end: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--surface-card);
  border-top: 1px solid var(--border-default);
  box-shadow: var(--shadow-2);
}
.unsaved-bar__text {
  flex: 1;
  font: var(--text-small);
  color: var(--text-secondary);
}
.unsaved-bar__text i {
  font-size: 8px;
  color: var(--sev-warn-solid);
  margin-inline-end: 8px;
}
@media (max-width: 767px) {
  .unsaved-bar {
    inset-inline-start: 0;
    padding: 12px 16px;
  }
}
</style>
