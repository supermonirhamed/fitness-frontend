<script setup lang="ts">
// Port of the design system's CapacityIndicator (patterns/CapacityIndicator.jsx, US-03.15):
// "12 / 15" with a bar — available, almost full (≥80%), full, waitlist count, cancelled.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    booked: number
    capacity: number | null
    waitlist?: number
    cancelled?: boolean
    size?: 'sm' | 'md'
    bar?: boolean
  }>(),
  { waitlist: 0, size: 'md', bar: true },
)
const { t } = useI18n()
const ratio = computed(() => (props.capacity ? props.booked / props.capacity : 0))
const full = computed(() => !!props.capacity && props.booked >= props.capacity)
const state = computed(() =>
  props.cancelled ? 'cancelled' : full.value ? 'full' : ratio.value >= 0.8 ? 'almost' : 'available',
)
</script>

<template>
  <span :class="['cap', `cap--${size}`, { 'cap--cancelled': cancelled }]">
    <span class="cap__line">
      <span dir="ltr" class="num">{{ booked }} / {{ capacity ?? '∞' }}</span>
      <span v-if="full && !cancelled" class="cap__full">{{ t('calendar.full') }}</span>
      <span v-if="waitlist > 0 && !cancelled" class="cap__wait" :title="t('calendar.waitlist')"
        >+{{ waitlist }}</span
      >
    </span>
    <span v-if="bar && capacity" class="cap__track"
      ><span
        class="cap__fill"
        :style="{ width: `${Math.min(100, ratio * 100)}%`, background: `var(--cap-${state})` }"
    /></span>
  </span>
</template>

<style scoped>
.cap {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  min-width: 84px;
}
.cap--sm {
  min-width: 56px;
}
.cap__line {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 600 13px/1 var(--font-sans);
  color: var(--text-primary);
}
.cap--sm .cap__line {
  font-size: 12px;
}
.cap--cancelled .cap__line {
  color: var(--text-muted);
  text-decoration: line-through;
}
.cap__full {
  font: 600 11px/1 var(--font-sans);
  color: var(--sev-danger-fg);
}
.cap__wait {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
  font: 600 11px/1 var(--font-sans);
}
.cap__track {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: var(--cap-track);
  overflow: hidden;
}
.cap--sm .cap__track {
  height: 4px;
}
.cap__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
}
</style>
