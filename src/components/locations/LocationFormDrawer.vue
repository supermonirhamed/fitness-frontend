<script setup lang="ts">
// Create / edit a branch (US-01.03). A new branch starts as Draft and its timezone defaults to the
// organization's; it can differ per branch (D4).
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
import {
  tenantApi,
  type LocationDetails,
  type LocationInput,
  type LocationStatus,
} from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { apiMessage } from '@/lib/apiErrors'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{ location: LocationDetails | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [location: LocationDetails, created: boolean] }>()

const { t, locale } = useI18n()
const org = useOrganization()

const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const PHOTO_MAX = 4 * 1024 * 1024
const STATUSES: LocationStatus[] = ['Draft', 'Active', 'Inactive']
const timezones = Intl.supportedValuesOf('timeZone')
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const editing = computed(() => props.location !== null)

const blank = (): LocationInput => ({
  name: '',
  status: 'Draft',
  address: '',
  timezone: org.organization?.timezone ?? 'Asia/Riyadh',
  phone: null,
  email: null,
  latitude: null,
  longitude: null,
  description: null,
})

const form = reactive<LocationInput>(blank())
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const saving = ref(false)
const photo = ref<File | null>(null)
const photoPreview = ref<string | null>(null)
const removePhoto = ref(false)
const photoError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const statusOptions = computed(() =>
  // Deactivating has its own dialog (US-01.05): it checks upcoming sessions first.
  STATUSES.filter((s) => s !== 'Inactive' || props.location?.status === 'Inactive').map((s) => ({
    value: s,
    label: t(`locationStatus.${s}`),
  })),
)
const statusHint = computed(() => t(`locationForm.statusHint.${form.status}`))
const shownPhoto = computed(() =>
  removePhoto.value ? null : (photoPreview.value ?? props.location?.photo_url ?? null),
)

watch(visible, (open) => {
  if (!open) return
  errors.value = {}
  formError.value = null
  photoError.value = null
  photo.value = null
  removePhoto.value = false
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = null
  const l = props.location
  Object.assign(
    form,
    l
      ? {
          name: l.name,
          status: l.status,
          address: l.address ?? '',
          timezone: l.timezone,
          phone: l.phone,
          email: l.email,
          latitude: l.latitude,
          longitude: l.longitude,
          description: l.description,
        }
      : blank(),
  )
})

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  photoError.value = null
  if (!file) return
  if (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_MAX) {
    photoError.value = t('locationForm.photoInvalid')
    return
  }
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = file
  photoPreview.value = URL.createObjectURL(file)
  removePhoto.value = false
}

function clearPhoto() {
  photo.value = null
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = null
  removePhoto.value = true
}

