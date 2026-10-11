<script setup lang="ts">
// A record's photo (branch, facility): preview, choose a new one, or remove it. The parent
// uploads `file` or deletes the photo when `remove` is set, after saving the record.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FileUploadBox from './FileUploadBox.vue'

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

function choose(chosen: File) {
  invalid.value = false
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
  <FileUploadBox
    :preview-url="shown"
    :alt="alt"
    :label="t('locationForm.addPhoto')"
    :hint="t('locationForm.photoHint')"
    :error="message"
    :accept="PHOTO_TYPES.join(',')"
    @select="choose"
    @remove="clear"
  />
</template>
