<script setup lang="ts">
// A small line chart of one criterion over a player's evaluations (US-10.19), drawn as SVG: the
// scale's range for ratings (1–5, 1–10, the three levels), the values' range for measurements;
// for times where lower is better, the line still reads upward as better.
import { computed } from 'vue'
import type { EvaluationHistory } from '@/api/tenant'

const props = defineProps<{ series: EvaluationHistory['progress'][number] }>()
const W = 240
const H = 80
const PAD = 10
const range = computed<[number, number]>(() => {
  if (props.series.scale === '1-5') return [1, 5]
  if (props.series.scale === '1-10') return [1, 10]
  if (props.series.scale === 'levels') return [1, 3]
  const values = props.series.points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? [min - 1, max + 1] : [min, max]
})
const points = computed(() => {
  const n = props.series.points.length
  const [lo, hi] = range.value
  return props.series.points.map((p, i) => {
    let share = (p.value - lo) / (hi - lo)
    if (props.series.lower_is_better) share = 1 - share
    return {
      x: n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1),
      y: H - PAD - share * (H - 2 * PAD),
      label: `${p.date}: ${p.raw}${props.series.unit ? ` ${props.series.unit}` : ''}`,
    }
  })
})
const path = computed(() =>
  points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
)
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${H}`"
    class="chart"
    role="img"
    :aria-label="series.name ?? ''"
    dir="ltr"
  >
    <line :x1="PAD" :x2="W - PAD" :y1="H - PAD" :y2="H - PAD" class="axis" />
    <path :d="path" class="line" />
    <circle v-for="(p, i) in points" :key="i" :cx="p.x" :cy="p.y" r="3.5" class="dot">
      <title>{{ p.label }}</title>
    </circle>
  </svg>
</template>

<style scoped>
.chart {
  width: 100%;
  max-width: 280px;
  height: auto;
}
.axis {
  stroke: var(--border-default);
}
.line {
  fill: none;
  stroke: var(--primary-600, #2563eb);
  stroke-width: 2;
}
.dot {
  fill: var(--primary-600, #2563eb);
}
</style>
