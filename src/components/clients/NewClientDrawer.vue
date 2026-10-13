<script setup lang="ts">
// New client (US-05.01), as the design's drawer (ui_kits/admin/ClientsScreen.jsx): first and last
// name, mobile and/or email, then optional details. A live duplicate check on mobile and email
// offers to open the existing profile instead. Also the quick-create from booking and POS screens.
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import FormField from '@/components/patterns/FormField.vue'
import PhotoField from '@/components/patterns/PhotoField.vue'
import WhyNotMessage from '@/components/patterns/WhyNotMessage.vue'
import { tenantApi, type Client, type ClientInput, type ClientMatch } from '@/api/tenant'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const visible = defineModel<boolean>('visible', { required: true })
/** Editing an existing client (US-05.05); without it the drawer creates one. */
const props = defineProps<{ client?: Client | null }>()
const emit = defineEmits<{ saved: [client: Client] }>()
const editing = computed(() => !!props.client)
const { t, locale } = useI18n()
const auth = useStaffAuth()
const router = useRouter()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const blank = (): ClientInput & { dob: Date | null } => ({
  first_name: '',
  last_name: '',
  mobile: '',
  email: '',
  date_of_birth: null,
  dob: null,
  gender: null,
  address: '',
  national_id: '',
  preferred_language: null,
  home_location_id: null,
  marketing_consent: false,
})
const form = reactive(blank())
const more = ref(false)
const photo = ref<File | null>(null)
const removePhoto = ref(false)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const matches = ref<ClientMatch[]>([])
const err = (field: string) => errors.value[field]?.[0]

watch(visible, (open) => {
  if (!open) return
  Object.assign(form, blank())
  form.home_location_id = auth.currentLocation?.id ?? auth.user?.switchable_locations[0]?.id ?? null
  const c = props.client
  if (c)
    Object.assign(form, {
      first_name: c.first_name,
      last_name: c.last_name,
      mobile: c.mobile ?? '',
      email: c.email ?? '',
      dob: c.date_of_birth ? new Date(`${c.date_of_birth}T00:00:00`) : null,
      gender: c.gender,
      address: c.address ?? '',
      national_id: c.national_id ?? '',
      preferred_language: c.preferred_language,
      home_location_id: c.home_location?.id ?? null,
      marketing_consent: c.marketing_consent,
    })
  more.value = !!c
  photo.value = null
  errors.value = {}
  formError.value = null
  matches.value = []
})

const branchOptions = computed(() =>
  (auth.user?.switchable_locations ?? []).map((l) => ({ value: l.id, label: l.name })),
)
const branchName = computed(
  () => branchOptions.value.find((b) => b.value === form.home_location_id)?.label ?? '—',
)
const genderOptions = computed(() => [
  { value: 'female', label: t('clients.gender.female') },
  { value: 'male', label: t('clients.gender.male') },
])
const languageOptions = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
]

// Live duplicate check on mobile and email.
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [form.mobile, form.email],
  ([mobile, email]) => {
    clearTimeout(timer)
    const m = (mobile ?? '').replace(/\D/g, '')
    const e = (email ?? '').trim()
    if (m.length < 8 && !/.+@.+\..+/.test(e)) {
      matches.value = []
      return
    }
    timer = setTimeout(async () => {
      matches.value = await tenantApi.clients
        .duplicates({
          mobile: m.length >= 8 ? mobile : null,
          email: /.+@.+\..+/.test(e) ? e : null,
          ignore: props.client?.id ?? null,
        })
        .catch(() => [])
    }, 400)
  },
)
const duplicate = computed(() => matches.value[0] ?? null)

const canSave = computed(
  () =>
    !saving.value &&
    !!form.first_name.trim() &&
    !!form.last_name.trim() &&
    !!(form.mobile?.trim() || form.email?.trim()) &&
    !duplicate.value,
)
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null

async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null)
  try {
    const input = {
      first_name: form.first_name,
      last_name: form.last_name,
      mobile: blankToNull(form.mobile),
      email: blankToNull(form.email),
      date_of_birth: ymd(form.dob),
      gender: form.gender,
      address: blankToNull(form.address),
      national_id: blankToNull(form.national_id),
      preferred_language: form.preferred_language,
      home_location_id: form.home_location_id,
      marketing_consent: form.marketing_consent,
    }
    let client = props.client
      ? await tenantApi.clients.update(props.client.id, input)
      : await tenantApi.clients.create(input)
    if (photo.value)
      client = await tenantApi.clients.uploadPhoto(client.id, photo.value).catch(() => client)
    emit('saved', client)
    visible.value = false
  } catch (e) {
    if (errorCode(e) === 'client_duplicate') {
      matches.value =
        (e as { response?: { data?: { matches?: ClientMatch[] } } }).response?.data?.matches ?? []
    } else {
      errors.value = validationErrors(e)
      formError.value = Object.keys(errors.value).length
        ? t('locationForm.checkFields')
        : (apiMessage(e) ?? t('common.genericError'))
    }
  } finally {
    saving.value = false
  }
}
function openExisting() {
  if (!duplicate.value?.id) return
  visible.value = false
  router.push({ name: 'tenant.client', params: { id: duplicate.value.id } })
}
const maxDob = new Date()
</script>

