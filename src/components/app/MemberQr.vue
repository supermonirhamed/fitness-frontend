<script setup lang="ts">
// The client's check-in code (US-11.23): it changes every minute, so a screenshot soon stops
// working. The app keeps the next ten minutes of codes, so it still shows one offline for a while.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { clientApi, type CheckInCode } from '@/api/clientApp'
import { useClientApp } from '@/stores/clientApp'

defineProps<{ memberId?: string | null }>()
const { t } = useI18n()
const app = useClientApp()
const key = computed(() => `ca.qr.${app.account?.client?.id ?? 0}`)
const codes = ref<CheckInCode[]>([])
const now = ref(Date.now())
const loading = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function stored(): CheckInCode[] {
  try {
    return JSON.parse(localStorage.getItem(key.value) ?? '[]')
  } catch {
    return []
  }
}
function keep(list: CheckInCode[]) {
  codes.value = list
  try {
    localStorage.setItem(key.value, JSON.stringify(list))
  } catch {
    // Private mode: the codes still work for this visit.
  }
}
const left = computed(() => codes.value.filter((c) => Date.parse(c.valid_until) > now.value))
const current = computed(() =>
  left.value.find(
    (c) => Date.parse(c.valid_from) <= now.value && Date.parse(c.valid_until) > now.value,
  ),
)
const seconds = computed(() =>
  current.value
    ? Math.max(0, Math.ceil((Date.parse(current.value.valid_until) - now.value) / 1000))
    : 0,
)

async function refresh() {
  if (loading.value || !navigator.onLine) return
  loading.value = true
  try {
    keep(await clientApi.checkIn.codes())
  } catch {
    // Offline or signed out: keep what we have.
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  codes.value = stored()
  refresh()
  timer = setInterval(() => {
    now.value = Date.now()
    // Top up before the codes run out.
    if (left.value.length < 4) refresh()
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="member-qr">
    <!-- eslint-disable-next-line vue/no-v-html -- an SVG the API drew from the code -->
    <div
      v-if="current"
      class="code"
      role="img"
      :aria-label="t('app.qr.alt')"
      v-html="current.svg"
    />
    <div v-else class="code code--empty">
      <i class="pi pi-wifi" aria-hidden="true" />
    </div>
    <p v-if="current" class="ca-muted ca-small">{{ t('app.qr.changes', { n: seconds }) }}</p>
    <Message v-else severity="warn" :closable="false">{{ t('app.qr.offline') }}</Message>
    <Button
      v-if="!current"
      :label="t('app.qr.retry')"
      icon="pi pi-refresh"
      size="small"
      variant="outlined"
      :loading="loading"
      @click="refresh"
    />
    <p class="ca-muted ca-small">{{ t('app.qr.hint') }}</p>
    <p v-if="memberId" class="ca-num">{{ memberId }}</p>
  </div>
</template>

<style scoped>
.member-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.code {
  width: 240px;
  height: 240px;
  background: #fff;
  border-radius: 8px;
}
.code :deep(svg) {
  width: 100%;
  height: 100%;
}
.code--empty {
  display: grid;
  place-items: center;
  font-size: 2rem;
  color: var(--text-muted);
  background: var(--surface-100);
}
</style>
