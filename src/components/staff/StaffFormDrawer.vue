<script setup lang="ts">
// Add or edit a staff member (US-09.01): name, contact, roles, branches, employment type and
// whether they sign in (invited by email) or only appear on rosters; coaches also get a public
// profile (bio in Arabic and English, specialties, certifications with expiry, show on the app).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type StaffInput, type StaffMember } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ member: StaffMember | null; roles: string[] }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [member: StaffMember] }>()
const { t, te } = useI18n()
const auth = useStaffAuth()
const branches = computed(() => auth.user?.switchable_locations ?? [])
const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)

type Form = Required<Omit<StaffInput, 'certifications'>> & {
  certifications: { name: string; expires_on: Date | null }[]
}
const empty = (): Form => ({
  name: '',
  email: '',
  phone: '',
  employment_type: 'employee',
  has_login: true,
  roles: [],
  all_locations: false,
  location_ids: [],
  bio: { ar: '', en: '' },
  specialties: [],
  certifications: [],
  show_on_app: false,
})
const form = ref<Form>(empty())
const specialty = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})

watch(visible, (open) => {
  if (!open) return
  error.value = null
  errors.value = {}
  specialty.value = ''
  const m = props.member
  form.value = m
    ? {
        name: m.name,
        email: m.email ?? '',
        phone: m.phone ?? '',
        employment_type: m.employment_type,
        has_login: m.has_login,
        roles: [...m.roles],
        all_locations: m.all_locations,
        location_ids: [...m.location_ids],
        bio: { ar: m.bio.ar ?? '', en: m.bio.en ?? '' },
        specialties: [...m.specialties],
        certifications: m.certifications.map((c) => ({
          name: c.name,
          expires_on: c.expires_on ? new Date(`${c.expires_on}T00:00:00`) : null,
        })),
        show_on_app: m.show_on_app,
      }
    : empty()
})
const isCoach = computed(() =>
  form.value.roles.some((r) => ['Coach', 'Personal Trainer'].includes(r)),
)
const roleOptions = computed(() =>
  props.roles
    .filter((r) => r !== 'Organization Owner')
    .map((r) => ({ value: r, label: roleLabel(r) })),
)
const employmentOptions = computed(() =>
  (['employee', 'contractor'] as const).map((v) => ({
    value: v,
    label: t(`staffForm.employment.${v}`),
  })),
)
function addSpecialty() {
  const value = specialty.value.trim()
  if (value && !form.value.specialties.includes(value)) form.value.specialties.push(value)
  specialty.value = ''
}

