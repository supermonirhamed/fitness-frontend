<script setup lang="ts">
// Create or edit a facility (US-01.08): name, type, capacity, status, description, photo and
// sub-areas (Pool → Lane 1–6). Sub-areas share the facility's branch, type and status.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import PhotoField from '@/components/patterns/PhotoField.vue'
import {
  FACILITY_TYPES,
  tenantApi,
  type Facility,
  type FacilityStatus,
  type FacilityType,
  type SubArea,
} from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'
import { FACILITY_ICONS, splitInto, typeKey } from '@/lib/facilities'

const props = defineProps<{ locationId: number; facility: Facility | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [facility: Facility, created: boolean] }>()
const { t, locale } = useI18n()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const MAX_SUB_AREAS = 50
const editing = computed(() => props.facility !== null)
const form = reactive({
  name: '',
  type: 'Room' as FacilityType,
  capacity: 20 as number | null,
  status: 'Active' as FacilityStatus,
  description: '' as string | null,
  sub_areas: [] as SubArea[],
})
const splitCount = ref<number | null>(null)
const photo = ref<File | null>(null)
const removePhoto = ref(false)
const photoError = ref<string | null>(null)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)

const typeOptions = computed(() =>
  FACILITY_TYPES.map((type) => ({
    value: type,
    label: t(`facilityTypes.${typeKey(type)}`),
    icon: FACILITY_ICONS[type],
  })),
)
const statusOptions = computed(() =>
  (['Active', 'Inactive'] as const).map((s) => ({ value: s, label: t(`facilityStatus.${s}`) })),
)
const err = (field: string) => errors.value[field]?.[0]

watch(visible, (open) => {
  if (!open) return
  const f = props.facility
  Object.assign(form, {
    name: f?.name ?? '',
    type: f?.type ?? 'Room',
    capacity: f?.capacity ?? 20,
    status: f?.status ?? 'Active',
    description: f?.description ?? '',
    sub_areas: (f?.sub_areas ?? []).map((s) => ({ ...s })),
  })
  splitCount.value = null
  photo.value = null
  removePhoto.value = false
  photoError.value = null
  errors.value = {}
  formError.value = null
})

