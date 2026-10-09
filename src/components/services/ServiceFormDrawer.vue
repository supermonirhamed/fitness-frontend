<script setup lang="ts">
// Create or edit a service (US-02.02) and the branches offering it (US-02.03).
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import PhotoField from '@/components/patterns/PhotoField.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import ColorPickerField from '@/components/services/ColorPickerField.vue'
import {
  ACTIVITY_TYPES,
  tenantApi,
  type Location,
  type Service,
  type ServiceCategory,
  type ServiceInput,
  type ServiceLocation,
  type StaffOption,
} from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'
import { ACTIVITY_ICONS, activityKey, emptyTranslated, translatedErrors } from '@/lib/catalog'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{
  service: Service | null
  categories: ServiceCategory[]
  locations: Location[]
  /** Prefill one branch for a new service (from a branch's Services tab). */
  locationId?: number | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [service: Service, created: boolean] }>()
const { t, te, locale } = useI18n()
const org = useOrganization()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const editing = computed(() => props.service !== null)

const blank = (): ServiceInput => ({
  name: emptyTranslated(),
  description: emptyTranslated(),
  activity_type: 'Class',
  category_id: null,
  default_duration: 60,
  default_capacity: 20,
  buffer_before: 0,
  buffer_after: 0,
  status: 'Draft',
  color: null,
  skill_level: 'All',
  age_min: null,
  age_max: null,
  gender: 'Any',
  equipment_notes: '',
  locations: [],
})
const form = reactive<ServiceInput>(blank())
/** Per branch: offered, and its overrides. */
const links = reactive<
  Record<number, { on: boolean; capacity: number | null; price: number | null }>
>({})
const staffIds = ref<number[]>([])
const staffOptions = ref<StaffOption[]>([])
const staffLoaded = ref(false)
async function loadStaff() {
  try {
    staffOptions.value = await tenantApi.services.staffOptions()
  } finally {
    staffLoaded.value = true
  }
}
const roleName = (role: string) => (te(`roles.${role}`) ? t(`roles.${role}`) : role)
const photo = ref<File | null>(null)
const removePhoto = ref(false)
const photoError = ref<string | null>(null)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)

const openAccess = computed(() => form.activity_type === 'Open Access')
const categoryOptions = computed(() =>
  props.categories.filter((c) => !c.archived_at || c.id === props.service?.category_id),
)
const typeOptions = computed(() =>
  ACTIVITY_TYPES.map((type) => ({
    value: type,
    label: t(`catalog.types.${activityKey(type)}`),
    icon: ACTIVITY_ICONS[type],
  })),
)
const statusOptions = computed(() =>
  (['Draft', 'Published', 'Archived'] as const).map((s) => ({
    value: s,
    label: t(`catalog.status.${s}`),
  })),
)
const skillOptions = computed(() =>
  (['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((s) => ({
    value: s,
    label: t(`catalog.skill.${s}`),
  })),
)
const genderOptions = computed(() =>
  (['Any', 'Male', 'Female'] as const).map((g) => ({ value: g, label: t(`catalog.gender.${g}`) })),
)
const err = (field: string) => errors.value[field]?.[0]
const locationsError = computed(() => {
  const key = Object.keys(errors.value).find((k) => k === 'locations' || k.startsWith('locations.'))
  return key ? errors.value[key]?.[0] : undefined
})

