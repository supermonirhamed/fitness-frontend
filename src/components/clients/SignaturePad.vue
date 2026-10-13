<script setup lang="ts">
// A drawn signature (US-05.07): pointer strokes on a canvas, exported as a PNG data URL. Empty
// until something is drawn; "Clear" starts again.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

const model = defineModel<string | null>({ default: null })
const { t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)
let drawing = false

function context() {
  const ctx = canvas.value?.getContext('2d')
  if (ctx) {
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
  }
  return ctx
}
function point(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const scale = canvas.value!.width / rect.width
  return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
}
function start(e: PointerEvent) {
  const ctx = context()
  if (!ctx) return
  drawing = true
  canvas.value!.setPointerCapture(e.pointerId)
  const p = point(e)
  ctx.beginPath()
  ctx.moveTo(p.x, p.y)
}
function move(e: PointerEvent) {
  if (!drawing) return
  const ctx = context()
  if (!ctx) return
  const p = point(e)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
}
function end() {
  if (!drawing) return
  drawing = false
  model.value = canvas.value?.toDataURL('image/png') ?? null
}
function clear() {
  const ctx = context()
  if (ctx && canvas.value) ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  model.value = null
}
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = 900
    canvas.value.height = 260
  }
})
</script>

<template>
  <div class="pad">
    <canvas
      ref="canvas"
      class="pad__canvas"
      :aria-label="t('waiverSign.drawHere')"
      role="img"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointerleave="end"
    />
    <div class="pad__bar">
      <small class="muted">{{ t('waiverSign.drawHere') }}</small>
      <Button
        size="small"
        variant="text"
        icon="pi pi-eraser"
        :label="t('waiverSign.clear')"
        @click="clear"
      />
    </div>
  </div>
</template>

<style scoped>
.pad {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pad__canvas {
  width: 100%;
  aspect-ratio: 900 / 260;
  background: #fff;
  border: 2px dashed var(--border-strong, #999);
  border-radius: 8px;
  touch-action: none;
  cursor: crosshair;
}
.pad__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.muted {
  color: var(--text-muted);
}
</style>
