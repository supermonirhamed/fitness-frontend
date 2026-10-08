<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import AuthCard from '@/components/auth/AuthCard.vue'
import NewPasswordFields from '@/components/auth/NewPasswordFields.vue'
import { needsTwoFactor, tenantApi, type EmailedLink } from '@/api/tenant'
import { linkProblem, type LinkProblem } from '@/lib/apiErrors'
import { useNewPasswordForm } from '@/composables/useNewPasswordForm'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()

const link: EmailedLink = {
  token: String(route.query.token ?? ''),
  email: String(route.query.email ?? ''),
}
const state = ref<'loading' | 'form' | 'error' | LinkProblem>('loading')
const busy = ref(false)
const error = ref<string | null>(null)
const { form, submitted, serverError, payload, showServerError } = useNewPasswordForm()

async function checkLink() {
  if (!link.token || !link.email) {
    state.value = 'invalid'
    return
  }
  state.value = 'loading'
  try {
    await tenantApi.checkResetLink(link)
    state.value = 'form'
  } catch (e) {
    state.value = linkProblem(e) ?? 'error'
  }
}
onMounted(checkLink)

async function submit() {
  const password = payload()
  if (!password) return
  busy.value = true
  error.value = null
  try {
    const result = await tenantApi.resetPassword(link, password)
    toast.add({ severity: 'success', summary: t('tenantApp.reset.done'), life: 6000 })
    if (needsTwoFactor(result)) {
      // A reset never skips 2FA: the code step of sign-in finishes the job.
      await router.replace({ name: 'tenant.signin', query: { step: 'code' } })
      return
    }
    auth.adopt(result)
    await router.replace({ name: 'tenant.today' })
  } catch (e) {
    const problem = linkProblem(e)
    if (problem) state.value = problem
    else if (!showServerError(e)) error.value = t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard :subtitle="t('tenantApp.reset.subtitle')" @submit="submit">
    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="40px" />
      <Skeleton height="40px" />
    </div>

    <template v-else-if="state === 'error'">
      <Message severity="error" :closable="false" role="alert">{{
        t('common.genericError')
      }}</Message>
      <Button
        :label="t('common.retry')"
        icon="pi pi-replay pi-dir"
        severity="secondary"
        variant="outlined"
        fluid
        @click="checkLink"
      />
    </template>

    <template v-else-if="state === 'form'">
      <div class="account ltr-isolate">{{ link.email }}</div>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <NewPasswordFields
        v-model:password="form.password"
        v-model:confirmation="form.confirmation"
        :show-errors="submitted"
        :server-error="serverError"
      />
      <Button
        type="submit"
        :label="t('tenantApp.reset.submit')"
        size="large"
        fluid
        :loading="busy"
      />
    </template>

    <template v-else>
      <Message severity="warn" :closable="false" role="alert">{{
        t(`tenantApp.reset.${state === 'expired' ? 'expired' : 'invalid'}`)
      }}</Message>
      <Button
        :label="t('tenantApp.reset.requestNew')"
        fluid
        @click="
          router.push({ name: 'tenant.forgot', query: link.email ? { email: link.email } : {} })
        "
      />
    </template>

    <RouterLink :to="{ name: 'tenant.signin' }" class="auth-link">{{
      t('tenantApp.backToSignIn')
    }}</RouterLink>
  </AuthCard>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.account {
  align-self: center;
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