async function save() {
  saving.value = true
  error.value = null
  errors.value = {}
  const input: StaffInput = {
    ...form.value,
    email: form.value.email?.trim() || null,
    phone: form.value.phone?.trim() || null,
    bio: { ar: form.value.bio.ar?.trim() || null, en: form.value.bio.en?.trim() || null },
    certifications: form.value.certifications
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        expires_on: c.expires_on ? isoDay(c.expires_on) : null,
      })),
    ...(props.member?.owner ? { roles: undefined } : {}),
  }
  try {
    const saved = props.member
      ? await tenantApi.staff.update(props.member.id, input)
      : await tenantApi.staff.create(input)
    visible.value = false
    emit('saved', saved)
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = apiMessage(e) ?? Object.values(errors.value)[0]?.[0] ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="member ? t('staffForm.editTitle', { name: member.name }) : t('staffForm.newTitle')"
    size="lg"
    :save-label="
      member
        ? t('common.save')
        : form.has_login
          ? t('staffForm.createInvite')
          : t('staffForm.create')
    "
    :saving="saving"
    :save-disabled="!form.name.trim() || (!member?.owner && !form.roles.length)"
    :error="error"
    @save="save"
  >
    <div class="grid">
      <FormField :label="t('staffForm.name')" for="staff-name" required :error="errors.name?.[0]">
        <InputText id="staff-name" v-model="form.name" maxlength="120" fluid />
      </FormField>
      <FormField :label="t('staffForm.phone')" for="staff-phone" :error="errors.phone?.[0]">
        <InputText id="staff-phone" v-model="form.phone" dir="ltr" maxlength="30" fluid />
      </FormField>
      <FormField
        :label="t('staffForm.email')"
        for="staff-email"
        :required="form.has_login"
        :error="errors.email?.[0]"
      >
        <InputText id="staff-email" v-model="form.email" type="email" dir="ltr" fluid />
      </FormField>
      <FormField :label="t('staffForm.employmentType')" for="staff-employment">
        <SelectButton
          v-model="form.employment_type"
          :options="employmentOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
    </div>
    <label class="toggle">
      <ToggleSwitch v-model="form.has_login" input-id="staff-login" />
      <span>
        <strong>{{ t('staffForm.hasLogin') }}</strong>
        <small class="muted">{{
          form.has_login ? t('staffForm.hasLoginHint') : t('staffForm.noLoginHint')
        }}</small>
      </span>
    </label>

    <div class="grid">
      <FormField
        v-if="!member?.owner"
        :label="t('staffForm.roles')"
        for="staff-roles"
        required
        :error="errors.roles?.[0]"
      >
        <MultiSelect
          v-model="form.roles"
          input-id="staff-roles"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          display="chip"
          fluid
        />
      </FormField>
      <FormField :label="t('staffForm.branches')" for="staff-branches">
        <MultiSelect
          v-model="form.location_ids"
          input-id="staff-branches"
          :options="branches"
          option-label="name"
          option-value="id"
          display="chip"
          :disabled="form.all_locations"
          fluid
        />
      </FormField>
    </div>
    <label class="toggle">
      <ToggleSwitch v-model="form.all_locations" input-id="staff-all" />
      <span>{{ t('access.all') }}</span>
    </label>

    <fieldset v-if="isCoach" class="coach">
      <legend>{{ t('staffForm.coachProfile') }}</legend>
      <div class="grid">
        <FormField :label="t('staffForm.bioEn')" for="staff-bio-en">
          <Textarea
            id="staff-bio-en"
            v-model="form.bio.en"
            rows="3"
            maxlength="2000"
            dir="ltr"
            fluid
          />
        </FormField>
        <FormField :label="t('staffForm.bioAr')" for="staff-bio-ar">
          <Textarea
            id="staff-bio-ar"
            v-model="form.bio.ar"
            rows="3"
            maxlength="2000"
            dir="rtl"
            fluid
          />
        </FormField>
      </div>
      <FormField :label="t('staffForm.specialties')" for="staff-specialty">
        <div class="chips">
          <span v-for="(s, i) in form.specialties" :key="s" class="chip">
            {{ s }}
            <button
              type="button"
              :aria-label="t('staffForm.remove')"
              @click="form.specialties.splice(i, 1)"
            >
              <i class="pi pi-times" aria-hidden="true" />
            </button>
          </span>
          <InputText
            id="staff-specialty"
            v-model="specialty"
            :placeholder="t('staffForm.addSpecialty')"
            maxlength="60"
            size="small"
            @keydown.enter.prevent="addSpecialty"
            @blur="addSpecialty"
          />
        </div>
      </FormField>
      <div class="certs">
        <span class="certs__title">{{ t('staffForm.certifications') }}</span>
        <div v-for="(c, i) in form.certifications" :key="i" class="cert">
          <InputText
            v-model="c.name"
            :placeholder="t('staffForm.certName')"
            maxlength="120"
            :aria-label="t('staffForm.certName')"
          />
          <DatePicker
            v-model="c.expires_on"
            :placeholder="t('staffForm.certExpires')"
            show-icon
            icon-display="input"
            :aria-label="t('staffForm.certExpires')"
          />
          <Button
            icon="pi pi-trash"
            variant="text"
            severity="secondary"
            :aria-label="t('staffForm.remove')"
            @click="form.certifications.splice(i, 1)"
          />
        </div>
        <Button
          :label="t('staffForm.addCertification')"
          icon="pi pi-plus"
          variant="text"
          size="small"
          @click="form.certifications.push({ name: '', expires_on: null })"
        />
      </div>
      <label class="toggle">
        <ToggleSwitch v-model="form.show_on_app" input-id="staff-app" />
        <span>{{ t('staffForm.showOnApp') }}</span>
      </label>
    </fieldset>
  </FormDrawer>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px 16px;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toggle span {
  display: flex;
  flex-direction: column;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.coach {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}
.coach legend {
  font: var(--text-h4);
  padding: 0 4px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-hover, #f1f5f9);
  font: var(--text-small);
}
.chip button {
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-muted);
}
.certs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.certs__title {
  font: 500 13px var(--font-sans);
}
.cert {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
