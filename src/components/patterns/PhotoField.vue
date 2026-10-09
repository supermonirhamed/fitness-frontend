<script setup lang="ts">
// A record's photo (branch, facility): preview, choose a new one, or remove it. The parent
// uploads `file` or deletes the photo when `remove` is set, after saving the record.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const PHOTO_MAX = 4 * 1024 * 1024

const props = defineProps<{
  currentUrl: string | null | undefined
  alt: string
  error?: string | null
}>()
const file = defineModel<File | null>('file', { required: true })
const remove = defineModel<boolean>('remove', { required: true })
const { t } = useI18n()

const preview = ref<string | null>(null)
const invalid = ref(false)
const input = ref<HTMLInputElement | null>(null)
const shown = computed(() => (remove.value ? null : (preview.value ?? props.currentUrl ?? null)))
const message = computed(() =>
  invalid.value ? t('locationForm.photoInvalid') : (props.error ?? null),
)

function revoke() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
}
// The parent resets `file` when the form reopens.
watch(file, (value) => !value && revoke())
onBeforeUnmount(revoke)

function onFile(event: Event) {
  const chosen = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  invalid.value = false
  if (!chosen) return
  if (!PHOTO_TYPES.includes(chosen.type) || chosen.size > PHOTO_MAX) {
    invalid.value = true
    return
  }
  revoke()
  file.value = chosen
  preview.value = URL.createObjectURL(chosen)
  remove.value = false
}

function clear() {
  file.value = null
  revoke()
  remove.value = true
}
</script>

<template>
  <div class="photo">
    <img v-if="shown" :src="shown" :alt="alt" />
    <div v-else class="placeholder"><i class="pi pi-image" aria-hidden="true" /></div>
    <div class="photo-actions">
      <input ref="input" type="file" :accept="PHOTO_TYPES.join(',')" hidden @change="onFile" />
      <Button
        size="small"
        severity="secondary"
        variant="outlined"
        icon="pi pi-upload"
        :label="shown ? t('locationForm.replacePhoto') : t('locationForm.addPhoto')"
        @click="input?.click()"
      />
      <Button
        v-if="shown"
        size="small"
        variant="text"
        severity="secondary"
        icon="pi pi-trash"
        :label="t('orgProfile.removeLogo')"
        @click="clear"
      />
    </div>
  </div>
  <small :class="message ? 'error' : 'hint'">{{ message ?? t('locationForm.photoHint') }}</small>
</template>

<style scoped>
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
.hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
