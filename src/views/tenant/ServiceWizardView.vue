<script setup lang="ts">
// New service as the design's 6-step wizard (ui_kits/admin/ServiceWizard.jsx): type, basics,
// defaults, where & who, booking & payment, review → save as draft or publish. Same API as the
// edit drawer (US-02.02/03/05/06/08); errors from the server send you back to their step.
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import BranchChips from '@/components/patterns/BranchChips.vue'
import FormField from '@/components/patterns/FormField.vue'
import FileUploadBox from '@/components/patterns/FileUploadBox.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import WizardSteps from '@/components/patterns/WizardSteps.vue'
import ColorPickerField from '@/components/services/ColorPickerField.vue'
import {
  ACTIVITY_TYPES,
  tenantApi,
  type ActivityType,
  type BookingPolicy,
  type Facility,
  type Location,
  type ServiceCategory,
  type ServiceInput,
  type ServiceLocation,
  type ServiceStatus,
  type StaffOption,
} from '@/api/tenant'
import { ACTIVITY_ICONS, activityKey, emptyTranslated } from '@/lib/catalog'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const { t, te } = useI18n()
const router = useRouter()
const toast = useToast()
const fmt = useFormat()

const STEPS = ['type', 'basics', 'defaults', 'where', 'payment', 'review'] as const
const step = ref(0)
const stepLabels = computed(() => STEPS.map((s) => t(`wizard.steps.${s}`)))

const categories = ref<ServiceCategory[]>([])
const locations = ref<Location[]>([])
const facilities = ref<Facility[]>([])
const staffOptions = ref<StaffOption[]>([])
const orgPolicy = ref<BookingPolicy | null>(null)

const form = reactive<ServiceInput>({
  name: emptyTranslated(),
  description: emptyTranslated(),
  activity_type: 'Class',
  category_id: null,
  default_duration: 60,
  default_capacity: 15,
  buffer_before: 0,
  buffer_after: 0,
  allow_membership: false,
  allow_package: false,
  allow_drop_in: true,
  is_free: false,
  credit_cost: 1,
  color: null,
  skill_level: 'All',
  age_min: null,
  age_max: null,
  gender: 'Any',
  equipment_notes: null,
  locations: [],
})
const branchIds = ref<number[]>([])
const capacityAt = reactive<Record<number, number | null>>({})
const staffIds = ref<number[]>([])
const facilityIds = ref<number[]>([])
const photo = ref<File | null>(null)
const photoPreview = ref<string | null>(null)

onMounted(async () => {
  const [cats, locs, facs, staff, policy] = await Promise.allSettled([
    tenantApi.serviceCategories.list(),
    tenantApi.locations(),
    tenantApi.facilities.list(),
    tenantApi.services.staffOptions(),
    tenantApi.bookingPolicy.get(),
  ])
  if (cats.status === 'fulfilled') categories.value = cats.value.filter((c) => !c.archived_at)
  if (locs.status === 'fulfilled') locations.value = locs.value
  if (facs.status === 'fulfilled') facilities.value = facs.value
  if (staff.status === 'fulfilled') staffOptions.value = staff.value
  if (policy.status === 'fulfilled') orgPolicy.value = policy.value.data
  form.category_id = categories.value[0]?.id ?? null
  if (locations.value.length === 1) branchIds.value = [locations.value[0]!.id]
})

const openAccess = computed(() => form.activity_type === 'Open Access')
const nameMissing = computed(() => !form.name.ar?.trim() || !form.name.en?.trim())
const category = computed(() => categories.value.find((c) => c.id === form.category_id))

// Step 1: type cards
const TYPE_KEYS = computed(() => ACTIVITY_TYPES.map((type) => ({ type, key: activityKey(type) })))

// Step 1: basics
const categoryOptions = computed(() =>
  categories.value.map((c) => ({ value: c.id, label: c.display_name ?? '', icon: c.icon })),
)
const skillOptions = computed(() =>
  (['Beginner', 'Intermediate', 'Advanced', 'All'] as const).map((s) => ({
    value: s,
    label: t(`catalog.skill.${s}`),
  })),
)
const genderOptions = computed(() =>
  (['Any', 'Male', 'Female'] as const).map((g) => ({ value: g, label: t(`catalog.gender.${g}`) })),
)
function onPhoto(file: File) {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = file
  photoPreview.value = URL.createObjectURL(file)
}
function clearPhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = null
  photoPreview.value = null
}