const err = (field: string) => errors.value[field]?.[0]

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const input = { ...form }
    let saved = props.location
      ? await tenantApi.updateLocation(props.location.id, input)
      : await tenantApi.createLocation(input)
    try {
      if (photo.value) saved = await tenantApi.uploadLocationPhoto(saved.id, photo.value)
      else if (removePhoto.value && saved.photo_url) {
        await tenantApi.deleteLocationPhoto(saved.id)
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
      editing ? t('locationForm.editTitle', { name: location?.name }) : t('locationForm.newTitle')
    "
    class="location-drawer"
  >
    <form id="location-form" class="form" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="loc-name">{{ t('locationForm.fields.name') }} *</label>
        <InputText
          id="loc-name"
          v-model="form.name"
          :invalid="!!err('name')"
          autocomplete="off"
          maxlength="120"
          fluid
        />
        <small v-if="err('name')" class="error">{{ err('name') }}</small>
      </div>

      <div class="field">
        <label for="loc-address">{{ t('locationForm.fields.address') }} *</label>
        <Textarea
          id="loc-address"
          v-model="form.address"
          :invalid="!!err('address')"
          rows="2"
          auto-resize
          maxlength="500"
          fluid
        />
        <small v-if="err('address')" class="error">{{ err('address') }}</small>
      </div>

      <div class="field">
        <label for="loc-timezone">{{ t('locationForm.fields.timezone') }} *</label>
        <Select
          v-model="form.timezone"
          input-id="loc-timezone"
          :options="timezones"
          filter
          :invalid="!!err('timezone')"
          fluid
        />
        <small :class="err('timezone') ? 'error' : 'hint'">{{
          err('timezone') ?? t('locationForm.timezoneHint')
        }}</small>
      </div>

      <div class="field">
        <span id="loc-status-label" class="label">{{ t('locationForm.fields.status') }} *</span>
        <SelectButton
          v-model="form.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="loc-status-label"
        />
        <small :class="err('status') ? 'error' : 'hint'">{{ err('status') ?? statusHint }}</small>
      </div>

      <div class="row">
        <div class="field">
          <label for="loc-phone">{{ t('locationForm.fields.phone') }}</label>
          <InputText
            id="loc-phone"
            v-model="form.phone"
            :invalid="!!err('phone')"
            type="tel"
            dir="ltr"
            fluid
          />
          <small v-if="err('phone')" class="error">{{ err('phone') }}</small>
        </div>
        <div class="field">
          <label for="loc-email">{{ t('locationForm.fields.email') }}</label>
          <InputText
            id="loc-email"
            v-model="form.email"
            :invalid="!!err('email')"
            type="email"
            dir="ltr"
            fluid
          />
          <small v-if="err('email')" class="error">{{ err('email') }}</small>
        </div>
      </div>

      <fieldset class="group">
        <legend>{{ t('locationForm.map') }}</legend>
        <div class="row">
          <div class="field">
            <label for="loc-lat">{{ t('locationForm.fields.latitude') }}</label>
            <InputNumber
              v-model="form.latitude"
              input-id="loc-lat"
              :min="-90"
              :max="90"
              :max-fraction-digits="7"
              :use-grouping="false"
              :invalid="!!err('latitude')"
              fluid
            />
          </div>
          <div class="field">
            <label for="loc-lng">{{ t('locationForm.fields.longitude') }}</label>
            <InputNumber
              v-model="form.longitude"
              input-id="loc-lng"
              :min="-180"
              :max="180"
              :max-fraction-digits="7"
              :use-grouping="false"
              :invalid="!!err('longitude')"
              fluid
            />
          </div>
        </div>
        <small :class="err('latitude') || err('longitude') ? 'error' : 'hint'">{{
          err('latitude') ?? err('longitude') ?? t('locationForm.mapHint')
        }}</small>
      </fieldset>

      <div class="field">
        <span class="label">{{ t('locationForm.fields.photo') }}</span>
        <div class="photo">
          <img v-if="shownPhoto" :src="shownPhoto" :alt="t('locationForm.photoAlt')" />
          <div v-else class="placeholder"><i class="pi pi-image" aria-hidden="true" /></div>
          <div class="photo-actions">
            <input
              ref="fileInput"
              type="file"
              :accept="PHOTO_TYPES.join(',')"
              hidden
              @change="onFile"
            />
            <Button
              size="small"
              severity="secondary"
              variant="outlined"
              icon="pi pi-upload"
              :label="shownPhoto ? t('locationForm.replacePhoto') : t('locationForm.addPhoto')"
              @click="fileInput?.click()"
            />
            <Button
              v-if="shownPhoto"
              size="small"
              variant="text"
              severity="secondary"
              icon="pi pi-trash"
              :label="t('orgProfile.removeLogo')"
              @click="clearPhoto"
            />
          </div>
        </div>
        <small :class="photoError ? 'error' : 'hint'">{{
          photoError ?? t('locationForm.photoHint')
        }}</small>
      </div>

      <div class="field">
        <label for="loc-description">{{ t('locationForm.fields.description') }}</label>
        <Textarea
          id="loc-description"
          v-model="form.description"
          :invalid="!!err('description')"
          rows="3"
          auto-resize
          maxlength="2000"
          fluid
        />
        <small v-if="err('description')" class="error">{{ err('description') }}</small>
      </div>

      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
    </form>

    <template #footer>
      <div class="footer">
        <Button
          severity="secondary"
          variant="text"
          :label="t('common.cancel')"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="location-form"
          :label="editing ? t('permissions.save') : t('locationForm.create')"
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
  gap: var(--space-4);
}
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field label,
.label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
legend {
  padding-inline: var(--space-1);
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
.photo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.photo img,
.placeholder {
  width: 120px;
  height: 80px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-subtle);
}
.placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted);
  background: var(--surface-sunken);
}
.photo-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>

<style>
.location-drawer.p-drawer {
  width: var(--drawer-w);
  max-width: 100vw;
}
</style>
