<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import AuthCard from '@/components/auth/AuthCard.vue'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { signInError } from '@/lib/apiErrors'

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
  <AuthCard :subtitle="t('tenantApp.signIn.subtitle')" @submit="submit">
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
</style>
