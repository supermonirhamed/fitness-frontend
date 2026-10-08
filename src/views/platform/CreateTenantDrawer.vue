<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { watchDebounced } from '@vueuse/core'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ProgressBar from 'primevue/progressbar'
import {
  CURRENCIES,
  platformApi,
  type NewTenant,
  type SlugAvailability,
  type Tenant,
} from '@/api/platform'
import { tenantDomain } from '@/lib/appContext'
import { slugify } from '@/lib/slug'
import { validationErrors, type ValidationErrors } from '@/lib/http'

const props = defineProps<{ tenant: Tenant | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ updated: [tenant: Tenant] }>()

const { t, locale } = useI18n()

const blank = (): NewTenant => ({
  name: '',
  slug: '',
  owner_name: '',
  owner_email: '',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  locale: 'ar',
})

const form = reactive<NewTenant>(blank())
const slugTouched = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const submitting = ref(false)
const availability = ref<SlugAvailability | null>(null)
const checkingSlug = ref(false)
const current = ref<Tenant | null>(null) // the tenant being provisioned, once created

const timezones = Intl.supportedValuesOf('timeZone')
const languages = [
  { label: 'العربية', value: 'ar' },
  { label: 'English', value: 'en' },
]
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right')) // drawers open from the end side

watch(visible, (open) => {
  if (!open) return stopPolling()
  errors.value = {}
  formError.value = null
  if (props.tenant) {
    current.value = props.tenant
    poll()
  } else {
    current.value = null
    Object.assign(form, blank())
    slugTouched.value = false
    availability.value = null
  }
})

watch(
  () => form.name,
  (name) => {
    if (!slugTouched.value) form.slug = slugify(name)
  },
)

watchDebounced(
  () => form.slug,
  async (slug) => {
    availability.value = null
    if (!slug) return
    checkingSlug.value = true
    try {
      const result = await platformApi.slugAvailability(slug)
      if (result.slug === form.slug) availability.value = result
    } catch {
      // availability is advisory; the server validates on submit
    } finally {
      checkingSlug.value = false
    }
  },
  { debounce: 350 },
)

const slugHint = computed(() => {
  if (errors.value.slug) return { severity: 'error', text: errors.value.slug[0] }
  if (checkingSlug.value) return { severity: 'muted', text: t('platform.create.checking') }
  if (availability.value?.available)
    return { severity: 'success', text: t('platform.create.available') }
  if (availability.value?.reason)
    return { severity: 'error', text: t(`platform.create.reason.${availability.value.reason}`) }
  return { severity: 'muted', text: t('platform.create.slugHelp') }
})