// Step 3: where & who — capacity per branch, limited by the largest facility there.
const branchOptions = computed(() => locations.value.map((l) => ({ value: l.id, label: l.name })))
const chosenBranches = computed(() => locations.value.filter((l) => branchIds.value.includes(l.id)))
const largestFacility = (locationId: number) =>
  Math.max(
    0,
    ...facilities.value.filter((f) => f.location_id === locationId).map((f) => f.capacity),
  )
const capacityOf = (id: number) => capacityAt[id] ?? form.default_capacity
const facilityOptions = computed(() =>
  facilities.value
    .filter((f) => branchIds.value.includes(f.location_id))
    .map((f) => ({ value: f.id, label: `${f.name} · ${f.location?.name ?? ''}` })),
)
const roleName = (role: string) => (te(`roles.${role}`) ? t(`roles.${role}`) : role)

// Step 4: payment (US-02.08) — free excludes paid options; at least one is required.
const PAY = ['allow_membership', 'allow_package', 'allow_drop_in', 'is_free'] as const
const payOk = computed(() => PAY.some((k) => form[k]))
function setPay(key: (typeof PAY)[number], on: boolean) {
  form[key] = on
  if (key === 'is_free' && on) PAY.slice(0, 3).forEach((k) => (form[k] = false))
  else if (on) form.is_free = false
}
const rulesOpen = ref(false)
const policyLines = computed(() => {
  const p = orgPolicy.value
  if (!p) return []
  const penalty = (value: BookingPolicy['late_cancel_penalty'], fee: number | null) =>
    value === 'fixed_fee' && fee !== null
      ? `${t('bookingPolicy.penalties.fixed_fee')} · ${fmt.money(fee)}`
      : t(`bookingPolicy.penalties.${value}`)
  return [
    [
      t('bookingPolicy.fields.booking_opens_days'),
      t('bookingPolicy.units.days', { n: p.booking_opens_days }, p.booking_opens_days),
    ],
    [
      t('bookingPolicy.fields.booking_closes_minutes'),
      t('bookingPolicy.units.minutes', { n: p.booking_closes_minutes }, p.booking_closes_minutes),
    ],
    [
      t('bookingPolicy.fields.cancellation_window_hours'),
      t(
        'bookingPolicy.units.hours',
        { n: p.cancellation_window_hours },
        p.cancellation_window_hours,
      ),
    ],
    [
      t('bookingPolicy.fields.late_cancel_penalty'),
      penalty(p.late_cancel_penalty, p.late_cancel_fee),
    ],
    [t('bookingPolicy.fields.no_show_penalty'), penalty(p.no_show_penalty, p.no_show_fee)],
    [t('bookingPolicy.fields.waitlist_mode'), t(`bookingPolicy.modes.${p.waitlist_mode}`)],
  ]
})