<template>
  <Drawer v-model:visible="visible" :position="position" :block-scroll="true">
    <template #header>
      <div>
        <div class="head__title">{{ editing ? t('clients.edit') : t('clients.new') }}</div>
        <div class="head__sub">{{ t('clients.homeBranchIs', { name: branchName }) }}</div>
      </div>
    </template>

    <form id="client-form" class="form" @submit.prevent="save">
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
      <div class="grid">
        <FormField
          :label="t('clients.firstName')"
          for="c-first"
          required
          :error="err('first_name')"
        >
          <InputText v-model="form.first_name" id="c-first" autocomplete="off" fluid />
        </FormField>
        <FormField :label="t('clients.lastName')" for="c-last" required :error="err('last_name')">
          <InputText v-model="form.last_name" id="c-last" autocomplete="off" fluid />
        </FormField>
      </div>
      <FormField
        :label="t('clients.mobile')"
        for="c-mobile"
        :help="t('clients.contactHint')"
        :error="err('mobile')"
      >
        <InputGroup dir="ltr">
          <InputGroupAddon>+966</InputGroupAddon>
          <InputText
            v-model="form.mobile"
            id="c-mobile"
            inputmode="tel"
            autocomplete="off"
            placeholder="05X XXX XXXX"
            :invalid="!!err('mobile') || duplicate?.matched_on === 'mobile'"
          />
        </InputGroup>
      </FormField>
      <FormField :label="t('clients.email')" for="c-email" :error="err('email')">
        <InputText
          v-model="form.email"
          id="c-email"
          type="email"
          dir="ltr"
          autocomplete="off"
          :invalid="!!err('email') || duplicate?.matched_on === 'email'"
          fluid
        />
      </FormField>

      <WhyNotMessage
        v-if="duplicate"
        :reason="
          duplicate.matched_on === 'mobile'
            ? t('clients.duplicateMobile')
            : t('clients.duplicateEmail')
        "
        :detail="
          duplicate.visible
            ? `${duplicate.name} (${duplicate.member_id})`
            : t('clients.duplicateHidden')
        "
      >
        <Button
          v-if="duplicate.visible"
          size="small"
          variant="outlined"
          severity="warn"
          :label="t('clients.openProfile')"
          @click="openExisting"
        />
      </WhyNotMessage>

      <div class="grid">
        <FormField :label="t('clients.dob')" for="c-dob" :error="err('date_of_birth')">
          <DatePicker
            v-model="form.dob"
            input-id="c-dob"
            date-format="yy-mm-dd"
            :max-date="maxDob"
            :placeholder="t('clients.pickDate')"
            show-icon
            icon-display="input"
            fluid
          />
        </FormField>
        <FormField :label="t('clients.genderLabel')">
          <SelectButton
            v-model="form.gender"
            :options="genderOptions"
            option-label="label"
            option-value="value"
            fluid
            :aria-label="t('clients.genderLabel')"
          />
        </FormField>
      </div>

      <Button
        variant="text"
        :icon="more ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        :label="t('clients.moreDetails')"
        class="more"
        :aria-expanded="more"
        @click="more = !more"
      />
      <template v-if="more">
        <FormField
          :label="t('clients.homeBranch')"
          for="c-home"
          :help="t('clients.homeBranchHint')"
          :error="err('home_location_id')"
        >
          <Select
            v-model="form.home_location_id"
            input-id="c-home"
            :options="branchOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
        <FormField :label="t('clients.address')" for="c-address" :error="err('address')">
          <InputText v-model="form.address" id="c-address" fluid />
        </FormField>
        <div class="grid">
          <FormField :label="t('clients.nationalId')" for="c-nid" :error="err('national_id')">
            <InputText v-model="form.national_id" id="c-nid" dir="ltr" autocomplete="off" fluid />
          </FormField>
          <FormField :label="t('clients.language')" for="c-lang">
            <Select
              v-model="form.preferred_language"
              input-id="c-lang"
              :options="languageOptions"
              option-label="label"
              option-value="value"
              show-clear
              :placeholder="t('clients.orgDefault')"
              fluid
            />
          </FormField>
        </div>
        <PhotoField
          v-model:file="photo"
          v-model:remove="removePhoto"
          :current-url="null"
          :alt="`${form.first_name} ${form.last_name}`"
        />
        <div class="consent">
          <ToggleSwitch v-model="form.marketing_consent" input-id="c-consent" />
          <label for="c-consent">
            <span class="consent__label">{{ t('clients.consent') }}</span>
            <span class="consent__hint">{{ t('clients.consentHint') }}</span>
          </label>
        </div>
      </template>
    </form>

    <template #footer>
      <div class="footer">
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="client-form"
          :label="t('clients.save')"
          :loading="saving"
          :disabled="!canSave"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.more {
  align-self: flex-start;
}
.consent {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.consent label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.consent__label {
  font: 500 14px var(--font-sans);
}
.consent__hint {
  font: var(--text-small);
  color: var(--text-secondary);
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.footer__spacer {
  flex: 1;
}
@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