async function submit() {
  submitting.value = true
  errors.value = {}
  formError.value = null
  try {
    current.value = await platformApi.createTenant({ ...form })
    emit('updated', current.value)
    poll()
  } catch (e) {
    errors.value = validationErrors(e)
    if (Object.keys(errors.value).length === 0) formError.value = t('common.genericError')
  } finally {
    submitting.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function stopPolling() {
  clearTimeout(timer)
  timer = undefined
}
function poll() {
  stopPolling()
  if (current.value?.status !== 'Provisioning') return
  timer = setTimeout(async () => {
    try {
      current.value = await platformApi.tenant(current.value!.id)
      emit('updated', current.value)
    } finally {
      if (visible.value) poll()
    }
  }, 2000)
}
onBeforeUnmount(stopPolling)

async function retry() {
  if (!current.value) return
  current.value = await platformApi.retryProvisioning(current.value.id)
  emit('updated', current.value)
  poll()
}

const err = (field: keyof NewTenant) => errors.value[field]?.[0]
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="t('platform.create.title')"
    class="tenant-drawer"
  >
    <!-- Provisioning progress / result -->
    <div v-if="current" class="progress" aria-live="polite">
      <template v-if="current.status === 'Provisioning'">
        <i class="pi pi-spin pi-cog progress__icon progress__icon--info" aria-hidden="true" />
        <h2>{{ t('platform.create.provisioningTitle', { name: current.name }) }}</h2>
        <p>{{ t('platform.create.provisioningBody') }}</p>
        <ProgressBar mode="indeterminate" class="progress__bar" />
      </template>
      <template v-else-if="current.status === 'Active'">
        <i class="pi pi-check-circle progress__icon progress__icon--success" aria-hidden="true" />
        <h2>{{ t('platform.create.activeTitle', { name: current.name }) }}</h2>
        <p>{{ t('platform.create.activeBody', { email: current.owner_email }) }}</p>
        <a
          :href="current.url"
          target="_blank"
          rel="noopener"
          class="ltr-isolate progress__domain"
          >{{ current.domain }}</a
        >
      </template>
      <template v-else-if="current.status === 'Failed'">
        <i class="pi pi-times-circle progress__icon progress__icon--danger" aria-hidden="true" />
        <h2>{{ t('platform.create.failedTitle', { name: current.name }) }}</h2>
        <p>{{ t('platform.create.failedBody') }}</p>
        <Message
          v-if="current.provisioning_error"
          severity="error"
          :closable="false"
          class="progress__error"
        >
          <span class="ltr-isolate">{{ current.provisioning_error }}</span>
        </Message>
      </template>
    </div>

    <!-- Create form -->
    <form v-else id="create-tenant" class="form" novalidate @submit.prevent="submit">
      <Message v-if="formError" severity="error" :closable="false">{{ formError }}</Message>

      <fieldset>
        <legend>{{ t('platform.create.orgSection') }}</legend>
        <div class="field">
          <label for="t-name">{{ t('platform.create.name') }}</label>
          <InputText id="t-name" v-model="form.name" fluid :invalid="!!err('name')" />
          <small v-if="err('name')" class="field__error">{{ err('name') }}</small>
        </div>
        <div class="field">
          <label for="t-slug">{{ t('platform.create.slug') }}</label>
          <div class="slug" dir="ltr">
            <InputText
              id="t-slug"
              v-model.trim="form.slug"
              fluid
              autocapitalize="off"
              spellcheck="false"
              :invalid="slugHint.severity === 'error'"
              @input="slugTouched = true"
            />
            <span class="slug__suffix">.{{ tenantDomain('').slice(1) }}</span>
          </div>
          <small :class="['field__hint', `field__hint--${slugHint.severity}`]">{{
            slugHint.text
          }}</small>
          <small v-if="form.slug" class="field__preview ltr-isolate">{{
            tenantDomain(form.slug)
          }}</small>
        </div>
      </fieldset>

      <fieldset>
        <legend>{{ t('platform.create.ownerSection') }}</legend>
        <div class="field">
          <label for="t-owner">{{ t('platform.create.ownerName') }}</label>
          <InputText id="t-owner" v-model="form.owner_name" fluid :invalid="!!err('owner_name')" />
          <small v-if="err('owner_name')" class="field__error">{{ err('owner_name') }}</small>
        </div>
        <div class="field">
          <label for="t-email">{{ t('platform.create.ownerEmail') }}</label>
          <InputText
            id="t-email"
            v-model.trim="form.owner_email"
            type="email"
            dir="ltr"
            fluid
            :invalid="!!err('owner_email')"
          />
          <small :class="err('owner_email') ? 'field__error' : 'field__hint field__hint--muted'">
            {{ err('owner_email') ?? t('platform.create.ownerHelp') }}
          </small>
        </div>
      </fieldset>

      <fieldset>
        <legend>{{ t('platform.create.defaultsSection') }}</legend>
        <div class="field-row">
          <div class="field">
            <label for="t-currency">{{ t('platform.create.currency') }}</label>
            <Select
              input-id="t-currency"
              v-model="form.currency"
              :options="CURRENCIES"
              fluid
              :invalid="!!err('currency')"
            />
          </div>
          <div class="field">
            <label id="t-lang-label">{{ t('platform.create.language') }}</label>
            <SelectButton
              v-model="form.locale"
              :options="languages"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              aria-labelledby="t-lang-label"
            />
          </div>
        </div>
        <div class="field">
          <label for="t-tz">{{ t('platform.create.timezone') }}</label>
          <Select
            input-id="t-tz"
            v-model="form.timezone"
            :options="timezones"
            filter
            fluid
            :invalid="!!err('timezone')"
          />
          <small class="field__hint field__hint--muted">{{
            err('timezone') ?? t('platform.create.timezoneHelp')
          }}</small>
        </div>
      </fieldset>
    </form>

    <template #footer>
      <div class="footer">
        <template v-if="!current">
          <Button
            severity="secondary"
            variant="text"
            :label="t('common.cancel')"
            @click="visible = false"
          />
          <Button
            type="submit"
            form="create-tenant"
            :label="t('platform.create.submit')"
            :loading="submitting"
          />
        </template>
        <template v-else-if="current.status === 'Failed'">
          <Button
            severity="secondary"
            variant="text"
            :label="t('common.close')"
            @click="visible = false"
          />
          <Button icon="pi pi-replay pi-dir" :label="t('common.retry')" @click="retry" />
        </template>
        <template v-else-if="current.status === 'Active'">
          <Button
            severity="secondary"
            variant="text"
            :label="t('common.close')"
            @click="visible = false"
          />
          <a :href="current.url" target="_blank" rel="noopener">
            <Button
              icon="pi pi-external-link"
              :label="t('platform.create.openWorkspace')"
              tabindex="-1"
            />
          </a>
        </template>
        <Button
          v-else
          severity="secondary"
          variant="text"
          :label="t('common.close')"
          @click="visible = false"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
legend {
  font: var(--text-h4);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  padding: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.field label {
  font: var(--fw-medium) var(--fs-small)/var(--lh-small) var(--font-sans);
}
.field-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.field__error {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--sev-danger-fg);
}
.field__hint {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
}
.field__hint--muted {
  color: var(--text-muted);
}
.field__hint--success {
  color: var(--sev-success-fg);
}
.field__hint--error {
  color: var(--sev-danger-fg);
}
.field__preview {
  font: var(--text-caption);
  color: var(--text-secondary);
}
.slug {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.slug__suffix {
  font: var(--text-small);
  color: var(--text-muted);
  white-space: nowrap;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-4);
}
.progress h2 {
  margin: var(--space-2) 0 0;
  font: var(--text-h3);
}
.progress p {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.progress__icon {
  font-size: 32px;
}
.progress__icon--info {
  color: var(--sev-info-solid);
}
.progress__icon--success {
  color: var(--sev-success-solid);
}
.progress__icon--danger {
  color: var(--sev-danger-solid);
}
.progress__bar {
  width: 100%;
  height: 4px;
  margin-top: var(--space-4);
}
.progress__domain {
  margin-top: var(--space-2);
}
.progress__error {
  width: 100%;
  margin-top: var(--space-3);
  text-align: start;
}
</style>

<style>
.tenant-drawer.p-drawer {
  width: var(--drawer-w);
  max-width: 100vw;
}
</style>
