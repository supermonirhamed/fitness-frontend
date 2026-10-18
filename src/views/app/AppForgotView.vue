<script setup lang="ts">
// Reset a forgotten password (US-11.04): a code to the email or mobile, then a new password.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi } from '@/api/clientApp'
import { firstMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const login = ref('')
const code = ref('')
const password = ref('')
const confirm = ref('')
const sent = ref(false)
const busy = ref(false)
const errors = ref<ValidationErrors>({})
const error = ref<string | null>(null)

async function run(action: () => Promise<void>) {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    await action()
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length) error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}

const send = () =>
  run(async () => {
    const res = await clientApi.auth.forgot(login.value)
    if (res.dev_code)
      toast.add({ severity: 'info', summary: t('app.devCode', { code: res.dev_code }) })
    sent.value = true
  })
const reset = () =>
  run(async () => {
    await clientApi.auth.reset({
      login: login.value,
      code: code.value,
      password: password.value,
      password_confirmation: confirm.value,
    })
    toast.add({ severity: 'success', summary: t('app.forgot.done'), life: 4000 })
    await router.replace({ name: 'app.signin' })
  })
</script>

<template>
  <div class="ca-stack">
    <div>
      <h1 class="ca-title">{{ t('app.forgot.title') }}</h1>
      <p class="ca-muted">{{ sent ? t('app.forgot.sent') : t('app.forgot.subtitle') }}</p>
    </div>
    <form class="ca-card ca-form" @submit.prevent="sent ? reset() : send()">
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <FormField :label="t('app.signIn.login')" for="fp-login" :error="errors.login?.[0]">
        <InputText id="fp-login" v-model="login" :disabled="sent" dir="ltr" required fluid />
      </FormField>
      <template v-if="sent">
        <FormField :label="t('app.code.label')" :error="errors.code?.[0]">
          <div dir="ltr"><InputOtp v-model="code" :length="6" integer-only /></div>
        </FormField>
        <FormField
          :label="t('app.forgot.newPassword')"
          for="fp-password"
          :error="errors.password?.[0]"
          :help="t('app.signUp.passwordHelp')"
        >
          <Password
            v-model="password"
            input-id="fp-password"
            toggle-mask
            autocomplete="new-password"
            fluid
          />
        </FormField>
        <FormField :label="t('app.signUp.confirmPassword')" for="fp-confirm">
          <Password
            v-model="confirm"
            input-id="fp-confirm"
            :feedback="false"
            toggle-mask
            autocomplete="new-password"
            fluid
          />
        </FormField>
      </template>
      <Button
        type="submit"
        :label="sent ? t('app.forgot.submit') : t('app.code.send')"
        :loading="busy"
        fluid
      />
    </form>
    <RouterLink :to="{ name: 'app.signin' }" class="ca-small">{{
      t('app.forgot.back')
    }}</RouterLink>
  </div>
</template>
