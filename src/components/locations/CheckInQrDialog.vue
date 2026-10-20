<script setup lang="ts">
// The branch's check-in QR (US-11.23): printed at the entrance, clients scan it with the app to
// check themselves in to their booking. Replacing it makes the printed one stop working.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { tenantApi } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ locationId: number; locationName: string; canEdit: boolean }>()
const { t } = useI18n()
const toast = useToast()
const qr = ref<{ url: string; svg: string } | null>(null)
const failed = ref(false)
const busy = ref(false)
const confirming = ref(false)

watch(visible, async (open) => {
  if (!open) return
  qr.value = null
  failed.value = false
  confirming.value = false
  try {
    qr.value = await tenantApi.checkInQr(props.locationId)
  } catch {
    failed.value = true
  }
})

async function rotate() {
  busy.value = true
  try {
    qr.value = await tenantApi.rotateCheckInQr(props.locationId)
    confirming.value = false
    toast.add({ severity: 'success', summary: t('checkInQr.rotated'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

/** A clean page with the code and the branch's name, to print and put up. */
function print() {
  if (!qr.value) return
  const w = window.open('', '_blank', 'noopener=no')
  if (!w) return
  const doc = w.document
  doc.title = props.locationName
  const style = doc.createElement('style')
  style.textContent =
    'body{font-family:system-ui,sans-serif;text-align:center;padding:48px}svg{width:420px;height:420px}h1{margin:0 0 8px}p{color:#555}'
  doc.head.appendChild(style)
  const h1 = doc.createElement('h1')
  h1.textContent = props.locationName
  const p = doc.createElement('p')
  p.textContent = t('checkInQr.poster')
  const box = doc.createElement('div')
  box.innerHTML = qr.value.svg
  doc.body.append(h1, p, box)
  w.setTimeout(() => w.print(), 100)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('checkInQr.title')"
    :style="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="body">
      <p class="hint">{{ t('checkInQr.hint') }}</p>
      <Message v-if="failed" severity="error" :closable="false">{{
        t('common.genericError')
      }}</Message>
      <Skeleton v-else-if="!qr" width="280px" height="280px" />
      <!-- eslint-disable-next-line vue/no-v-html -- an SVG the API drew from the link -->
      <div v-else class="code" v-html="qr.svg" />
      <code v-if="qr" class="url" dir="ltr">{{ qr.url }}</code>
      <Message v-if="confirming" severity="warn" :closable="false">{{
        t('checkInQr.rotateWarning')
      }}</Message>
    </div>
    <template #footer>
      <template v-if="confirming">
        <Button
          :label="t('common.cancel')"
          variant="text"
          severity="secondary"
          @click="confirming = false"
        />
        <Button :label="t('checkInQr.rotate')" severity="warn" :loading="busy" @click="rotate" />
      </template>
      <template v-else>
        <Button
          v-if="canEdit"
          :label="t('checkInQr.rotate')"
          icon="pi pi-refresh"
          variant="text"
          severity="secondary"
          :disabled="!qr"
          @click="confirming = true"
        />
        <Button :label="t('checkInQr.print')" icon="pi pi-print" :disabled="!qr" @click="print" />
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.hint {
  margin: 0;
  color: var(--text-muted);
  font: var(--text-small);
}
.code {
  width: 280px;
  height: 280px;
}
.code :deep(svg) {
  width: 100%;
  height: 100%;
}
.url {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}
</style>
