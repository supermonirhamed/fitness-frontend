<script setup lang="ts">
// Port of the design system's FilterBar (patterns/FilterBar.jsx): search with icon, quick filters,
// then anything pushed to the end; below, a chip for each active filter with "Clear all".
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

export interface FilterChip {
  key: string
  label: string
}

defineProps<{ placeholder?: string; chips?: FilterChip[] }>()
const emit = defineEmits<{ remove: [key: string]; clear: [] }>()
const search = defineModel<string>('search', { default: '' })
const { t } = useI18n()
</script>

<template>
  <div class="filter-bar-wrap">
    <div class="filter-bar">
      <IconField class="filter-bar__search">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="search"
          type="search"
          :placeholder="placeholder"
          :aria-label="placeholder"
          fluid
        />
      </IconField>
      <slot />
      <span class="filter-bar__spacer" />
      <slot name="end" />
    </div>
    <div v-if="chips?.length" class="filter-bar__chips">
      <span v-for="c in chips" :key="c.key" class="filter-chip"
        >{{ c.label
        }}<button
          type="button"
          class="filter-chip__remove"
          :aria-label="t('filters.remove', { name: c.label })"
          @click="emit('remove', c.key)"
        >
          <i class="pi pi-times" aria-hidden="true" /></button
      ></span>
      <Button
        :label="t('filters.clearAll')"
        size="small"
        variant="text"
        severity="secondary"
        @click="emit('clear')"
      />
    </div>
  </div>
</template>

<style scoped>
.filter-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filter-bar__chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding-inline: 10px 6px;
  border-radius: 999px;
  background: var(--primary-subtle, var(--primary-50));
  color: var(--primary-subtle-text, var(--primary-700));
  font: 500 12px/1 var(--font-sans);
}
.filter-chip__remove {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.filter-chip__remove:hover {
  background: rgb(0 0 0 / 0.08);
}
.filter-chip__remove i {
  font-size: 9px;
}
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.filter-bar__search {
  width: 280px;
  max-width: 100%;
}
.filter-bar__spacer {
  flex: 1;
}
</style>
