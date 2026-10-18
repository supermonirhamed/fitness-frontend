<script setup lang="ts">
// Sign up (US-11.03): name, mobile, email, password, language, home branch and the terms. A code
// is sent to verify the email (or mobile); an existing client record with the same contact is
// linked once verified.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi } from '@/api/clientApp'
import { currentLocale } from '@/i18n'
import { firstMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const app = useClientApp()
const form = ref({
  first_name: '',
  last_name: '',
  mobile: '',
  email: '',
  password: '',
  password_confirmation: '',
  preferred_language: currentLocale(),
  home_location_id: (app.config?.locations.length === 1 ? app.config.locations[0]!.id : null) as
    number | null,
  accept_terms: false,
  channel: 'email' as 'email' | 'sms',
})
const busy = ref(false)
const errors = ref<ValidationErrors>({})
const error = ref<string | null>(null)
const err = (k: string) => errors.value[k]?.[0]

async function submit() {
  busy.value = true
  errors.value = {}
  error.value = null
  try {
    const res = await clientApi.auth.register(form.value)
    app.adopt(res.data)
    if (res.dev_code)
      toast.add({ severity: 'info', summary: t('app.devCode', { code: res.dev_code }) })
    await router.replace({ name: 'app.verify', query: { channel: form.value.channel } })
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length) error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <div>
      <h1 class="ca-title">{{ t('app.signUp.title') }}</h1>
      <p class="ca-muted">{{ t('app.signUp.subtitle', { name: app.config?.name }) }}</p>
    </div>
    <form class="ca-card ca-form" @submit.prevent="submit">
      <Message v-if="error" severity="error" :closable="false">
        {{ error }}
        <RouterLink :to="{ name: 'app.signin' }">{{ t('app.signIn.submit') }}</RouterLink>
      </Message>
      <div class="two">
        <FormField
          :label="t('app.profile.firstName')"
          for="su-first"
          required
          :error="err('first_name')"
        >
          <InputText id="su-first" v-model="form.first_name" autocomplete="given-name" fluid />
        </FormField>
        <FormField
          :label="t('app.profile.lastName')"
          for="su-last"
          required
          :error="err('last_name')"
        >
          <InputText id="su-last" v-model="form.last_name" autocomplete="family-name" fluid />
        </FormField>
      </div>
      <FormField :label="t('app.profile.mobile')" for="su-mobile" required :error="err('mobile')">
        <InputText
          id="su-mobile"
          v-model="form.mobile"
          type="tel"
          autocomplete="tel"
          dir="ltr"
          fluid
        />
      </FormField>
      <FormField :label="t('app.profile.email')" for="su-email" required :error="err('email')">
        <InputText
          id="su-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          dir="ltr"
          fluid
        />
      </FormField>
      <FormField
        :label="t('app.signIn.password')"
        for="su-password"
        required
        :error="err('password')"
        :help="t('app.signUp.passwordHelp')"
      >
        <Password
          v-model="form.password"
          input-id="su-password"
          toggle-mask
          autocomplete="new-password"
          fluid
        />
      </FormField>
      <FormField :label="t('app.signUp.confirmPassword')" for="su-confirm" required>
        <Password
          v-model="form.password_confirmation"
          input-id="su-confirm"
          :feedback="false"
          toggle-mask
          autocomplete="new-password"
          fluid
        />
      </FormField>
      <FormField :label="t('app.profile.language')">
        <SelectButton
          v-model="form.preferred_language"
          :options="[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <FormField
        v-if="app.config && app.config.locations.length > 1"
        :label="t('app.profile.homeBranch')"
        for="su-branch"
        :error="err('home_location_id')"
      >
        <Select
          v-model="form.home_location_id"
          input-id="su-branch"
          :options="app.config.locations"
          option-label="name"
          option-value="id"
          show-clear
          fluid
        />
      </FormField>
      <FormField :label="t('app.signUp.verifyBy')">
        <SelectButton
          v-model="form.channel"
          :options="[
            { value: 'email', label: t('app.profile.email') },
            { value: 'sms', label: t('app.code.sms') },
          ]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <FormField :error="err('accept_terms')">
        <label class="ca-row ca-small terms">
          <Checkbox v-model="form.accept_terms" binary input-id="su-terms" />
          <span>
            {{ t('app.signUp.accept') }}
            <a
              v-if="app.config?.terms_url"
              :href="app.config.terms_url"
              target="_blank"
              rel="noopener"
              >{{ t('app.signUp.terms') }}</a
            >
            <template v-else>{{ t('app.signUp.terms') }}</template>
            {{ t('app.signUp.and') }}
            <a
              v-if="app.config?.privacy_url"
              :href="app.config.privacy_url"
              target="_blank"
              rel="noopener"
              >{{ t('app.signUp.privacy') }}</a
            >
            <template v-else>{{ t('app.signUp.privacy') }}</template>
          </span>
        </label>
      </FormField>
      <Button type="submit" :label="t('app.signUp.submit')" :loading="busy" fluid />
    </form>
    <p class="ca-muted center">
      {{ t('app.signUp.haveAccount') }}
      <RouterLink :to="{ name: 'app.signin' }">{{ t('app.signIn.submit') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.terms {
  align-items: flex-start;
}
.center {
  text-align: center;
}
</style>
