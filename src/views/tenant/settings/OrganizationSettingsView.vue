<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Textarea from 'primevue/textarea'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FileUploadBox from '@/components/patterns/FileUploadBox.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
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
const canEdit = computed(() => auth.can('settings.update'))
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved.value))

const FIELDS = ['name', 'legal_name', 'email', 'phone', 'address', 'website'] as const
const CONTACT = [
  { key: 'phone', icon: 'pi-phone', type: 'tel' },
  { key: 'email', icon: 'pi-envelope', type: 'email' },
] as const

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

function discard() {
  form.value = saved.value ? { ...saved.value } : null
  errors.value = {}
}

async function onFile(file: File) {
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
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <div v-for="n in 5" :key="n" class="skeleton-row">
      <Skeleton width="40%" /><Skeleton height="36px" />
    </div>
  </SettingsCard>

  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>

  <SettingsCard v-else-if="state === 'error' || !form">
    <ErrorState :title="t('orgProfile.loadError')" @retry="load" />
  </SettingsCard>

  <form v-else @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false" class="note">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="errors.form" severity="error" :closable="false" role="alert" class="note">{{
      errors.form
    }}</Message>
    <SettingsCard>
      <SettingRow :label="t('orgProfile.logo')" :help="t('orgProfile.logoHelp')">
        <FileUploadBox
          :preview-url="logoUrl"
          :alt="t('orgProfile.logoAlt', { name: form.name })"
          :label="t('orgProfile.uploadLogo')"
          :hint="t('orgProfile.logoFileHint')"
          :error="logoError"
          :accept="ACCEPT"
          :busy="logoBusy"
          :disabled="!canEdit"
          @select="onFile"
          @remove="removeLogo"
        />
      </SettingRow>

      <SettingRow
        :label="t('orgProfile.fields.name')"
        :help="t('orgProfile.nameHint')"
        label-for="org-name"
      >
        <InputText
          id="org-name"
          v-model="form.name"
          :disabled="!canEdit"
          :invalid="!!errors.name"
          aria-required="true"
          fluid
        />
        <small v-if="errors.name" class="field__error">{{ errors.name }}</small>
      </SettingRow>

      <SettingRow
        :label="t('orgProfile.fields.legal_name')"
        :help="t('orgProfile.legalHelp')"
        label-for="org-legal_name"
      >
        <InputText
          id="org-legal_name"
          v-model="form.legal_name as string"
          :disabled="!canEdit"
          :invalid="!!errors.legal_name"
          fluid
        />
        <small v-if="errors.legal_name" class="field__error">{{ errors.legal_name }}</small>
      </SettingRow>

      <SettingRow :label="t('orgProfile.contact')">
        <template v-for="field in CONTACT" :key="field.key">
          <IconField>
            <InputIcon :class="['pi', field.icon]" />
            <InputText
              :id="`org-${field.key}`"
              v-model="form[field.key] as string"
              dir="ltr"
              :type="field.type"
              :placeholder="t(`orgProfile.fields.${field.key}`)"
              :aria-label="t(`orgProfile.fields.${field.key}`)"
              :disabled="!canEdit"
              :invalid="!!errors[field.key]"
              fluid
            />
          </IconField>
          <small v-if="errors[field.key]" class="field__error">{{ errors[field.key] }}</small>
        </template>
      </SettingRow>

      <SettingRow :label="t('orgProfile.fields.website')" label-for="org-website">
        <IconField>
          <InputIcon class="pi pi-link" />
          <InputText
            id="org-website"
            v-model="form!.website as string"
            dir="ltr"
            type="url"
            placeholder="https://"
            :disabled="!canEdit"
            :invalid="!!errors.website"
            fluid
          />
        </IconField>
        <small v-if="errors.website" class="field__error">{{ errors.website }}</small>
      </SettingRow>

      <SettingRow
        :label="t('orgProfile.fields.address')"
        :help="t('orgProfile.addressHelp')"
        label-for="org-address"
      >
        <Textarea
          id="org-address"
          v-model="form!.address as string"
          rows="2"
          auto-resize
          :disabled="!canEdit"
          :invalid="!!errors.address"
          fluid
        />
        <small v-if="errors.address" class="field__error">{{ errors.address }}</small>
      </SettingRow>
    </SettingsCard>

    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      :save-disabled="!form!.name"
      @discard="discard"
      @save="save"
    />
  </form>
</template>

<style scoped>
.note {
  margin-bottom: 12px;
}
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
}
.field__error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
