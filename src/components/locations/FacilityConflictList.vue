<script setup lang="ts">
// What is in the way of a booking (US-01.10): name, facility, time and coach of each conflict.
import { useI18n } from 'vue-i18n'
import type { FacilityConflictItem } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

defineProps<{ conflicts: FacilityConflictItem[]; timezone: string }>()
const { t } = useI18n()
const format = useFormat()
</script>

<template>
  <ul class="conflicts" :aria-label="t('facilityConflict.label')">
    <li v-for="c in conflicts" :key="c.id">
      <i :class="['pi', c.kind === 'block' ? 'pi-ban' : 'pi-calendar']" aria-hidden="true" />
      <div>
        <div class="title">
          {{ c.title }}
          <span class="kind">{{ t(`facilityConflict.kinds.${c.kind}`) }}</span>
        </div>
        <div class="meta">
          {{ format.dateTime(c.starts_at, timezone) }} – {{ format.time(c.ends_at, timezone) }}
          <template v-if="c.facility"> · {{ c.facility }}</template>
          <template v-if="c.coach">
            · {{ t('facilityConflict.coach', { name: c.coach }) }}</template
          >
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.conflicts {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.conflicts li {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}
.conflicts li + li {
  border-top: 1px solid var(--border-subtle);
}
.conflicts .pi {
  margin-top: 3px;
  color: var(--sev-danger-fg);
}
.title {
  font-weight: var(--fw-medium);
}
.kind,
.meta {
  font: var(--text-caption);
  color: var(--text-muted);
}
.kind {
  margin-inline-start: var(--space-2);
  font-weight: normal;
}
</style>
