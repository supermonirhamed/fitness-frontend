<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { usePlatformAuth } from '@/stores/platformAuth'
import { validationErrors } from '@/lib/http'

const { t } = useI18n()
const auth = usePlatformAuth()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '', remember: true })
const error = ref<string | null>(route.query.expired ? t('platform.sessionExpired') : null)
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = null
  try {
    await auth.login(form.email, form.password, form.remember)
    await router.replace((route.query.redirect as string) || { name: 'platform.tenants' })
  } catch (e) {
    error.value = validationErrors(e).email?.[0] ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="signin">
    <div class="signin__lang"><LanguageToggle /></div>
    <form class="signin__card" @submit.prevent="submit">
      <div class="signin__brand">
        <span class="signin__mark"><i class="pi pi-shield" aria-hidden="true" /></span>
        <div class="signin__title">{{ t('platform.signIn.title') }}</div>
        <div class="signin__subtitle">{{ t('platform.signIn.subtitle') }}</div>
      </div>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div class="field">
        <label for="email">{{ t('platform.signIn.email') }}</label>
        <InputText
          id="email"
          v-model="form.email"
          type="email"
          dir="ltr"
          autocomplete="username"
          required
          fluid
          :invalid="!!error"
        />
      </div>
      <div class="field">
        <label for="password">{{ t('platform.signIn.password') }}</label>
        <Password
          input-id="password"
          v-model="form.password"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          required
          fluid
          :invalid="!!error"
          @input="error = null"
        />
      </div>
      <label class="signin__remember">
        <Checkbox v-model="form.remember" binary input-id="remember" />
        <span>{{ t('platform.signIn.remember') }}</span>
      </label>
      <Button
        type="submit"
        :label="t('platform.signIn.submit')"
        size="large"
        fluid
        :loading="busy"
      />
    </form>
  </div>
</template>

<style scoped>
.signin {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--bg-app);
}
.signin__lang {
  position: fixed;
  top: var(--space-4);
  inset-inline-end: var(--space-4);
}
.signin__card {
  width: 400px;
  max-width: 100%;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-1);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.signin__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-1);
}
.signin__mark {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.signin__mark i {
  font-size: 22px;
}
.signin__title {
  font: var(--text-h2);
}
.signin__subtitle {
  font: var(--text-small);
  color: var(--text-secondary);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font: var(--fw-medium) var(--fs-small)/var(--lh-small) var(--font-sans);
  color: var(--text-primary);
}
.signin__remember {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
