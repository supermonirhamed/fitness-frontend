<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { tenantApi } from '@/api/tenant'
import { resolveLocale, setLocale, type Locale } from '@/i18n'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()

type Choice = Locale | 'organization'
const choice = ref<Choice>(auth.user?.locale ?? 'organization')
watch(
  () => auth.user?.locale,
  (locale) => (choice.value = locale ?? 'organization'),
)

const organizationLanguage = computed(() =>
  t(`profile.languages.${org.organization?.locale ?? 'ar'}`),
)
const changed = computed(() => choice.value !== (auth.user?.locale ?? 'organization'))
const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  saving.value = true
  error.value = null
  try {
    const locale = choice.value === 'organization' ? null : choice.value
    const user = await tenantApi.updateProfile({ locale })
    auth.user!.locale = user.locale
    setLocale(
      resolveLocale({ signedIn: true, user: user.locale, organization: org.organization?.locale }),
      true,
    )
    toast.add({ severity: 'success', summary: t('profile.saved'), life: 3000 })
  } catch {
    error.value = t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile">
    <PageHeader :title="t('profile.title')" :subtitle="t('profile.subtitle')" />

    <section class="card">
      <h2>{{ t('profile.account') }}</h2>
      <div class="grid">
        <div class="field">
          <label for="profile-name">{{ t('profile.name') }}</label>
          <InputText id="profile-name" :model-value="auth.user?.name" readonly fluid />
        </div>
        <div class="field">
          <label for="profile-email">{{ t('tenantApp.signIn.email') }}</label>
          <InputText id="profile-email" :model-value="auth.user?.email" dir="ltr" readonly fluid />
        </div>
      </div>
    </section>

    <form class="card" @submit.prevent="save">
      <fieldset class="languages">
        <legend>{{ t('profile.language') }}</legend>
        <p class="muted">{{ t('profile.languageHint') }}</p>
        <label class="choice">
          <RadioButton v-model="choice" value="organization" input-id="lang-org" />
          <span>{{ t('profile.organizationDefault', { language: organizationLanguage }) }}</span>
        </label>
        <label class="choice">
          <RadioButton v-model="choice" value="ar" input-id="lang-ar" />
          <span lang="ar">العربية</span>
        </label>
        <label class="choice">
          <RadioButton v-model="choice" value="en" input-id="lang-en" />
          <span lang="en">English</span>
        </label>
      </fieldset>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="actions">
        <Button
          type="submit"
          :label="t('permissions.save')"
          :disabled="!changed"
          :loading="saving"
        />
      </div>
    </form>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.card h2,
.languages legend {
  margin: 0;
  padding: 0;
  font: var(--text-h3);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.languages {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.choice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
