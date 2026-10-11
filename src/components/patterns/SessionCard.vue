<script setup lang="ts">
// Port of the design system's SessionCard (patterns/SessionCard.jsx): service colour stripe and
// tint, time, service, coach, capacity. Drafts get a dashed border, full sessions a red one,
// cancelled ones are struck through and grey, completed ones faded.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CapacityIndicator from './CapacityIndicator.vue'
import PersonAvatar from './PersonAvatar.vue'
import type { CalendarSession } from '@/api/tenant'

const props = withDefaults(
  defineProps<{
    session: CalendarSession
    variant?: 'full' | 'compact' | 'mini'
    selected?: boolean
    showCoach?: boolean
    showZone?: string | null
  }>(),
  { variant: 'full', showCoach: true, showZone: null },
)
const { t } = useI18n()
const color = computed(() => props.session.service.color ?? 'var(--svc-1)')
const draft = computed(() => props.session.status === 'Draft')
const cancelled = computed(() => props.session.status === 'Cancelled')
const completed = computed(() => props.session.status === 'Completed')
const full = computed(
  () =>
    !cancelled.value && !!props.session.capacity && props.session.booked >= props.session.capacity,
)
const coach = computed(() => props.session.coaches[0]?.name ?? null)
</script>

<template>
  <div
    :class="[
      'card',
      `card--${variant}`,
      {
        'card--draft': draft,
        'card--full': full,
        'card--cancelled': cancelled,
        'card--completed': completed,
        'card--selected': selected,
      },
    ]"
    :style="{ '--svc': color }"
  >
    <span class="card__stripe" aria-hidden="true" />
    <template v-if="variant === 'mini'">
      <span class="card__mini"
        ><b dir="ltr">{{ session.local.start }}</b> {{ session.service.name }}</span
      >
    </template>
    <template v-else>
      <div class="card__top">
        <span dir="ltr" class="card__time num"
          >{{ session.local.start }}–{{ session.local.end
          }}<span v-if="showZone" class="card__zone">{{ showZone }}</span></span
        >
        <span v-if="draft" class="card__draft">{{ t('status.Draft') }}</span>
      </div>
      <div class="card__title">{{ session.service.name }}</div>
      <div v-if="variant === 'full' && showCoach && coach" class="card__coach">
        <PersonAvatar :name="coach" size="xs" />
        <span>{{ coach }}</span>
      </div>
      <CapacityIndicator
        :booked="session.booked"
        :capacity="session.capacity"
        :waitlist="session.waitlist"
        :cancelled="cancelled"
        size="sm"
        :bar="variant === 'full'"
      />
    </template>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  min-width: 0;
  padding: 8px 10px;
  padding-inline-start: 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--svc) 30%, transparent);
  background: color-mix(in srgb, var(--svc) 10%, var(--surface-card));
  overflow: hidden;
  cursor: pointer;
}
.card--compact {
  gap: 2px;
  padding: 6px 8px;
  padding-inline-start: 10px;
}
.card--mini {
  height: auto;
  padding: 2px 6px;
  padding-inline-start: 8px;
  border-radius: 4px;
}
.card--draft {
  border-style: dashed;
  border-color: var(--border-strong);
}
.card--full {
  border-color: var(--sev-danger-solid);
}
.card--cancelled {
  background: var(--surface-sunken);
}
.card--completed {
  opacity: 0.6;
}
.card--selected {
  box-shadow: 0 0 0 2px var(--primary);
}
.card__stripe {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--svc);
}
.card--mini .card__stripe {
  width: 3px;
}
.card--cancelled .card__stripe {
  background: var(--surface-400);
}
.card__top {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: baseline;
}
.card__time {
  font: 600 12px/1.3 var(--font-sans);
  color: var(--text-secondary);
}
.card__zone {
  margin-inline-start: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--surface-sunken);
  font-size: 10px;
}
.card__draft {
  font: 600 10px/1 var(--font-sans);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: var(--ls-caps);
}
.card__title {
  flex: none;
  font: 600 14px/1.3 var(--font-sans);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card--compact .card__title {
  font-size: 13px;
}
.card__coach {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-secondary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.card__mini {
  font: 500 11px/1.4 var(--font-sans);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card__mini b {
  font-weight: 600;
}
.card--cancelled .card__time,
.card--cancelled .card__title,
.card--cancelled .card__mini {
  text-decoration: line-through;
}
</style>
