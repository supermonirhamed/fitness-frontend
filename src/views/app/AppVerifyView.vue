<script setup lang="ts">
// Verify the email or mobile (US-11.03): the 6-digit code, a new one, or the other channel.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputOtp from 'primevue/inputotp'
import Message from 'primevue/message'
import { clientApi } from '@/api/clientApp'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const app = useClientApp()
const channel = ref<'email' | 'sms'>(route.query.channel === 'sms' ? 'sms' : 'email')
const destination = computed(() =>
  channel.value === 'sms' ? app.account?.mobile : app.account?.email,
)
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function verify() {
  busy.value = true
  error.value = null
  try {
    app.adopt(await clientApi.auth.verify(channel.value, code.value))
    toast.add({ severity: 'success', summary: t('app.verify.done'), life: 3000 })
    // Waivers to sign come first after sign-up (US-11.21).
    const family = await clientApi.waivers.family().catch(() => [])
    const pending = family.some((f) =>
      f.waivers.some((w) => w.state !== 'signed' && w.required_for !== 'services'),
    )
    await router.replace(
      pending ? { name: 'app.waivers', query: { welcome: '1' } } : { name: 'app.home' },
    )
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}

async function resend(next: 'email' | 'sms') {
  error.value = null
  try {
    const res = await clientApi.auth.resend(next)
    channel.value = next
    code.value = ''
    toast.add({ severity: 'success', summary: t('app.code.resent'), life: 3000 })
    if (res.dev_code)
      toast.add({ severity: 'info', summary: t('app.devCode', { code: res.dev_code }) })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  }
}

async function signOut() {
  await app.logout()
  await router.replace({ name: 'app.signin' })
}
</script>

<template>
  <div class="ca-stack">
    <div>
      <h1 class="ca-title">{{ t('app.verify.title') }}</h1>
      <p class="ca-muted">
        {{ t('app.verify.sentTo') }} <strong dir="ltr">{{ destination }}</strong>
      </p>
    </div>
    <form class="ca-card ca-form" @submit.prevent="verify">
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <div class="otp" dir="ltr">
        <InputOtp v-model="code" :length="6" integer-only :aria-label="t('app.code.label')" />
      </div>
      <Button
        type="submit"
        :label="t('app.verify.submit')"
        :disabled="code.length !== 6"
        :loading="busy"
        fluid
      />
      <div class="ca-spread ca-small">
        <Button
          :label="t('app.code.resend')"
          variant="link"
          size="small"
          @click="resend(channel)"
        />
        <Button
          :label="channel === 'email' ? t('app.verify.bySms') : t('app.verify.byEmail')"
          variant="link"
          size="small"
          @click="resend(channel === 'email' ? 'sms' : 'email')"
        />
      </div>
    </form>
    <Button
      :label="t('app.account.signOut')"
      variant="text"
      severity="secondary"
      @click="signOut"
    />
  </div>
</template>

<style scoped>
.otp {
  display: flex;
  justify-content: center;
}
</style>
