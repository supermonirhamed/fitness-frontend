<script setup lang="ts">
// Port of the design system's Field (forms/Field.jsx): label (+ required mark), the control, then an
// error or a help line.
defineProps<{
  label?: string
  for?: string
  required?: boolean
  help?: string
  error?: string | null
}>()
</script>

<template>
  <div class="field">
    <label v-if="label" :for="$props.for" class="field__label"
      >{{ label }}<span v-if="required" class="field__required" aria-hidden="true">*</span></label
    >
    <slot />
    <div v-if="error" class="field__error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />{{ error }}
    </div>
    <div v-else-if="help" class="field__help">{{ help }}</div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field__label {
  font: var(--text-small);
  font-weight: 500;
  color: var(--text-primary);
}
.field__required {
  color: var(--sev-danger-fg);
  margin-inline-start: 2px;
}
.field__error {
  display: flex;
  gap: 6px;
  align-items: center;
  font: var(--text-caption);
  font-weight: 400;
  color: var(--sev-danger-fg);
}
.field__error i {
  font-size: 12px;
}
.field__help {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
</style>
