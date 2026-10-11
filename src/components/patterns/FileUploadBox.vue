<script setup lang="ts">
// Port of the design system's FileUpload (forms/FileUpload.jsx): 72px preview box (dashed when
// empty, drop target), upload / replace and remove buttons, and a hint or error line.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'

const props = withDefaults(
  defineProps<{
    previewUrl?: string | null
    alt?: string
    label: string
    hint?: string
    error?: string | null
    accept?: string
    busy?: boolean
    disabled?: boolean
    removable?: boolean
    round?: boolean
  }>(),
  { previewUrl: null, alt: '', accept: 'image/*', removable: true },
)
const emit = defineEmits<{ select: [file: File]; remove: [] }>()
const { t } = useI18n()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (file) emit('select', file)
}
function onDrop(event: DragEvent) {
  dragging.value = false
  if (props.disabled) return
  const file = event.dataTransfer?.files[0]
  if (file) emit('select', file)
}
</script>

<template>
  <div
    class="upload"
    @dragover.prevent="dragging = !disabled"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <div
      :class="[
        'upload__box',
        {
          'upload__box--filled': previewUrl,
          'upload__box--drag': dragging,
          'upload__box--round': round,
        },
      ]"
    >
      <img v-if="previewUrl" :src="previewUrl" :alt="alt" />
      <i v-else :class="['pi', round ? 'pi-user' : 'pi-image']" aria-hidden="true" />
    </div>
    <div class="upload__side">
      <div class="upload__actions">
        <input ref="input" type="file" :accept="accept" hidden @change="onFile" />
        <Button
          v-if="!disabled"
          size="small"
          severity="secondary"
          variant="outlined"
          icon="pi pi-upload"
          :label="previewUrl ? t('orgProfile.replaceLogo') : label"
          :loading="busy"
          @click="input?.click()"
        />
        <Button
          v-if="previewUrl && removable && !disabled"
          size="small"
          severity="danger"
          variant="text"
          :label="t('orgProfile.removeLogo')"
          :disabled="busy"
          @click="emit('remove')"
        />
      </div>
      <small v-if="error" class="upload__error" role="alert">{{ error }}</small>
      <small v-else-if="hint" class="upload__hint">{{ hint }}</small>
    </div>
  </div>
</template>

<style scoped>
.upload {
  display: flex;
  align-items: center;
  gap: 16px;
}
.upload__box {
  width: 72px;
  height: 72px;
  flex: none;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-sunken);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 20px;
  overflow: hidden;
}
.upload__box i {
  font-size: inherit;
}
.upload__box--round {
  border-radius: 50%;
}
.upload__box--filled {
  border-style: solid;
  border-color: var(--border-default);
  background: var(--surface-card);
}
.upload__box--drag {
  border-color: var(--primary);
  background: var(--primary-subtle);
}
.upload__box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.upload__side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.upload__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.upload__hint {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.upload__error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
