<script setup lang="ts">
// The client's waivers (US-05.07, brief 06 §3): each waiver that applies, Signed (date, version,
// who signed — a guardian for a child), Missing or New version to sign; "Sign now on this device"
// opens the signing screen to hand to the client, and a signed copy can be viewed.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type ClientWaiverStatus, type Translated } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const { t, locale } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const status = ref<ClientWaiverStatus | null>(null)
async function load() {
  state.value = 'loading'
  try {
    status.value = await tenantApi.waivers.forClient(props.clientId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.clientId, load, { immediate: true })

const SEVERITY = { signed: 'success', missing: 'warn', resign: 'warn' } as const
const sign = (templateId: number) =>
  router.push({
    name: 'tenant.waiver.sign',
    params: { client: props.clientId, template: templateId },
  })

const copyOpen = ref(false)
const copy = ref<Awaited<ReturnType<typeof tenantApi.waivers.signedCopy>> | null>(null)
async function view(signatureId: number) {
  copy.value = await tenantApi.waivers.signedCopy(props.clientId, signatureId)
  copyOpen.value = true
}
const pick = (text: Translated | null | undefined) =>
  text ? (text[locale.value as 'ar' | 'en'] ?? text.en ?? text.ar ?? '') : ''
</script>

<template>
  <div class="card">
    <div v-if="state === 'loading'" class="pad"><Skeleton height="48px" /></div>
    <ErrorState v-else-if="state === 'error'" :title="t('clientWaivers.loadError')" @retry="load" />
    <EmptyState
      v-else-if="!status?.waivers.length"
      compact
      icon="pi-file-edit"
      :title="t('clientWaivers.none')"
    />
    <ul v-else class="list">
      <li v-for="w in status.waivers" :key="w.template_id" class="item">
        <div class="item__text">
          <span class="item__name">{{ w.name }}</span>
          <small class="muted">
            {{ t(`waivers.requiredFor.${w.required_for}`) }}
            <template v-if="w.services.length">· {{ w.services.join(', ') }}</template>
          </small>
          <small v-if="w.signed" class="muted">
            {{
              t('clientWaivers.signedBy', {
                name: w.signed.signer_name,
                date: format.dateTime(w.signed.signed_at),
                version: w.signed.version,
              })
            }}
            <template v-if="w.signed.guardian">· {{ t('clientWaivers.forChild') }}</template>
          </small>
        </div>
        <Tag
          class="tag-sm"
          :severity="SEVERITY[w.state]"
          :value="t(`clientWaivers.states.${w.state}`)"
        />
        <Button
          v-if="w.signed"
          size="small"
          variant="text"
          :label="t('clientWaivers.view')"
          @click="view(w.signed.id)"
        />
        <Button
          v-if="w.state !== 'signed' && auth.can('clients.update')"
          size="small"
          icon="pi pi-tablet"
          :label="t('clientWaivers.signNow')"
          @click="sign(w.template_id)"
        />
      </li>
    </ul>
  </div>

  <Dialog
    v-model:visible="copyOpen"
    modal
    :header="copy?.name"
    :style="{ width: '640px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div v-if="copy" class="copy">
      <div class="copy__text">{{ pick(copy.content) }}</div>
      <img
        v-if="copy.signature"
        :src="copy.signature"
        :alt="t('clientWaivers.signature')"
        class="copy__sig"
      />
      <small class="muted">
        {{
          t('clientWaivers.signedBy', {
            name: copy.signer_name,
            date: format.dateTime(copy.signed_at),
            version: copy.version,
          })
        }}
        <template v-if="copy.ip_address">· IP {{ copy.ip_address }}</template>
        <template v-if="copy.collected_by"
          >· {{ t('clientWaivers.collectedBy', { name: copy.collected_by }) }}</template
        >
      </small>
    </div>
  </Dialog>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.item__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.item__name {
  font: 500 14px var(--font-sans);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.copy__text {
  white-space: pre-wrap;
  max-height: 40vh;
  overflow-y: auto;
}
.copy__sig {
  max-width: 100%;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: #fff;
}
</style>
