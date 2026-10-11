<script setup lang="ts">
// Card that holds SettingRows (OrgSettings.jsx `card`); optional group headings go in `SettingsGroup`.
</script>

<template>
  <div class="settings-card"><slot /></div>
</template>

<style scoped>
.settings-card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 4px 24px 8px;
}
.settings-card > :deep(.setting-row:first-child) {
  border-top: 0;
}
.settings-card :deep(.settings-group) {
  font: var(--text-h4);
  padding: 16px 0 4px;
}
.settings-card :deep(.settings-group + .setting-row) {
  border-top: 0;
}
.settings-card :deep(.setting-row + .settings-group) {
  border-top: 1px solid var(--border-default);
  margin-top: 8px;
}
@media (max-width: 767px) {
  .settings-card {
    padding: 4px 16px 8px;
  }
}
</style>
