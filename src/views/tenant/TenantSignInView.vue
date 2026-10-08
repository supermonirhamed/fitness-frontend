<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { signInError } from '@/lib/apiErrors'
import { tenantDomain } from '@/lib/appContext'

const { t } = useI18n()
const org = useOrganization()
const auth = useStaffAuth()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '', remember: true })
const busy = ref(false)
const error = ref<string | null>(route.query.expired ? t('tenantApp.signIn.sessionExpired') : null)
const lockedFor = ref(0) // seconds left while throttled
let countdown: ReturnType<typeof setInterval> | undefined

function startCountdown(seconds: number) {
  lockedFor.value = seconds
  clearInterval(countdown)
  countdown = setInterval(() => {
    lockedFor.value = Math.max(0, lockedFor.value - 1)
    if (lockedFor.value === 0) {
      clearInterval(countdown)
      error.value = null
    }
  }, 1000)
}
onBeforeUnmount(() => clearInterval(countdown))

async function submit() {
  busy.value = true
  error.value = null
  try {
    await auth.login(form.email, form.password, form.remember)
    await router.replace((route.query.redirect as string) || { name: 'tenant.today' })
  } catch (e) {
    const { kind, seconds } = signInError(e)
    if (kind === 'suspended') {
      await org.load(true)
      await router.replace({ name: 'tenant.status' })
      return
    }
    if (kind === 'throttled') startCountdown(seconds ?? 60)
    error.value = t(`tenantApp.signIn.errors.${kind}`, { seconds })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="signin">
    <div class="signin__lang"><LanguageToggle /></div>
    <form class="signin__card" novalidate @submit.prevent="submit">
      <div class="signin__brand">
        <span class="signin__logo" aria-hidden="true"><i class="pi pi-image" /></span>
        <div class="signin__title">{{ org.organization?.name }}</div>
        <div class="signin__subtitle">{{ t('tenantApp.signIn.subtitle') }}</div>
      </div>

      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <div class="field">
        <label for="email">{{ t('tenantApp.signIn.email') }}</label>
        <InputText
          id="email"
          v-model.trim="form.email"
          type="email"
          dir="ltr"
          autocomplete="username"
          required
          fluid
          :invalid="!!error && !lockedFor"
        />
      </div>
      <div class="field">
        <label for="password">{{ t('tenantApp.signIn.password') }}</label>
        <Password
          v-model="form.password"
          input-id="password"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          required
          fluid
          :invalid="!!error && !lockedFor"
        />
      </div>
      <label class="signin__remember">
        <Checkbox v-model="form.remember" binary input-id="remember" />
        <span>{{ t('tenantApp.signIn.remember') }}</span>
      </label>
      <Button
        type="submit"
        :label="
          lockedFor
            ? t('tenantApp.signIn.retryIn', { seconds: lockedFor })
            : t('tenantApp.signIn.submit')
        "
        size="large"
        fluid
        :loading="busy"
        :disabled="lockedFor > 0"
      />
    </form>
    <div class="signin__domain ltr-isolate">
      {{ org.organization ? tenantDomain(org.organization.slug) : '' }}
    </div>
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
  text-align: center;
}
.signin__logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-sunken);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.signin__logo i {
  font-size: 20px;
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
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.signin__remember {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  cursor: pointer;
}
.signin__domain {
  margin-top: var(--space-4);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
</style>
