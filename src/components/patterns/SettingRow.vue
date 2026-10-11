<script setup lang="ts">
// The settings row from the design (ui_kits/admin/OrgSettings.jsx SettingRow): label, help and an
// optional example on the start side; the controls on the end side. Rows sit in a SettingsCard.
defineProps<{ label: string; help?: string; example?: string; labelFor?: string }>()
</script>

<template>
  <div class="setting-row">
    <div class="setting-row__text">
      <label v-if="labelFor" :for="labelFor" class="setting-row__label">{{ label }}</label>
      <div v-else class="setting-row__label">{{ label }}</div>
      <div v-if="help || $slots.help" class="setting-row__help">
        <slot name="help">{{ help }}</slot>
      </div>
      <div v-if="example" class="setting-row__example">
        <i class="pi pi-lightbulb" aria-hidden="true" />{{ example }}
      </div>
    </div>
    <div class="setting-row__control"><slot /></div>
  </div>
</template>

<style scoped>
.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--border-subtle);
  align-items: start;
}
.setting-row__label {
  font: 500 14px/1.4 var(--font-sans);
  color: var(--text-primary);
}
.setting-row__help {
  margin-top: 2px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.setting-row__example {
  margin-top: 4px;
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.setting-row__example i {
  font-size: 11px;
  margin-inline-end: 4px;
}
.setting-row__control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
@media (max-width: 767px) {
  .setting-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
