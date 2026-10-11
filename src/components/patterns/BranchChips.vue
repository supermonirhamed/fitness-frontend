<script setup lang="ts">
// Branch names as small tags, the rest folded into "+N" (design: ServicesScreen.jsx BranchChips).
import { computed } from 'vue'
import Tag from 'primevue/tag'

const props = withDefaults(defineProps<{ names: string[]; max?: number }>(), { max: 2 })
const shown = computed(() => props.names.slice(0, props.max))
const rest = computed(() => props.names.slice(props.max))
</script>

<template>
  <span v-if="!names.length" class="none">—</span>
  <span v-else class="chips">
    <Tag v-for="name in shown" :key="name" class="tag-sm" :value="name" />
    <Tag
      v-if="rest.length"
      v-tooltip.top="rest.join('، ')"
      class="tag-sm"
      severity="info"
      :value="`+${rest.length}`"
    />
  </span>
</template>

<style scoped>
.chips {
  display: inline-flex;
  gap: 4px;
  flex-wrap: nowrap;
}
.none {
  color: var(--text-muted);
}
</style>
