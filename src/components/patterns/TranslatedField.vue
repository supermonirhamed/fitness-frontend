<script setup lang="ts">
// A text in Arabic and English side by side (catalog names and descriptions, EP-02). At least
// one is needed when required; the API falls back to the other language for display.
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import type { Translated } from '@/api/tenant'

defineProps<{
  id: string
  label: string
  required?: boolean
  multiline?: boolean
  maxlength: number
  errors?: { ar?: string; en?: string; any?: string }
  disabled?: boolean
}>()
const model = defineModel<Translated>({ required: true })
const { t } = useI18n()
</script>

<template>
  <fieldset class="translated">
    <legend class="label">{{ label }}{{ required ? ' *' : '' }}</legend>
    <div v-for="lang in ['ar', 'en'] as const" :key="lang" class="lang">
      <label :for="`${id}-${lang}`" class="lang-label">{{ t(`translated.${lang}`) }}</label>
      <component
        :is="multiline ? Textarea : InputText"
        :id="`${id}-${lang}`"
        v-model="model[lang]"
        :dir="lang === 'ar' ? 'rtl' : 'ltr'"
        :lang="lang"
        :maxlength="maxlength"
        :rows="multiline ? 3 : undefined"
        :auto-resize="multiline || undefined"
        :invalid="!!(errors?.[lang] || errors?.any)"
        :disabled="disabled"
        fluid
      />
    </div>
    <small :class="errors?.ar || errors?.en || errors?.any ? 'error' : 'hint'">{{
      errors?.ar ??
      errors?.en ??
      errors?.any ??
      (required ? t('translated.oneRequired') : t('translated.optional'))
    }}</small>
  </fieldset>
</template>

<style scoped>
.translated {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
  margin-bottom: var(--space-1);
}
.lang {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: var(--space-2);
  align-items: start;
}
.lang-label {
  font: var(--text-caption);
  color: var(--text-muted);
  padding-top: 10px;
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
