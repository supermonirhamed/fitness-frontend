<script setup lang="ts">
// Signing a waiver on the staff tablet, handed to the client (US-05.07, brief 06 §5): full screen,
// large type, Arabic / English, the waiver text, then a typed name with consent or a drawn
// signature. A minor's waiver is signed by a guardian ("Signing on behalf of …"). After signing,
// the confirmation hands the tablet back to staff.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import SignaturePad from '@/components/clients/SignaturePad.vue'
import { tenantApi, type Client, type Translated } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { setLocale } from '@/i18n'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const clientId = Number(route.params.client)
const templateId = Number(route.params.template)

const waiver = ref<{
  name: Translated
  version: number
  content: Translated
  client: { id: number; name: string; minor: boolean }
} | null>(null)
const failed = ref(false)
const lang = ref<'ar' | 'en'>(locale.value === 'ar' ? 'ar' : 'en')
const method = ref<'typed' | 'drawn'>('typed')
const signerName = ref('')
const accepted = ref(false)
const signature = ref<string | null>(null)
const guardian = ref<Client | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const done = ref(false)

const guardians = ref<{ id: number; name: string }[]>([])
onMounted(async () => {
  try {
    waiver.value = await tenantApi.waivers.toSign(clientId, templateId)
    if (!waiver.value.client.minor) signerName.value = waiver.value.client.name
    else
      guardians.value = (await tenantApi.clients.family(clientId)).guardians
        .filter((g) => g.client)
        .map((g) => ({ id: g.client!.id, name: g.client!.name }))
  } catch {
    failed.value = true
  }
})
function chooseGuardianId(id: number) {
  const g = guardians.value.find((x) => x.id === id)
  guardian.value = g ? ({ id: g.id, name: g.name } as Client) : null
  signerName.value = g?.name ?? ''
}
function setLang(value: 'ar' | 'en') {
  lang.value = value
  setLocale(value)
}
const pick = (text: Translated | null | undefined) =>
  text ? (text[lang.value] ?? text[lang.value === 'ar' ? 'en' : 'ar'] ?? '') : ''

const ready = computed(
  () =>
    !!signerName.value.trim() &&
    accepted.value &&
    (method.value === 'typed' || !!signature.value) &&
    (!waiver.value?.client.minor || !!guardian.value),
)
async function sign() {
  if (!ready.value) return
  saving.value = true
  error.value = null
  try {
    await tenantApi.waivers.sign(clientId, templateId, {
      signer_name: signerName.value.trim(),
      method: method.value,
      accepted: true,
      signature: method.value === 'drawn' ? signature.value : null,
      guardian_client_id: guardian.value?.id ?? null,
    })
    done.value = true
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
const back = () =>
  router.push({ name: 'tenant.client', params: { id: clientId }, query: { tab: 'waivers' } })
</script>

<template>
  <div class="sign-page" :dir="lang === 'ar' ? 'rtl' : 'ltr'">
    <header class="top">
      <SelectButton
        :model-value="lang"
        :options="[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        @update:model-value="setLang"
      />
      <Button
        variant="text"
        severity="secondary"
        icon="pi pi-times"
        :label="t('waiverSign.returnToStaff')"
        @click="back"
      />
    </header>

    <p v-if="failed" class="paper">{{ t('waiverSign.loadError') }}</p>

    <section v-else-if="done" class="paper done">
      <i class="pi pi-check-circle done__icon" aria-hidden="true" />
      <h1>{{ t('waiverSign.thanks') }}</h1>
      <p>{{ t('waiverSign.handBack') }}</p>
      <Button :label="t('waiverSign.returnToStaff')" @click="back" />
    </section>

    <article v-else-if="waiver" class="paper">
      <h1>{{ pick(waiver.name) }}</h1>
      <p class="muted">
        {{ t('waiverSign.version', { n: waiver.version }) }} · {{ waiver.client.name }}
      </p>
      <div class="text">{{ pick(waiver.content) }}</div>

      <Message v-if="waiver.client.minor" severity="info" :closable="false">
        {{ t('waiverSign.onBehalf', { name: waiver.client.name }) }}
      </Message>
      <div v-if="waiver.client.minor" class="field">
        <label for="sign-guardian">{{ t('waiverSign.guardian') }} *</label>
        <Select
          v-if="guardians.length"
          :model-value="guardian?.id ?? null"
          input-id="sign-guardian"
          :options="guardians"
          option-label="name"
          option-value="id"
          @update:model-value="chooseGuardianId"
        />
        <Message v-else severity="warn" :closable="false">{{ t('waiverSign.noGuardian') }}</Message>
      </div>

      <div class="field">
        <span id="sign-method">{{ t('waiverSign.how') }}</span>
        <SelectButton
          v-model="method"
          :options="[
            { value: 'typed', label: t('waiverSign.typed') },
            { value: 'drawn', label: t('waiverSign.drawn') },
          ]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="sign-method"
        />
      </div>
      <div class="field">
        <label for="sign-name">{{ t('waiverSign.fullName') }} *</label>
        <InputText id="sign-name" v-model="signerName" class="big" />
      </div>
      <SignaturePad v-if="method === 'drawn'" v-model="signature" />
      <label class="consent">
        <Checkbox v-model="accepted" binary input-id="sign-consent" />
        <span>{{ t('waiverSign.consent') }}</span>
      </label>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <Button
        :label="t('waiverSign.sign')"
        icon="pi pi-pencil"
        size="large"
        :disabled="!ready"
        :loading="saving"
        @click="sign"
      />
    </article>
  </div>
</template>

<style scoped>
.sign-page {
  min-height: 100vh;
  background: var(--surface-ground, #f4f4f5);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 18px;
}
.top {
  width: 100%;
  max-width: 900px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.paper {
  width: 100%;
  max-width: 900px;
  background: var(--surface-card);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.paper h1 {
  margin: 0;
  font-size: 26px;
}
.text {
  white-space: pre-wrap;
  max-height: 45vh;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  line-height: 1.7;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.big {
  font-size: 20px;
}
.consent {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.muted {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
}
.done {
  align-items: center;
  text-align: center;
}
.done__icon {
  font-size: 56px;
  color: var(--sev-success-solid);
}
</style>
