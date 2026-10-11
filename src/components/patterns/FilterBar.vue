<script setup lang="ts">
// Port of the design system's FilterBar (patterns/FilterBar.jsx): search with icon, quick filters,
// then anything pushed to the end.
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

defineProps<{ placeholder?: string }>()
const search = defineModel<string>('search', { default: '' })
</script>

<template>
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
</template>

<style scoped>
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
