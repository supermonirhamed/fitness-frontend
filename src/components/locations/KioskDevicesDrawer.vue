<script setup lang="ts">
// A branch's self check-in kiosks (US-08.05): each is a tablet showing the kiosk page, paired by a
// link opened on it once (its token is shown only then), with when it was last used. A lost
// device is revoked, and the kiosk stops working at once.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type KioskDevice } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { firstMessage } from '@/lib/apiErrors'

const props = defineProps<{ locationId: number; locationName: string; canEdit: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const toast = useToast()
const format = useFormat()

const devices = ref<KioskDevice[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const name = ref('')
const adding = ref(false)
const error = ref<string | null>(null)
const paired = ref<KioskDevice | null>(null)

async function load() {
  state.value = 'loading'
  try {
    devices.value = await tenantApi.kiosks.list(props.locationId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(visible, (open) => {
  if (!open) return
  paired.value = null
  name.value = ''
  error.value = null
  load()
})

async function add() {
  if (!name.value.trim()) return
  adding.value = true
  error.value = null
  try {
    paired.value = await tenantApi.kiosks.create(props.locationId, name.value.trim())
    name.value = ''
    await load()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    adding.value = false
  }
}
async function copy(url: string) {
  await navigator.clipboard?.writeText(url).catch(() => undefined)
  toast.add({ severity: 'success', summary: t('kioskDevices.copied'), life: 2500 })
}
async function revoke(d: KioskDevice) {
  try {
    await tenantApi.kiosks.revoke(props.locationId, d.id)
    devices.value = devices.value.filter((x) => x.id !== d.id)
    toast.add({
      severity: 'success',
      summary: t('kioskDevices.revoked', { name: d.name }),
      life: 3000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="locale === 'ar' ? 'left' : 'right'"
    class="form-drawer drawer-lg"
  >
    <template #header>
      <div class="titles">
        <span class="p-drawer-title">{{ t('kioskDevices.title') }}</span>
        <span class="muted small">{{ locationName }}</span>
      </div>
    </template>
    <div class="body">
      <p class="muted">{{ t('kioskDevices.help') }}</p>

      <Message v-if="paired?.url" severity="success" :closable="false">
        <div class="paired">
          <strong>{{ t('kioskDevices.pairTitle', { name: paired.name }) }}</strong>
          <span>{{ t('kioskDevices.pairHelp') }}</span>
          <code dir="ltr">{{ paired.url }}</code>
          <div class="paired__actions">
            <Button
              :label="t('kioskDevices.copy')"
              icon="pi pi-copy"
              size="small"
              @click="copy(paired.url!)"
            />
            <a :href="paired.url" target="_blank" rel="noopener" class="open-link">{{
              t('kioskDevices.openHere')
            }}</a>
          </div>
        </div>
      </Message>

      <form v-if="canEdit" class="add" @submit.prevent="add">
        <InputText
          v-model="name"
          :placeholder="t('kioskDevices.namePlaceholder')"
          :aria-label="t('kioskDevices.name')"
          maxlength="80"
          fluid
        />
        <Button
          type="submit"
          :label="t('kioskDevices.add')"
          icon="pi pi-plus"
          :loading="adding"
          :disabled="!name.trim()"
        />
      </form>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <Skeleton v-if="state === 'loading'" height="80px" />
      <ErrorState v-else-if="state === 'error'" compact @retry="load" />
      <EmptyState
        v-else-if="!devices.length"
        compact
        icon="pi-tablet"
        :title="t('kioskDevices.none')"
      />
      <ul v-else class="devices">
        <li v-for="d in devices" :key="d.id">
          <i class="pi pi-tablet" aria-hidden="true" />
          <div class="device">
            <strong>{{ d.name }}</strong>
            <span class="muted small">{{
              d.last_seen_at
                ? t('kioskDevices.lastSeen', { at: format.dateTime(d.last_seen_at) })
                : t('kioskDevices.neverUsed')
            }}</span>
          </div>
          <Button
            v-if="canEdit"
            :label="t('kioskDevices.revoke')"
            severity="danger"
            variant="text"
            size="small"
            @click="revoke(d)"
          />
        </li>
      </ul>
    </div>
  </Drawer>
</template>

<style scoped>
.titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.muted {
  margin: 0;
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.paired {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.paired code {
  font-family: var(--font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.paired__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.open-link {
  font: var(--text-small);
}
.add {
  display: flex;
  gap: 8px;
}
.devices {
  list-style: none;
  margin: 0;
  padding: 0;
}
.devices li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.device {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
