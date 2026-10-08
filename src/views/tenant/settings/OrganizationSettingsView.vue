<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type OrganizationProfile } from '@/api/tenant'
import { statusOf, validationErrors } from '@/lib/http'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = '.png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml'

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const form = ref<OrganizationProfile | null>(null)
const saved = ref<OrganizationProfile | null>(null)
const logoUrl = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const logoBusy = ref(false)
const logoError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()
const canEdit = computed(() => auth.can('settings.update'))
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

const FIELDS = ['name', 'legal_name', 'email', 'phone', 'address', 'website'] as const

function pick(p: OrganizationProfile): OrganizationProfile {
  return Object.fromEntries(
    FIELDS.map((f) => [f, p[f] ?? (f === 'name' ? '' : null)]),
  ) as unknown as OrganizationProfile
}

async function load() {
  state.value = 'loading'
  try {
    const profile = await tenantApi.organizationProfile.get()
    logoUrl.value = profile.logo_url ?? null
    saved.value = pick(profile)
    form.value = pick(profile)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  if (!form.value) return
  saving.value = true
  errors.value = {}
  try {
    const profile = await tenantApi.organizationProfile.update(form.value)
    saved.value = pick(profile)
    form.value = pick(profile)
    await org.load(true) // new name everywhere
    toast.add({ severity: 'success', summary: t('orgProfile.saved'), life: 3000 })
  } catch (e) {
    const v = validationErrors(e)
    errors.value = Object.fromEntries(
      Object.keys(v).map((field) => [field, t(`orgProfile.invalid.${field}`)]),
    )
    if (!Object.keys(v).length) errors.value = { form: t('common.genericError') }
  } finally {
    saving.value = false
  }
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  logoError.value = null
  if (file.size > MAX_BYTES) {
    logoError.value = t('orgProfile.logoTooBig')
    return
  }
  logoBusy.value = true
  try {
    logoUrl.value = (await tenantApi.organizationProfile.uploadLogo(file)).logo_url ?? null
    await org.load(true)
  } catch (e) {
    logoError.value = validationErrors(e).logo
      ? t('orgProfile.logoInvalid')
      : t('common.genericError')
  } finally {
    logoBusy.value = false
  }
}

async function removeLogo() {
  logoBusy.value = true
  logoError.value = null
  try {
    await tenantApi.organizationProfile.deleteLogo()
    logoUrl.value = null
    await org.load(true)
  } catch {
    logoError.value = t('common.genericError')
  } finally {
    logoBusy.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="stack" aria-busy="true" :aria-label="t('common.loading')">
    <div class="card"><Skeleton height="96px" /></div>
    <div class="card"><Skeleton v-for="n in 4" :key="n" height="40px" /></div>
  </div>

  <section v-else-if="state === 'forbidden'" class="card">
    <EmptyState
      icon="pi-lock"
      :title="t('permissions.forbidden')"
      :body="t('permissions.forbiddenHint')"
    />
  </section>

  <section v-else-if="state === 'error' || !form" class="card">
    <EmptyState icon="pi-exclamation-triangle" :title="t('orgProfile.loadError')">
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>
  </section>

  <div v-else class="stack">
    <section class="card">
      <h2>{{ t('orgProfile.logo') }}</h2>
      <div class="logo">
        <div class="logo__preview">
          <img v-if="logoUrl" :src="logoUrl" :alt="t('orgProfile.logoAlt', { name: form.name })" />
          <i v-else class="pi pi-image" aria-hidden="true" />
        </div>
        <div class="logo__text">
          <p>{{ t('orgProfile.logoHint') }}</p>
          <div v-if="canEdit" class="logo__actions">
            <input ref="fileInput" type="file" :accept="ACCEPT" hidden @change="onFile" />
            <Button
              icon="pi pi-upload"
              :label="logoUrl ? t('orgProfile.replaceLogo') : t('orgProfile.uploadLogo')"
              severity="secondary"
              variant="outlined"
              size="small"
              :loading="logoBusy"
              @click="fileInput?.click()"
            />
            <Button
              v-if="logoUrl"
              icon="pi pi-trash"
              :label="t('orgProfile.removeLogo')"
              severity="danger"
              variant="text"
              size="small"
              :disabled="logoBusy"
              @click="removeLogo"
            />
          </div>
          <small v-if="logoError" class="field__error" role="alert">{{ logoError }}</small>
        </div>
      </div>
    </section>

    <form class="card" @submit.prevent="save">
      <h2>{{ t('orgProfile.details') }}</h2>
      <Message v-if="!canEdit" severity="secondary" :closable="false">{{
        t('regional.readOnly')
      }}</Message>
      <Message v-if="errors.form" severity="error" :closable="false" role="alert">{{
        errors.form
      }}</Message>
      <div class="grid">
        <div
          v-for="field in FIELDS"
          :key="field"
          :class="['field', { 'field--wide': field === 'address' }]"
        >
          <label :for="`org-${field}`">
            {{ t(`orgProfile.fields.${field}`)
            }}<span v-if="field === 'name'" aria-hidden="true"> *</span>
          </label>
          <Textarea
            v-if="field === 'address'"
            :id="`org-${field}`"
            v-model="form[field] as string"
            rows="2"
            auto-resize
            :disabled="!canEdit"
            :invalid="!!errors[field]"
            fluid
          />
          <InputText
            v-else
            :id="`org-${field}`"
            v-model="form[field] as string"
            :dir="['email', 'phone', 'website'].includes(field) ? 'ltr' : undefined"
            :type="field === 'email' ? 'email' : field === 'website' ? 'url' : 'text'"
            :disabled="!canEdit"
            :invalid="!!errors[field]"
            fluid
          />
          <small v-if="errors[field]" class="field__error">{{ errors[field] }}</small>
          <small v-else-if="field === 'name'">{{ t('orgProfile.nameHint') }}</small>
        </div>
      </div>
      <div v-if="canEdit" class="footer">
        <span class="audit"
          ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
        >
        <Button
          type="submit"
          :label="t('permissions.save')"
          :disabled="!dirty || !form.name"
          :loading="saving"
        />
      </div>
    </form>

    <RouterLink :to="{ name: 'tenant.settings.regional' }" class="card card--link">
      <i class="pi pi-globe" aria-hidden="true" />
      <span>
        <strong>{{ t('orgProfile.regionalTitle') }}</strong>
        <small>{{ t('orgProfile.regionalHint') }}</small>
      </span>
      <i class="pi pi-angle-right pi-dir" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
.card h2 {
  margin: 0;
  font: var(--text-h3);
}
.logo {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-wrap: wrap;
}
.logo__preview {
  width: 120px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.logo__preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.logo__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 220px;
}
.logo__text p {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.logo__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4) var(--space-5);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field--wide {
  grid-column: 1 / -1;
}
.field label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.field small {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.field small.field__error,
.field__error {
  color: var(--sev-danger-fg);
  font: var(--text-caption);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  color: var(--text-muted);
}
.card--link {
  flex-direction: row;
  align-items: center;
  text-decoration: none;
  color: inherit;
}
.card--link:hover {
  border-color: var(--border-strong);
}
.card--link span {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card--link small {
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
