<script setup lang="ts">
// Swatches plus any colour (US-02.01/02). `allowNone` adds "Use the category's colour".
import { useI18n } from 'vue-i18n'
import { COLOR_SWATCHES } from '@/lib/catalog'

defineProps<{ id: string; allowNone?: boolean; disabled?: boolean }>()
const model = defineModel<string | null>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div class="colors" role="radiogroup" :aria-labelledby="`${id}-label`">
    <button
      v-if="allowNone"
      type="button"
      role="radio"
      class="swatch none"
      :aria-checked="model === null"
      :aria-label="t('catalog.categoryColor')"
      :disabled="disabled"
      @click="model = null"
    >
      <i class="pi pi-ban" aria-hidden="true" />
    </button>
    <button
      v-for="c in COLOR_SWATCHES"
      :key="c"
      type="button"
      role="radio"
      class="swatch"
      :style="{ background: c }"
      :aria-checked="model === c"
      :aria-label="c"
      :disabled="disabled"
      @click="model = c"
    >
      <i v-if="model === c" class="pi pi-check" aria-hidden="true" />
    </button>
    <label class="custom" :title="t('catalog.customColor')">
      <input
        type="color"
        :value="model ?? '#7c3aed'"
        :aria-label="t('catalog.customColor')"
        :disabled="disabled"
        @input="model = ($event.target as HTMLInputElement).value"
      />
    </label>
  </div>
</template>

<style scoped>
/* Design (ServiceWizard.jsx "Colour"): small rounded squares in one row, as tall as an input; the
   picked one gets a ring. Padding keeps the ring from being clipped. */
.colors {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  min-height: var(--control-h);
  padding: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.swatch {
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: box-shadow var(--dur-fast) var(--ease-standard);
}
.swatch i {
  font-size: inherit;
}
.swatch:not(:disabled):hover {
  box-shadow:
    0 0 0 2px var(--surface-card),
    0 0 0 3px var(--border-strong);
}
.swatch[aria-checked='true'],
.swatch[aria-checked='true']:hover {
  box-shadow:
    0 0 0 2px var(--surface-card),
    0 0 0 4px var(--text-primary);
}
.swatch:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.swatch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.swatch.none {
  background: var(--surface-sunken);
  color: var(--text-muted);
  border: 1px dashed var(--border-strong);
}
.custom {
  flex: none;
  display: flex;
}
.custom input {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.custom input::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.custom input::-webkit-color-swatch {
  border: 0;
  border-radius: 4px;
}
.custom input::-moz-color-swatch {
  border: 0;
  border-radius: 4px;
}
</style>
