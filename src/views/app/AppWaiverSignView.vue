<script setup lang="ts">
// Signing a waiver in the app (US-11.21): the text in the reader's language, then a typed name
// with consent or a drawn signature. A parent signs on behalf of their child. Signing records the
// time, IP and version, and a copy is emailed.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import SignaturePad from '@/components/clients/SignaturePad.vue'
import { clientApi, type WaiverToSign } from '@/api/clientApp'
import type { Translated } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const app = useClientApp()
const id = Number(route.params.id)
const clientId = route.query.client_id ? Number(route.query.client_id) : null
const waiver = ref<WaiverToSign | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const method = ref<'typed' | 'drawn'>('typed')
const signerName = ref('')
const accepted = ref(false)
const signature = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

const pick = (text: Translated | null | undefined) =>
  text ? (text[locale.value as 'ar' | 'en'] ?? text[locale.value === 'ar' ? 'en' : 'ar'] ?? '') : ''
const ready = computed(
  () =>
    !!signerName.value.trim() && accepted.value && (method.value === 'typed' || !!signature.value),
)

async function load() {
  state.value = 'loading'
  try {
    waiver.value = await clientApi.waivers.get(id, clientId)
    signerName.value = [app.account?.client?.first_name, app.account?.client?.last_name]
      .filter(Boolean)
      .join(' ')
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function sign() {
  if (!ready.value) return
  busy.value = true
  error.value = null
  try {
    await clientApi.waivers.sign(id, clientId, {
      signer_name: signerName.value.trim(),
      method: method.value,
      signature: method.value === 'drawn' ? signature.value : null,
      accepted: true,
    })
    toast.add({ severity: 'success', summary: t('app.waivers.done'), life: 3000 })
    await router.replace({
      name: 'app.waivers',
      query: route.query.redirect ? { redirect: route.query.redirect } : {},
    })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <template v-if="state === 'loading'">
      <div class="ca-card"><Skeleton height="240px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="waiver">
      <header>
        <h1 class="ca-title">{{ pick(waiver.name) }}</h1>
        <p class="ca-muted ca-small">
          {{ t('app.waivers.version', { n: waiver.version }) }} · {{ waiver.client.name }}
        </p>
      </header>
      <article class="ca-card text">{{ pick(waiver.content) }}</article>
      <Message v-if="waiver.on_behalf" severity="info" :closable="false">
        {{ t('app.waivers.onBehalf', { name: waiver.client.name }) }}
      </Message>
      <section class="ca-card ca-form">
        <SelectButton
          v-model="method"
          :options="[
            { value: 'typed', label: t('app.waivers.typed') },
            { value: 'drawn', label: t('app.waivers.drawn') },
          ]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('app.waivers.how')"
        />
        <label class="field">
          <span>{{ t('app.waivers.fullName') }}</span>
          <InputText v-model="signerName" autocomplete="name" />
        </label>
        <SignaturePad v-if="method === 'drawn'" v-model="signature" />
        <label class="consent">
          <Checkbox v-model="accepted" binary />
          <span>{{ t('app.waivers.consent') }}</span>
        </label>
        <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
        <Button
          :label="t('app.waivers.sign')"
          icon="pi pi-pencil"
          size="large"
          fluid
          :disabled="!ready"
          :loading="busy"
          @click="sign"
        />
        <p class="ca-muted ca-small">{{ t('app.waivers.copyHint') }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.text {
  white-space: pre-wrap;
  max-height: 50vh;
  overflow-y: auto;
  line-height: 1.7;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.consent {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
</style>
