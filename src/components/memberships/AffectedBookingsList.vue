<script setup lang="ts">
// Upcoming bookings a membership change affects (US-06.11–14): session, date and time, branch, and
// the family member when it isn't the holder.
import { useFormat } from '@/composables/useFormat'
import type { AffectedBooking } from '@/api/tenant'

defineProps<{ bookings: AffectedBooking[]; title: string }>()
const format = useFormat()
</script>

<template>
  <div class="affected">
    <span class="affected__title">{{ title }}</span>
    <ul>
      <li v-for="b in bookings" :key="b.id">
        <i class="pi pi-calendar" aria-hidden="true" />
        <span class="affected__what">{{ b.session }}</span>
        <span class="muted"
          >{{ format.dateTime(b.starts_at)
          }}<template v-if="b.location"> · {{ b.location }}</template
          ><template v-if="b.client"> · {{ b.client }}</template></span
        >
      </li>
    </ul>
  </div>
</template>

<style scoped>
.affected {
  border: 1px solid var(--sev-warn-border, var(--border-default));
  background: var(--sev-warn-bg);
  border-radius: var(--radius-card);
  padding: 10px 12px;
}
.affected__title {
  font: 600 13px var(--font-sans);
  color: var(--sev-warn-fg);
}
ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  font: var(--text-small);
}
.affected__what {
  font-weight: 500;
}
.muted {
  color: var(--text-muted);
}
</style>