// Review
const payLabels = computed(() =>
  PAY.filter((k) => form[k])
    .map((k) => t(`catalog.pay.${k}`))
    .join('، '),
)
const defaultsLine = computed(() =>
  openAccess.value
    ? '—'
    : [
        t('catalog.minShort', { n: form.default_duration ?? 0 }),
        t('catalog.people', form.default_capacity ?? 0),
        form.buffer_after ? t('wizard.bufferAfterShort', { n: form.buffer_after }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
)
const staffNames = computed(
  () =>
    staffOptions.value
      .filter((s) => staffIds.value.includes(s.id))
      .map((s) => s.name)
      .join('، ') || t('catalog.anyStaff'),
)

// Save
const saving = ref<ServiceStatus | null>(null)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const err = (field: string) => errors.value[field]?.[0]
const STEP_OF: [RegExp, number][] = [
  [/^(name|description|category_id|color|skill_level|age_|gender|equipment)/, 1],
  [/^(default_|buffer_)/, 2],
  [/^(locations|staff_ids|facility_ids)/, 3],
  [/^(allow_|is_free|credit_cost)/, 4],
]
function stepOfError(): number | null {
  const steps = Object.keys(errors.value).map(
    (key) => STEP_OF.find(([re]) => re.test(key))?.[1] ?? null,
  )
  const known = steps.filter((s): s is number => s !== null)
  return known.length ? Math.min(...known) : null
}

async function save(status: ServiceStatus) {
  saving.value = status
  errors.value = {}
  formError.value = null
  const links: ServiceLocation[] = chosenBranches.value.map((l) => ({
    location_id: l.id,
    capacity_override:
      openAccess.value || capacityAt[l.id] == null || capacityAt[l.id] === form.default_capacity
        ? null
        : capacityAt[l.id]!,
    price_override: null,
  }))
  const input: ServiceInput = {
    ...form,
    status,
    default_duration: openAccess.value ? form.default_duration : form.default_duration,
    default_capacity: openAccess.value ? null : form.default_capacity,
    locations: links,
    staff_ids: staffIds.value,
    facility_ids: facilityIds.value.filter((id) =>
      facilityOptions.value.some((o) => o.value === id),
    ),
  }
  try {
    let saved = await tenantApi.services.create(input)
    if (photo.value) {
      try {
        saved = await tenantApi.services.uploadPhoto(saved.id, photo.value)
      } catch {
        toast.add({ severity: 'warn', summary: t('locationForm.photoInvalid'), life: 5000 })
      }
    }
    toast.add({
      severity: 'success',
      summary: t(status === 'Published' ? 'wizard.published' : 'wizard.savedDraft'),
      life: 3000,
    })
    router.replace({ name: 'tenant.services.show', params: { id: saved.id } })
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
    const back = stepOfError()
    if (back !== null) step.value = back
  } finally {
    saving.value = null
  }
}

const canNext = computed(() => {
  if (step.value === 1)
    return !!form.category_id && !!(form.name.ar?.trim() || form.name.en?.trim())
  if (step.value === 3) return branchIds.value.length > 0
  if (step.value === 4) return payOk.value
  return true
})
</script>

<template>
  <div class="wizard">
    <PageHeader
      :title="t('catalog.newService')"
      :breadcrumb="[
        { label: t('catalog.title'), to: { name: 'tenant.services' } },
        { label: t('catalog.newService') },
      ]"
    />

    <div class="card card--steps">
      <WizardSteps :steps="stepLabels" :active="step" @go="step = $event" />
    </div>

    <Message v-if="formError" severity="error" :closable="false" role="alert">{{
      formError
    }}</Message>

    <!-- 1. Type -->
    <div v-if="step === 0" class="types" role="radiogroup" :aria-label="t('catalog.activityType')">
      <button
        v-for="{ type, key } in TYPE_KEYS"
        :key="type"
        type="button"
        role="radio"
        :aria-checked="form.activity_type === type"
        :class="['type', { 'type--on': form.activity_type === type }]"
        @click="form.activity_type = type as ActivityType"
      >
        <span class="type__icon"
          ><i :class="['pi', ACTIVITY_ICONS[type]]" aria-hidden="true"
        /></span>
        <span class="type__title">{{ t(`catalog.types.${key}`) }}</span>
        <span class="type__text">{{ t(`wizard.typeInfo.${key}`) }}</span>
        <span class="type__example">{{ t(`wizard.typeExample.${key}`) }}</span>
      </button>
    </div>

    <!-- 2. Basics -->
    <div v-else-if="step === 1" class="card">
      <div class="grid2">
        <FormField
          :label="t('wizard.nameAr')"
          for="w-name-ar"
          required
          :error="err('name.ar') ?? err('name')"
        >
          <InputText id="w-name-ar" v-model="form.name.ar" dir="rtl" maxlength="120" fluid />
        </FormField>
        <FormField :label="t('wizard.nameEn')" for="w-name-en" required :error="err('name.en')">
          <InputText
            id="w-name-en"
            v-model="form.name.en"
            dir="ltr"
            maxlength="120"
            :invalid="!form.name.en?.trim()"
            fluid
          />
        </FormField>
      </div>
      <Message v-if="nameMissing" severity="warn" icon="pi pi-language" :closable="false">{{
        t('wizard.nameBoth')
      }}</Message>
      <div class="grid2">
        <FormField
          :label="t('catalog.category')"
          for="w-category"
          required
          :error="err('category_id')"
        >
          <Select
            v-model="form.category_id"
            input-id="w-category"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            fluid
          >
            <template #option="{ option }">
              <span class="option"
                ><i :class="['pi', option.icon]" aria-hidden="true" />{{ option.label }}</span
              >
            </template>
          </Select>
        </FormField>
        <FormField
          :label="t('wizard.colour')"
          :help="form.color ? undefined : t('wizard.colourHint')"
        >
          <ColorPickerField id="w-color" v-model="form.color" allow-none />
        </FormField>
      </div>
      <div class="grid2">
        <FormField :label="t('wizard.descriptionAr')" for="w-desc-ar">
          <Textarea id="w-desc-ar" v-model="form.description!.ar" dir="rtl" rows="3" fluid />
        </FormField>
        <FormField :label="t('wizard.descriptionEn')" for="w-desc-en">
          <Textarea id="w-desc-en" v-model="form.description!.en" dir="ltr" rows="3" fluid />
        </FormField>
      </div>
      <FormField :label="t('wizard.image')">
        <FileUploadBox
          :preview-url="photoPreview"
          :label="t('wizard.uploadImage')"
          :hint="t('locationForm.photoHint')"
          accept="image/png,image/jpeg,image/webp"
          @select="onPhoto"
          @remove="clearPhoto"
        />
      </FormField>
      <div class="grid3">
        <FormField :label="t('catalog.skillLevel')" for="w-level">
          <Select
            v-model="form.skill_level"
            input-id="w-level"
            :options="skillOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
        <FormField :label="t('catalog.ageRange')" :error="err('age_min') ?? err('age_max')">
          <div class="range">
            <InputNumber
              v-model="form.age_min"
              :min="0"
              :max="120"
              :aria-label="t('catalog.ageFrom')"
              fluid
            />
            <span aria-hidden="true">–</span>
            <InputNumber
              v-model="form.age_max"
              :min="0"
              :max="120"
              :placeholder="t('wizard.any')"
              :aria-label="t('catalog.ageTo')"
              fluid
            />
          </div>
        </FormField>
        <FormField :label="t('catalog.genderLabel')">
          <SelectButton
            v-model="form.gender"
            :options="genderOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            fluid
            :aria-label="t('catalog.genderLabel')"
          />
        </FormField>
      </div>
    </div>

    <!-- 3. Defaults -->
    <div v-else-if="step === 2" class="card">
      <Message v-if="openAccess" severity="info" :closable="false">{{
        t('wizard.openAccessNote')
      }}</Message>
      <div v-else class="grid2">
        <FormField
          :label="t('catalog.columns.duration')"
          for="w-duration"
          :error="err('default_duration')"
        >
          <InputNumber
            v-model="form.default_duration"
            input-id="w-duration"
            :min="5"
            :max="1440"
            :step="15"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            fluid
          />
        </FormField>
        <FormField :label="t('catalog.capacity')" for="w-capacity" :error="err('default_capacity')">
          <InputNumber
            v-model="form.default_capacity"
            input-id="w-capacity"
            :min="1"
            :max="1000"
            :suffix="` ${t('wizard.people')}`"
            show-buttons
            fluid
          />
        </FormField>
        <FormField :label="t('catalog.bufferBefore')" for="w-before" :help="t('wizard.bufferHint')">
          <InputNumber
            v-model="form.buffer_before"
            input-id="w-before"
            :min="0"
            :max="240"
            :step="5"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            fluid
          />
        </FormField>
        <FormField :label="t('catalog.bufferAfter')" for="w-after" :help="t('wizard.bufferHint')">
          <InputNumber
            v-model="form.buffer_after"
            input-id="w-after"
            :min="0"
            :max="240"
            :step="5"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            fluid
          />
        </FormField>
      </div>
    </div>

    <!-- 4. Where & who -->
    <div v-else-if="step === 3" class="card">
      <FormField
        :label="t('catalog.columns.branches')"
        for="w-branches"
        required
        :error="err('locations')"
      >
        <MultiSelect
          v-model="branchIds"
          input-id="w-branches"
          :options="branchOptions"
          option-label="label"
          option-value="value"
          display="chip"
          fluid
        />
      </FormField>
      <div v-if="!openAccess && chosenBranches.length" class="sub-table">
        <div class="sub-table__head">{{ t('wizard.capacityPerBranch') }}</div>
        <div v-for="l in chosenBranches" :key="l.id" class="sub-table__row">
          <div>
            <div class="sub-table__name">{{ l.name }}</div>
            <div
              v-if="largestFacility(l.id)"
              :class="[
                'sub-table__hint',
                { 'sub-table__hint--bad': (capacityOf(l.id) ?? 0) > largestFacility(l.id) },
              ]"
            >
              {{ t('wizard.maxFacility', { n: largestFacility(l.id) }) }}
            </div>
          </div>
          <InputNumber
            :model-value="capacityOf(l.id)"
            :min="1"
            :max="1000"
            :invalid="!!largestFacility(l.id) && (capacityOf(l.id) ?? 0) > largestFacility(l.id)"
            :aria-label="t('catalog.capacityAt', { branch: l.name })"
            @update:model-value="capacityAt[l.id] = $event"
          />
        </div>
      </div>
      <FormField :label="t('wizard.eligibleStaff')" for="w-staff" :help="t('catalog.staffHint')">
        <MultiSelect
          v-model="staffIds"
          input-id="w-staff"
          :options="staffOptions"
          option-label="name"
          option-value="id"
          :placeholder="t('catalog.anyStaff')"
          filter
          display="chip"
          fluid
        >
          <template #option="{ option }">
            <span class="option"
              >{{ option.name }}
              <small class="muted">{{ option.roles.map(roleName).join('، ') }}</small></span
            >
          </template>
        </MultiSelect>
      </FormField>
      <FormField
        :label="t('wizard.linkedFacilities')"
        for="w-facilities"
        :help="t('wizard.facilitiesHint')"
      >
        <MultiSelect
          v-model="facilityIds"
          input-id="w-facilities"
          :options="facilityOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('catalog.noFacilities')"
          display="chip"
          fluid
        />
      </FormField>
    </div>

    <!-- 5. Booking & payment -->
    <div v-else-if="step === 4" class="card">
      <FormField
        :label="t('wizard.acceptedWith')"
        required
        :error="!payOk ? t('wizard.payOne') : (err('allow_drop_in') ?? err('is_free'))"
      >
        <div class="checks">
          <label v-for="key in PAY" :key="key" class="check">
            <Checkbox
              :model-value="form[key]"
              binary
              :invalid="!payOk"
              @update:model-value="setPay(key, $event)"
            />
            {{ t(`catalog.pay.${key}`) }}
          </label>
        </div>
      </FormField>
      <FormField
        v-if="form.allow_membership || form.allow_package"
        :label="t('catalog.creditCost')"
        for="w-credits"
        :error="err('credit_cost')"
      >
        <InputNumber
          v-model="form.credit_cost"
          input-id="w-credits"
          :min="1"
          :max="100"
          :suffix="` ${t('wizard.credits')}`"
          show-buttons
          class="narrow"
        />
      </FormField>
      <div class="rules">
        <button
          type="button"
          class="rules__head"
          :aria-expanded="rulesOpen"
          @click="rulesOpen = !rulesOpen"
        >
          <i
            :class="['pi', rulesOpen ? 'pi-chevron-down' : 'pi-chevron-right pi-dir']"
            aria-hidden="true"
          />
          <span class="rules__title">{{ t('serviceRules.short') }}</span>
          <Tag class="tag-sm" :value="t('wizard.orgDefaults')" />
        </button>
        <div v-if="rulesOpen" class="rules__body">
          <div v-for="[label, value] in policyLines" :key="label" class="rules__row">
            <span>{{ label }}</span
            ><span class="muted">{{ value }}</span>
          </div>
          <p class="muted">{{ t('wizard.rulesLater') }}</p>
        </div>
      </div>
    </div>

    <!-- 6. Review -->
    <div v-else class="card">
      <div class="review-title">
        <span
          class="swatch"
          :style="{ background: form.color ?? category?.color }"
          aria-hidden="true"
        />
        <span class="review-title__name">{{ form.name.ar || form.name.en }}</span>
        <span class="muted type-label"
          ><i :class="['pi', ACTIVITY_ICONS[form.activity_type]]" aria-hidden="true" />{{
            t(`catalog.types.${activityKey(form.activity_type)}`)
          }}</span
        >
      </div>
      <Message v-if="nameMissing" severity="warn" icon="pi pi-language" :closable="false">{{
        t('wizard.nameBoth')
      }}</Message>
      <dl class="facts">
        <dt>{{ t('catalog.category') }}</dt>
        <dd>{{ category?.display_name }}</dd>
        <dt>{{ t('wizard.steps.defaults') }}</dt>
        <dd>{{ defaultsLine }}</dd>
        <dt>{{ t('catalog.columns.branches') }}</dt>
        <dd><BranchChips :names="chosenBranches.map((l) => l.name)" :max="4" /></dd>
        <dt>{{ t('wizard.eligibleStaff') }}</dt>
        <dd>{{ staffNames }}</dd>
        <dt>{{ t('wizard.acceptedWith') }}</dt>
        <dd>{{ payLabels }}</dd>
        <dt>{{ t('serviceRules.short') }}</dt>
        <dd>{{ t('wizard.orgDefaults') }}</dd>
      </dl>
    </div>

    <div class="footer">
      <Button
        :label="t('common.cancel')"
        variant="text"
        severity="secondary"
        @click="router.push({ name: 'tenant.services' })"
      />
      <span class="spacer" />
      <Button
        v-if="step > 0"
        :label="t('wizard.back')"
        icon="pi pi-arrow-left pi-dir"
        severity="secondary"
        variant="outlined"
        :disabled="!!saving"
        @click="step--"
      />
      <Button
        v-if="step < STEPS.length - 1"
        :label="t('wizard.next')"
        icon="pi pi-arrow-right pi-dir"
        icon-pos="right"
        :disabled="!canNext"
        @click="step++"
      />
      <template v-else>
        <Button
          :label="t('wizard.saveDraft')"
          severity="secondary"
          :loading="saving === 'Draft'"
          :disabled="!!saving"
          @click="save('Draft')"
        />
        <Button
          :label="t('catalog.bulk.publish')"
          icon="pi pi-send"
          :loading="saving === 'Published'"
          :disabled="!!saving"
          @click="save('Published')"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.wizard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 920px;
  margin: 0 auto;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card--steps {
  padding: 16px 20px;
  overflow-x: auto;
}
.types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.type {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 20px;
  margin: 1px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-default);
  background: var(--surface-card);
  color: var(--text-primary);
  text-align: start;
  cursor: pointer;
}
.type--on {
  margin: 0;
  border: 2px solid var(--primary);
  background: var(--primary-subtle);
}
.type__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-size: 18px;
}
.type__icon i {
  font-size: inherit;
}
.type--on .type__icon {
  background: var(--primary);
  color: var(--text-on-primary);
}
.type__title {
  font: var(--text-h3);
}
.type__text {
  font: var(--text-body);
  color: var(--text-secondary);
}
.type__example {
  font: var(--text-small);
  color: var(--text-muted);
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.range {
  display: flex;
  gap: 6px;
  align-items: center;
}
.option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-muted);
}
.sub-table {
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.sub-table__head {
  padding: 10px 14px;
  font: var(--text-h4);
  border-bottom: 1px solid var(--border-default);
}
.sub-table__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
}
.sub-table__row:last-child {
  border-bottom: 0;
}
.sub-table__name {
  font: 500 14px var(--font-sans);
}
.sub-table__hint {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.sub-table__hint--bad {
  color: var(--sev-danger-fg);
}
.checks {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding-top: 4px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.narrow {
  max-width: 200px;
}
.rules {
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.rules__head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  text-align: start;
  cursor: pointer;
}
.rules__head i {
  font-size: 12px;
  color: var(--text-muted);
}
.rules__title {
  flex: 1;
  font: var(--text-h4);
}
.rules__body {
  padding: 0 14px 14px;
}
.rules__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid var(--border-subtle);
}
.rules__body p {
  margin: 8px 0 0;
  font: var(--text-small);
}
.review-title {
  display: flex;
  gap: 12px;
  align-items: center;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.review-title__name {
  font: var(--text-h2);
}
.type-label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.facts {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 10px 24px;
  margin: 0;
}
.facts dt {
  color: var(--text-secondary);
}
.facts dd {
  margin: 0;
}
.footer {
  display: flex;
  gap: 8px;
  align-items: center;
}
.spacer {
  flex: 1;
}
@media (max-width: 767px) {
  .grid2,
  .grid3,
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
