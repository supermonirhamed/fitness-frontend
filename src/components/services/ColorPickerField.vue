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
.colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--surface-card);
  outline: 1px solid var(--border-default);
  display: grid;
  place-items: center;
  color: #fff;
  cursor: pointer;
  padding: 0;
}
.swatch[aria-checked='true'] {
  outline: 2px solid var(--text-primary);
}
.swatch.none {
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.custom input {
  width: 32px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
}
</style>
