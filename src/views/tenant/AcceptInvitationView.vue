<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import AuthCard from '@/components/auth/AuthCard.vue'
import NewPasswordFields from '@/components/auth/NewPasswordFields.vue'
import { tenantApi, type EmailedLink, type Invitation } from '@/api/tenant'
import { linkProblem, type LinkProblem } from '@/lib/apiErrors'
import { useNewPasswordForm } from '@/composables/useNewPasswordForm'
import { useStaffAuth } from '@/stores/staffAuth'
import { useOrganization } from '@/stores/organization'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()

const link: EmailedLink = {
  token: String(route.query.token ?? ''),
  email: String(route.query.email ?? ''),
}
const invitation = ref<Invitation | null>(null)
const state = ref<'loading' | 'form' | 'error' | LinkProblem>('loading')
const busy = ref(false)
const error = ref<string | null>(null)
const { form, submitted, serverError, payload, showServerError } = useNewPasswordForm()

const role = computed(() => {
  const name = invitation.value?.role ?? ''
  return te(`roles.${name}`) ? t(`roles.${name}`) : name
})

async function load() {
  if (!link.token || !link.email) {
    state.value = 'invalid'
    return
  }
  state.value = 'loading'
  try {
    invitation.value = await tenantApi.invitation(link)
    state.value = 'form'
  } catch (e) {
    state.value = linkProblem(e) ?? 'error'
  }
}
onMounted(load)

async function submit() {
  const password = payload()
  if (!password) return
  busy.value = true
  error.value = null
  try {
    auth.adopt(await tenantApi.acceptInvitation(link, password))
    toast.add({ severity: 'success', summary: t('tenantApp.invitation.done'), life: 6000 })
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
  <AuthCard
    :subtitle="
      state === 'form' && invitation
        ? t('tenantApp.invitation.welcome', { name: invitation.name })
        : t('tenantApp.invitation.title')
    "
    @submit="submit"
  >
    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="20px" />
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
        @click="load"
      />
    </template>

    <template v-else-if="state === 'form' && invitation">
      <p class="intro">
        {{ t('tenantApp.invitation.joining', { organization: org.organization?.name, role }) }}
      </p>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="email">{{ t('tenantApp.signIn.email') }}</label>
        <InputText
          id="email"
          :model-value="invitation.email"
          dir="ltr"
          autocomplete="username"
          readonly
          fluid
        />
      </div>
      <NewPasswordFields
        v-model:password="form.password"
        v-model:confirmation="form.confirmation"
        :show-errors="submitted"
        :server-error="serverError"
      />
      <Button
        type="submit"
        :label="t('tenantApp.invitation.submit')"
        size="large"
        fluid
        :loading="busy"
      />
    </template>

    <template v-else>
      <Message :severity="state === 'used' ? 'info' : 'warn'" :closable="false" role="alert">{{
        t(`tenantApp.invitation.${state}`)
      }}</Message>
      <Button
        :label="t('tenantApp.invitation.signIn')"
        fluid
        @click="router.push({ name: 'tenant.signin' })"
      />
    </template>
  </AuthCard>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.intro {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
  text-align: center;
}
</style>
