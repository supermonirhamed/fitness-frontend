<script setup lang="ts">
// Sign in to the client app (US-11.04): email or mobile and password, or a code by SMS when the
// organization allows it. Blocked or inactive clients are asked to contact the front desk.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import SelectButton from 'primevue/selectbutton'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi } from '@/api/clientApp'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const app = useClientApp()
const mode = ref<'password' | 'code'>('password')
const login = ref('')
const password = ref('')
const remember = ref(true)
const code = ref('')
const codeSent = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

async function done(account: Awaited<ReturnType<typeof clientApi.auth.login>>) {
  app.adopt(account)
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  await router.replace(redirect?.startsWith('/app') ? redirect : { name: 'app.home' })
}

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await action()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}

const signIn = () =>
  run(async () => done(await clientApi.auth.login(login.value, password.value, remember.value)))
const sendCode = () =>
  run(async () => {
    const res = await clientApi.auth.sendSignInCode(login.value)
    if (res.dev_code)
      toast.add({ severity: 'info', summary: t('app.devCode', { code: res.dev_code }) })
    codeSent.value = true
  })
const signInWithCode = () =>
  run(async () => done(await clientApi.auth.loginWithCode(login.value, code.value)))
</script>

<template>
  <div class="ca-stack">
    <div>
      <h1 class="ca-title">{{ t('app.signIn.title', { name: app.config?.name }) }}</h1>
      <p class="ca-muted">{{ t('app.signIn.subtitle') }}</p>
    </div>
    <div class="ca-card ca-form">
      <SelectButton
        v-if="app.config?.otp_sign_in"
        v-model="mode"
        :options="[
          { value: 'password', label: t('app.signIn.withPassword') },
          { value: 'code', label: t('app.signIn.withCode') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        fluid
      />
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <form v-if="mode === 'password'" class="ca-form" @submit.prevent="signIn">
        <FormField :label="t('app.signIn.login')" for="login">
          <InputText id="login" v-model="login" autocomplete="username" dir="ltr" required fluid />
        </FormField>
        <FormField :label="t('app.signIn.password')" for="password">
          <Password
            v-model="password"
            input-id="password"
            :feedback="false"
            toggle-mask
            autocomplete="current-password"
            required
            fluid
          />
        </FormField>
        <div class="ca-spread">
          <label class="ca-row ca-small">
            <Checkbox v-model="remember" binary input-id="remember" />{{ t('app.signIn.remember') }}
          </label>
          <RouterLink :to="{ name: 'app.forgot' }" class="ca-small">{{
            t('app.signIn.forgot')
          }}</RouterLink>
        </div>
        <Button type="submit" :label="t('app.signIn.submit')" :loading="busy" fluid />
      </form>
      <form v-else class="ca-form" @submit.prevent="codeSent ? signInWithCode() : sendCode()">
        <FormField :label="t('app.signIn.mobile')" for="mobile">
          <InputText
            id="mobile"
            v-model="login"
            type="tel"
            autocomplete="tel"
            dir="ltr"
            required
            fluid
          />
        </FormField>
        <FormField v-if="codeSent" :label="t('app.code.label')" :help="t('app.code.sentSms')">
          <InputOtp v-model="code" :length="6" integer-only />
        </FormField>
        <Button
          type="submit"
          :label="codeSent ? t('app.signIn.submit') : t('app.code.send')"
          :loading="busy"
          fluid
        />
      </form>
    </div>
    <p v-if="app.config?.self_registration" class="ca-muted center">
      {{ t('app.signIn.noAccount') }}
      <RouterLink :to="{ name: 'app.signup' }">{{ t('app.signIn.signUp') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.center {
  text-align: center;
}
</style>
