<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import AuthCard from '@/components/auth/AuthCard.vue'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { signInError } from '@/lib/apiErrors'
import type { SecondFactor } from '@/api/tenant'

const { t } = useI18n()
const org = useOrganization()
const auth = useStaffAuth()
const router = useRouter()
const route = useRoute()

// 'code' is the 2FA step (US-00.06); a password reset can also land here (?step=code).
const step = ref<'password' | 'code'>(route.query.step === 'code' ? 'code' : 'password')
const form = reactive({ email: '', password: '', remember: true })
const code = ref('')
const recoveryCode = ref('')
const useRecovery = ref(false)
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

const done = () => router.replace((route.query.redirect as string) || { name: 'tenant.today' })

async function showError(e: unknown) {
  const { kind, seconds } = signInError(e)
  if (kind === 'suspended') {
    await org.load(true)
    await router.replace({ name: 'tenant.status' })
    return
  }
  if (kind === 'twoFactorExpired') {
    backToPassword()
    error.value = t('tenantApp.twoFactor.expired')
    return
  }
  if (kind === 'throttled') startCountdown(seconds ?? 60)
  error.value =
    kind === 'invalid' && step.value === 'code'
      ? t('tenantApp.twoFactor.invalid')
      : t(`tenantApp.signIn.errors.${kind}`, { seconds })
}

async function submitPassword() {
  busy.value = true
  error.value = null
  try {
    if ((await auth.login(form.email, form.password, form.remember)) === 'signed_in') {
      await done()
      return
    }
    form.password = ''
    step.value = 'code'
  } catch (e) {
    await showError(e)
  } finally {
    busy.value = false
  }
}

async function submitCode() {
  if (useRecovery.value ? !recoveryCode.value.trim() : code.value.length !== 6) return
  const factor: SecondFactor = useRecovery.value
    ? { recovery_code: recoveryCode.value.trim() }
    : { code: code.value }
  busy.value = true
  error.value = null
  try {
    await auth.challenge(factor)
    await done()
  } catch (e) {
    code.value = ''
    await showError(e)
  } finally {
    busy.value = false
  }
}

// The code is submitted as soon as the 6th digit is typed.
function onCodeInput(value: unknown) {
  code.value = String(value ?? '')
  if (code.value.length === 6 && !busy.value && !lockedFor.value) submitCode()
}

async function toggleRecovery() {
  useRecovery.value = !useRecovery.value
  error.value = null
  await nextTick()
  document
    .getElementById(useRecovery.value ? 'recovery-code' : 'otp')
    ?.querySelector('input')
    ?.focus()
}

function backToPassword() {
  step.value = 'password'
  code.value = ''
  recoveryCode.value = ''
  useRecovery.value = false
  error.value = null
  if (route.query.step) router.replace({ query: { ...route.query, step: undefined } })
}
</script>

<template>
  <AuthCard
    v-if="step === 'password'"
    :subtitle="t('tenantApp.signIn.subtitle')"
    @submit="submitPassword"
  >
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
    <div class="row">
      <label class="remember">
        <Checkbox v-model="form.remember" binary input-id="remember" />
        <span>{{ t('tenantApp.signIn.remember') }}</span>
      </label>
      <RouterLink
        :to="{ name: 'tenant.forgot', query: form.email ? { email: form.email } : {} }"
        class="forgot"
        >{{ t('tenantApp.forgot.link') }}</RouterLink
      >
    </div>
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
  </AuthCard>

  <AuthCard v-else :subtitle="t('tenantApp.twoFactor.title')" @submit="submitCode">
    <p class="hint">
      {{ useRecovery ? t('tenantApp.twoFactor.recoveryHint') : t('tenantApp.twoFactor.codeHint') }}
    </p>
    <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

    <div v-if="!useRecovery" id="otp" class="otp" dir="ltr">
      <InputOtp
        :model-value="code"
        :length="6"
        integer-only
        :disabled="busy || lockedFor > 0"
        :invalid="!!error && !lockedFor"
        :aria-label="t('tenantApp.twoFactor.code')"
        autofocus
        @update:model-value="onCodeInput"
      />
    </div>
    <div v-else id="recovery-code" class="field">
      <label for="recovery-code-input">{{ t('tenantApp.twoFactor.recoveryCode') }}</label>
      <InputText
        id="recovery-code-input"
        v-model="recoveryCode"
        dir="ltr"
        autocomplete="one-time-code"
        placeholder="xxxxx-xxxxx"
        fluid
        :invalid="!!error && !lockedFor"
      />
    </div>

    <Button
      type="submit"
      :label="
        lockedFor
          ? t('tenantApp.signIn.retryIn', { seconds: lockedFor })
          : t('tenantApp.twoFactor.verify')
      "
      size="large"
      fluid
      :loading="busy"
      :disabled="lockedFor > 0 || (useRecovery ? !recoveryCode.trim() : code.length !== 6)"
    />
    <div class="links">
      <Button
        variant="link"
        size="small"
        :label="
          useRecovery ? t('tenantApp.twoFactor.useApp') : t('tenantApp.twoFactor.useRecovery')
        "
        @click="toggleRecovery"
      />
      <Button
        variant="link"
        size="small"
        severity="secondary"
        :label="t('tenantApp.backToSignIn')"
        @click="backToPassword"
      />
    </div>
  </AuthCard>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.remember {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  cursor: pointer;
}
.forgot {
  font: var(--text-small);
}
.hint {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
  text-align: center;
}
.otp {
  display: flex;
  justify-content: center;
}
.links {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}
</style>
