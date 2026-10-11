<script setup lang="ts">
// Timezone as in the design: a small "AST" badge, optionally followed by the zone name.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { zoneAbbreviation } from '@/lib/datetime'

const props = defineProps<{ timezone: string; withName?: boolean; icon?: boolean }>()
const { locale } = useI18n()
const abbr = computed(() => zoneAbbreviation(props.timezone, locale.value))
</script>

<template>
  <span class="zone" dir="ltr">
    <span class="zone__badge"
      ><i v-if="icon" class="pi pi-clock" aria-hidden="true" />{{ abbr
      }}<template v-if="withName && icon"> · {{ timezone }}</template></span
    >
    <span v-if="withName && !icon" class="zone__name">{{ timezone }}</span>
  </span>
</template>

<style scoped>
.zone {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}
.zone__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 600 10px/18px var(--font-sans);
  padding: 0 5px;
  border-radius: 4px;
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.zone__badge i {
  font-size: 10px;
}
.zone__name {
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
