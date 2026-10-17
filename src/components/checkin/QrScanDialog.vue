<script setup lang="ts">
// Scans a client's QR code with the device camera (US-08.01), where the browser can read barcodes
// (BarcodeDetector). USB scanners need nothing: they type the code into the search box.
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ scanned: [code: string] }>()
const { t } = useI18n()

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
const video = ref<HTMLVideoElement | null>(null)
const error = ref<string | null>(null)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | undefined

async function start() {
  error.value = null
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: object) => Detector })
    .BarcodeDetector
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
    error.value = t('checkIn.scanUnsupported')
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (!video.value) return
    video.value.srcObject = stream
    await video.value.play()
    const detector = new Ctor({ formats: ['qr_code', 'code_128', 'ean_13'] })
    timer = setInterval(async () => {
      if (!video.value) return
      const codes = await detector.detect(video.value).catch(() => [])
      if (codes[0]?.rawValue) {
        emit('scanned', codes[0].rawValue)
        visible.value = false
      }
    }, 300)
  } catch {
    error.value = t('checkIn.cameraDenied')
  }
}
function stop() {
  clearInterval(timer)
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}
watch(visible, (open) => (open ? setTimeout(start) : stop()))
onBeforeUnmount(stop)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('checkIn.scanTitle')"
    :style="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <Message v-if="error" severity="warn" :closable="false">{{ error }}</Message>
    <video v-else ref="video" class="video" muted playsinline />
    <p class="hint">{{ t('checkIn.scanHint') }}</p>
  </Dialog>
</template>

<style scoped>
.video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
.hint {
  margin: 8px 0 0;
  font: var(--text-small);
  color: var(--text-muted);
}
</style>
