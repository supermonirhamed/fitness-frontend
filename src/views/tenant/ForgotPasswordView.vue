<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import AuthCard from '@/components/auth/AuthCard.vue'
import { tenantApi } from '@/api/tenant'
import { statusOf } from '@/lib/http'

const { t } = useI18n()
const route = useRoute()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const sentTo = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (!email.value) return
  busy.value = true
  error.value = null
  try {
    await tenantApi.forgotPassword(email.value)
    sentTo.value = email.value
  } catch (e) {
    const status = statusOf(e)
    error.value =
      status === 422
        ? t('tenantApp.forgot.invalidEmail')
        : status === 429
          ? t('tenantApp.forgot.tooMany')
          : t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard
    :subtitle="sentTo ? t('tenantApp.forgot.sentTitle') : t('tenantApp.forgot.title')"
    @submit="submit"
  >
    <template v-if="sentTo">
      <Message severity="success" :closable="false" role="status">
        <i18n-t keypath="tenantApp.forgot.sent" tag="span">
          <template #email>
            <strong class="ltr-isolate">{{ sentTo }}</strong>
          </template>
        </i18n-t>
      </Message>
      <Button
        :label="t('tenantApp.forgot.resend')"
        severity="secondary"
        variant="outlined"
        fluid
        @click="sentTo = null"
      />
    </template>

    <template v-else>
      <p class="hint">{{ t('tenantApp.forgot.subtitle') }}</p>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="email">{{ t('tenantApp.signIn.email') }}</label>
        <InputText
          id="email"
          v-model.trim="email"
          type="email"
          dir="ltr"
          autocomplete="username"
          required
          fluid
          :invalid="!!error"
        />
      </div>
      <Button
        type="submit"
        :label="t('tenantApp.forgot.submit')"
        size="large"
        fluid
        :loading="busy"
        :disabled="!email"
      />
    </template>

    <RouterLink :to="{ name: 'tenant.signin' }" class="auth-link">{{
      t('tenantApp.backToSignIn')
    }}</RouterLink>
  </AuthCard>
</template>

<style scoped>
.hint {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
  text-align: center;
}
</style>