function addSubArea() {
  const n = form.sub_areas.length + 1
  form.sub_areas.push({
    id: null,
    name: `${t(`facilityTypes.parts.${typeKey(form.type)}`)} ${n}`,
    capacity: Math.max(1, Math.floor((form.capacity ?? 1) / n)),
  })
}
/** Replaces the rows with N equal parts; existing rows keep their ids (renamed). */
function split() {
  if (!splitCount.value) return
  const rows = splitInto(
    splitCount.value,
    t(`facilityTypes.parts.${typeKey(form.type)}`),
    form.capacity ?? 1,
  )
  form.sub_areas = rows.map((row, i) => ({ ...row, id: form.sub_areas[i]?.id ?? null }))
}

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const input = {
    name: form.name,
    type: form.type,
    location_id: props.facility?.location_id ?? props.locationId,
    capacity: form.capacity ?? 0,
    ...(editing.value ? { status: form.status } : {}),
    description: form.description || null,
    sub_areas: form.sub_areas,
  }
  try {
    let saved = props.facility
      ? await tenantApi.facilities.update(props.facility.id, input)
      : await tenantApi.facilities.create(input)
    try {
      if (photo.value) saved = await tenantApi.facilities.uploadPhoto(saved.id, photo.value)
      else if (removePhoto.value && saved.photo_url) {
        await tenantApi.facilities.deletePhoto(saved.id)
        saved = { ...saved, photo_url: null }
      }
    } catch {
      photoError.value = t('locationForm.photoInvalid')
      emit('saved', saved, !editing.value) // the details were saved; only the photo failed
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
      editing ? t('facilityForm.editTitle', { name: facility?.name }) : t('facilityForm.newTitle')
    "
    class="facility-drawer"
  >
    <form id="facility-form" class="form" @submit.prevent="submit">
      <div class="field">
        <label for="fac-name">{{ t('facilityForm.name') }} *</label>
        <InputText
          id="fac-name"
          v-model="form.name"
          maxlength="120"
          :invalid="!!err('name')"
          fluid
        />
        <small v-if="err('name')" class="error">{{ err('name') }}</small>
      </div>

      <div class="row">
        <div class="field">
          <label for="fac-type">{{ t('facilityForm.type') }} *</label>
          <Select
            v-model="form.type"
            input-id="fac-type"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            :invalid="!!err('type')"
            fluid
          >
            <template #option="{ option }">
              <span class="type"
                ><i :class="['pi', option.icon]" aria-hidden="true" />{{ option.label }}</span
              >
            </template>
          </Select>
          <small v-if="err('type')" class="error">{{ err('type') }}</small>
        </div>
        <div class="field">
          <label for="fac-capacity">{{ t('facilityForm.capacity') }} *</label>
          <InputNumber
            v-model="form.capacity"
            input-id="fac-capacity"
            :min="1"
            :max="100000"
            :use-grouping="false"
            :invalid="!!err('capacity')"
            fluid
          />
          <small :class="err('capacity') ? 'error' : 'hint'">{{
            err('capacity') ?? t('facilityForm.capacityHint')
          }}</small>
        </div>
      </div>

      <div v-if="editing" class="field">
        <span id="fac-status" class="label">{{ t('facilityForm.status') }} *</span>
        <SelectButton
          v-model="form.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="fac-status"
        />
        <small class="hint">{{ t(`facilityForm.statusHint.${form.status}`) }}</small>
      </div>

      <fieldset class="field sub-areas">
        <legend class="label">{{ t('facilityForm.subAreas') }}</legend>
        <small class="hint">{{ t('facilityForm.subAreasHint') }}</small>
        <div v-for="(area, i) in form.sub_areas" :key="area.id ?? `new-${i}`" class="sub-area">
          <InputText
            v-model="area.name"
            maxlength="120"
            :aria-label="t('facilityForm.subAreaName', { n: i + 1 })"
            :invalid="!!err(`sub_areas.${i}.name`)"
            class="sub-name"
          />
          <InputNumber
            v-model="area.capacity"
            :min="1"
            :use-grouping="false"
            :aria-label="t('facilityForm.subAreaCapacity', { n: i + 1 })"
            :invalid="!!err(`sub_areas.${i}.capacity`)"
            input-class="sub-capacity"
          />
          <Button
            icon="pi pi-times"
            severity="secondary"
            variant="text"
            rounded
            size="small"
            :aria-label="t('facilityForm.removeSubArea', { name: area.name })"
            @click="form.sub_areas.splice(i, 1)"
          />
          <small
            v-if="
              err(`sub_areas.${i}.name`) ||
              err(`sub_areas.${i}.capacity`) ||
              err(`sub_areas.${i}.id`)
            "
            class="error sub-error"
            >{{
              err(`sub_areas.${i}.name`) ??
              err(`sub_areas.${i}.capacity`) ??
              err(`sub_areas.${i}.id`)
            }}</small
          >
        </div>
        <div class="sub-actions">
          <Button
            v-if="form.sub_areas.length < MAX_SUB_AREAS"
            icon="pi pi-plus"
            :label="t('facilityForm.addSubArea')"
            severity="secondary"
            variant="text"
            size="small"
            @click="addSubArea"
          />
          <span class="split">
            <InputNumber
              v-model="splitCount"
              :min="2"
              :max="MAX_SUB_AREAS"
              :use-grouping="false"
              :placeholder="t('facilityForm.parts')"
              :aria-label="t('facilityForm.parts')"
              input-class="split-count"
            />
            <Button
              :label="t('facilityForm.split')"
              severity="secondary"
              variant="outlined"
              size="small"
              :disabled="!splitCount || splitCount < 2"
              @click="split"
            />
          </span>
        </div>
        <small v-if="err('sub_areas')" class="error">{{ err('sub_areas') }}</small>
      </fieldset>

      <div class="field">
        <span class="label">{{ t('facilityForm.photo') }}</span>
        <PhotoField
          v-model:file="photo"
          v-model:remove="removePhoto"
          :current-url="facility?.photo_url"
          :alt="t('facilityForm.photoAlt')"
          :error="photoError"
        />
      </div>

      <div class="field">
        <label for="fac-description">{{ t('facilityForm.description') }}</label>
        <Textarea
          id="fac-description"
          v-model="form.description"
          rows="3"
          auto-resize
          maxlength="2000"
          :invalid="!!err('description')"
          fluid
        />
      </div>

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
          form="facility-form"
          :label="editing ? t('permissions.save') : t('facilityForm.create')"
          :loading="saving"
          :disabled="!form.name.trim() || !form.capacity"
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
  grid-template-columns: 1fr 140px;
  gap: var(--space-3);
}
.field label,
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.type {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.sub-areas {
  margin: 0;
  padding: 0;
  border: 0;
}
.sub-area {
  display: grid;
  grid-template-columns: 1fr 96px auto;
  gap: var(--space-2);
  align-items: center;
}
.sub-error {
  grid-column: 1 / -1;
}
.sub-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.split {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.sub-areas :deep(.sub-capacity),
.sub-areas :deep(.split-count) {
  width: 100%;
  max-width: 96px;
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
  .row {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.facility-drawer.p-drawer {
  width: var(--drawer-w);
  max-width: 100vw;
}
</style>