watch(visible, (open) => {
  if (!open) return
  const s = props.service
  Object.assign(
    form,
    s
      ? {
          name: { ar: s.name.ar ?? '', en: s.name.en ?? '' },
          description: { ar: s.description.ar ?? '', en: s.description.en ?? '' },
          activity_type: s.activity_type,
          category_id: s.category_id,
          default_duration: s.default_duration,
          default_capacity: s.default_capacity,
          buffer_before: s.buffer_before,
          buffer_after: s.buffer_after,
          status: s.status,
          color: s.own_color,
          skill_level: s.skill_level,
          age_min: s.age_min,
          age_max: s.age_max,
          gender: s.gender,
          equipment_notes: s.equipment_notes ?? '',
        }
      : { ...blank(), category_id: categoryOptions.value[0]?.id ?? null },
  )
  for (const key of Object.keys(links)) delete links[Number(key)]
  for (const l of props.locations) {
    const link = s?.locations?.find((x) => x.location_id === l.id)
    links[l.id] = {
      on: s ? !!link : props.locationId ? props.locationId === l.id : props.locations.length === 1,
      capacity: link?.capacity_override ?? null,
      price: link?.price_override == null ? null : Number(link.price_override),
    }
  }
  staffIds.value = (s?.staff ?? []).map((u) => u.id)
  if (!staffLoaded.value) loadStaff()
  photo.value = null
  removePhoto.value = false
  photoError.value = null
  errors.value = {}
  formError.value = null
})

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const locations: ServiceLocation[] = props.locations
    .filter((l) => links[l.id]?.on)
    .map((l) => ({
      location_id: l.id,
      ...(openAccess.value ? {} : { capacity_override: links[l.id]!.capacity }),
      price_override: links[l.id]!.price,
    })) as ServiceLocation[]
  const input: ServiceInput = {
    ...form,
    default_capacity: openAccess.value ? null : form.default_capacity,
    status: editing.value ? form.status : form.status,
    equipment_notes: form.equipment_notes || null,
    locations,
    staff_ids: staffIds.value,
  }
  try {
    let saved = props.service
      ? await tenantApi.services.update(props.service.id, input)
      : await tenantApi.services.create(input)
    try {
      if (photo.value) saved = await tenantApi.services.uploadPhoto(saved.id, photo.value)
      else if (removePhoto.value && saved.photo_url) {
        await tenantApi.services.deletePhoto(saved.id)
        saved = { ...saved, photo_url: null }
      }
    } catch {
      photoError.value = t('locationForm.photoInvalid')
      emit('saved', saved, !editing.value)
      return
    }
    emit('saved', saved, !editing.value)
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :header="
      editing ? t('catalog.editService', { name: service?.display_name }) : t('catalog.newService')
    "
    class="service-drawer"
  >
    <form id="service-form" class="form" @submit.prevent="submit">
      <TranslatedField
        id="service-name"
        v-model="form.name"
        :label="t('catalog.serviceName')"
        required
        :maxlength="120"
        :errors="translatedErrors(errors, 'name')"
      />

      <div class="field">
        <span id="service-type-label" class="label">{{ t('catalog.activityType') }} *</span>
        <div class="types" role="radiogroup" aria-labelledby="service-type-label">
          <button
            v-for="o in typeOptions"
            :key="o.value"
            type="button"
            role="radio"
            class="type"
            :aria-checked="form.activity_type === o.value"
            @click="form.activity_type = o.value"
          >
            <i :class="['pi', o.icon]" aria-hidden="true" />
            <span class="type-name">{{ o.label }}</span>
            <small>{{ t(`catalog.typeHints.${activityKey(o.value)}`) }}</small>
          </button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="service-category">{{ t('catalog.category') }} *</label>
          <Select
            v-model="form.category_id"
            input-id="service-category"
            :options="categoryOptions"
            option-label="display_name"
            option-value="id"
            :placeholder="t('catalog.pickCategory')"
            :invalid="!!err('category_id')"
            fluid
          >
            <template #option="{ option }">
              <span class="cat"
                ><span class="dot" :style="{ background: option.color }" />{{
                  option.display_name
                }}</span
              >
            </template>
          </Select>
          <small :class="err('category_id') ? 'error' : 'hint'">{{
            err('category_id') ?? (categoryOptions.length ? '' : t('catalog.noCategoriesYet'))
          }}</small>
        </div>
        <div class="field">
          <span id="service-status" class="label">{{ t('catalog.statusLabel') }} *</span>
          <SelectButton
            v-model="form.status"
            :options="editing ? statusOptions : statusOptions.slice(0, 2)"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            aria-labelledby="service-status"
          />
          <small class="hint">{{ t(`catalog.statusHints.${form.status}`) }}</small>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="service-duration">{{ t('catalog.duration') }} *</label>
          <InputNumber
            v-model="form.default_duration"
            input-id="service-duration"
            :min="5"
            :max="1440"
            :step="5"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            :invalid="!!err('default_duration')"
            fluid
          />
          <small v-if="err('default_duration')" class="error">{{ err('default_duration') }}</small>
        </div>
        <div v-if="!openAccess" class="field">
          <label for="service-capacity">{{ t('catalog.capacity') }} *</label>
          <InputNumber
            v-model="form.default_capacity"
            input-id="service-capacity"
            :min="1"
            :max="10000"
            show-buttons
            :invalid="!!err('default_capacity')"
            fluid
          />
          <small :class="err('default_capacity') ? 'error' : 'hint'">{{
            err('default_capacity') ?? t('catalog.capacityHint')
          }}</small>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="service-buffer-before">{{ t('catalog.bufferBefore') }}</label>
          <InputNumber
            v-model="form.buffer_before"
            input-id="service-buffer-before"
            :min="0"
            :max="240"
            :step="5"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            :invalid="!!err('buffer_before')"
            fluid
          />
        </div>
        <div class="field">
          <label for="service-buffer-after">{{ t('catalog.bufferAfter') }}</label>
          <InputNumber
            v-model="form.buffer_after"
            input-id="service-buffer-after"
            :min="0"
            :max="240"
            :step="5"
            :suffix="` ${t('catalog.minutes')}`"
            show-buttons
            :invalid="!!err('buffer_after')"
            fluid
          />
        </div>
      </div>
      <small
        :class="err('buffer_before') || err('buffer_after') ? 'error' : 'hint'"
        class="under"
        >{{ err('buffer_before') ?? err('buffer_after') ?? t('catalog.bufferHint') }}</small
      >

      <fieldset class="field branches">
        <legend class="label">{{ t('catalog.branches') }} *</legend>
        <small class="hint">{{ t('catalog.branchesHint') }}</small>
        <div v-for="l in locations" :key="l.id" class="branch" :class="{ on: links[l.id]?.on }">
          <label class="branch-name">
            <Checkbox v-model="links[l.id]!.on" binary :input-id="`branch-${l.id}`" />
            {{ l.name }}
          </label>
          <template v-if="links[l.id]?.on">
            <InputNumber
              v-if="!openAccess"
              v-model="links[l.id]!.capacity"
              :min="1"
              :max="10000"
              :placeholder="t('catalog.defaultValue', { value: form.default_capacity ?? '—' })"
              :aria-label="t('catalog.capacityAt', { branch: l.name })"
              input-class="override"
            />
            <InputNumber
              v-model="links[l.id]!.price"
              mode="currency"
              :currency="org.organization?.currency ?? 'SAR'"
              :min="0"
              :max-fraction-digits="3"
              :placeholder="t('catalog.priceLater')"
              :aria-label="t('catalog.priceAt', { branch: l.name })"
              input-class="override"
            />
          </template>
        </div>
        <small v-if="locationsError" class="error">{{ locationsError }}</small>
      </fieldset>

      <div class="field">
        <label for="service-staff">{{ t('catalog.staff') }}</label>
        <MultiSelect
          v-model="staffIds"
          input-id="service-staff"
          :options="staffOptions"
          option-label="name"
          option-value="id"
          filter
          display="chip"
          :loading="!staffLoaded"
          :placeholder="t('catalog.anyStaff')"
          :invalid="!!err('staff_ids')"
          fluid
        >
          <template #option="{ option }">
            <span class="staff-option">
              <span>{{ option.name }}</span>
              <small>{{ option.roles.map(roleName).join(', ') }}</small>
            </span>
          </template>
        </MultiSelect>
        <small :class="err('staff_ids') ? 'error' : 'hint'">{{
          err('staff_ids') ?? t('catalog.staffHint')
        }}</small>
      </div>

      <details class="more">
        <summary>{{ t('catalog.moreDetails') }}</summary>
        <div class="more-body">
          <TranslatedField
            id="service-description"
            v-model="form.description!"
            :label="t('catalog.description')"
            multiline
            :maxlength="2000"
            :errors="translatedErrors(errors, 'description')"
          />
          <div class="row">
            <div class="field">
              <label for="service-skill">{{ t('catalog.skillLevel') }}</label>
              <Select
                v-model="form.skill_level"
                input-id="service-skill"
                :options="skillOptions"
                option-label="label"
                option-value="value"
                fluid
              />
            </div>
            <div class="field">
              <label for="service-gender">{{ t('catalog.genderLabel') }}</label>
              <Select
                v-model="form.gender"
                input-id="service-gender"
                :options="genderOptions"
                option-label="label"
                option-value="value"
                fluid
              />
            </div>
          </div>
          <div class="field">
            <span class="label">{{ t('catalog.ageRange') }}</span>
            <div class="ages">
              <InputNumber
                v-model="form.age_min"
                :min="0"
                :max="100"
                :placeholder="t('catalog.from')"
                :aria-label="t('catalog.ageFrom')"
                :invalid="!!err('age_min')"
              />
              <span aria-hidden="true">–</span>
              <InputNumber
                v-model="form.age_max"
                :min="0"
                :max="100"
                :placeholder="t('catalog.to')"
                :aria-label="t('catalog.ageTo')"
                :invalid="!!err('age_max')"
              />
            </div>
            <small :class="err('age_max') ? 'error' : 'hint'">{{
              err('age_max') ?? t('catalog.ageHint')
            }}</small>
          </div>
          <div class="field">
            <span id="service-color-label" class="label">{{ t('catalog.color') }}</span>
            <ColorPickerField id="service-color" v-model="form.color" allow-none />
          </div>
          <div class="field">
            <label for="service-equipment">{{ t('catalog.equipment') }}</label>
            <Textarea
              id="service-equipment"
              v-model="form.equipment_notes"
              rows="2"
              auto-resize
              maxlength="1000"
              fluid
            />
          </div>
          <div class="field">
            <span class="label">{{ t('catalog.photo') }}</span>
            <PhotoField
              v-model:file="photo"
              v-model:remove="removePhoto"
              :current-url="service?.photo_url"
              :alt="t('catalog.photoAlt')"
              :error="photoError"
            />
          </div>
        </div>
      </details>

      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
    </form>
    <template #footer>
      <div class="footer">
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="service-form"
          :label="editing ? t('permissions.save') : t('catalog.createService')"
          :loading="saving"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.field label,
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.type {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  text-align: start;
  cursor: pointer;
  color: var(--text-primary);
}
.type .pi {
  grid-row: span 2;
  margin-top: 2px;
  color: var(--primary);
}
.type small {
  font: var(--text-caption);
  color: var(--text-muted);
}
.type[aria-checked='true'] {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
.type-name {
  font-weight: var(--fw-medium);
}
.cat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.branches {
  margin: 0;
  padding: 0;
  border: 0;
}
.branch {
  display: grid;
  grid-template-columns: 1fr 110px 140px;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);
}
.branch-name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  font-weight: normal;
}
.branches :deep(.override) {
  width: 100%;
}
.staff-option {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}
.staff-option small {
  color: var(--text-muted);
}
.ages {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ages :deep(input) {
  width: 90px;
}
.more summary {
  cursor: pointer;
  font-weight: var(--fw-medium);
  color: var(--text-link);
}
.more-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-top: var(--space-4);
}
.under {
  margin-top: calc(-1 * var(--space-4));
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
@media (max-width: 480px) {
  .row,
  .types {
    grid-template-columns: 1fr;
  }
  .branch {
    grid-template-columns: 1fr 1fr;
  }
  .branch-name {
    grid-column: 1 / -1;
  }
}
</style>

<style>
.service-drawer.p-drawer {
  width: min(560px, 100vw);
}
</style>
