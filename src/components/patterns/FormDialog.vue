<script setup lang="ts">
// A small form in a dialog: icon + title + optional subtitle in the header, an error banner, the
// fields (Enter submits), and Cancel / Save in the footer. Destructive forms get a red icon and
// button. Sizes: sm 420px, md 520px, lg 720px — always within the viewport on phones.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
    size?: 'sm' | 'md' | 'lg'
    saveLabel?: string
    saving?: boolean
    saveDisabled?: boolean
    danger?: boolean
    error?: string | null
    /** Hide the save button, for dialogs that only show something. */
    readonly?: boolean
  }>(),
  { size: 'md' },
)
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
const width = computed(() => ({ sm: '420px', md: '520px', lg: '720px' })[props.size])

function submit() {
  if (!props.readonly && !props.saving && !props.saveDisabled) emit('save')
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="!saving"
    :style="{ width, maxWidth: 'calc(100vw - 32px)' }"
    class="form-dialog"
  >
    <template #header>
      <div class="form-dialog__head">
        <span
          v-if="icon"
          :class="['form-dialog__icon', { 'form-dialog__icon--danger': danger }]"
          aria-hidden="true"
          ><i :class="['pi', icon]"
        /></span>
        <div class="form-dialog__titles">
          <span class="p-dialog-title">{{ title }}</span>
          <span v-if="subtitle" class="form-dialog__subtitle">{{ subtitle }}</span>
        </div>
      </div>
    </template>
    <form class="form-dialog__body" novalidate @submit.prevent="submit">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <slot />
      <button type="submit" hidden aria-hidden="true" tabindex="-1" />
    </form>
    <template #footer>
      <slot name="footer-start" />
      <span class="form-dialog__spacer" />
      <Button
        :label="readonly ? t('common.close') : t('common.cancel')"
        severity="secondary"
        variant="text"
        :disabled="saving"
        @click="visible = false"
      />
      <Button
        v-if="!readonly"
        :label="saveLabel ?? t('common.save')"
        :severity="danger ? 'danger' : undefined"
        :loading="saving"
        :disabled="saveDisabled"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form-dialog__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}
.form-dialog__icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--primary-50);
  color: var(--primary-700);
}
.form-dialog__icon--danger {
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
}
.form-dialog__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.form-dialog__subtitle {
  font: var(--text-small);
  color: var(--text-muted);
}
.form-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-dialog__spacer {
  flex: 1;
}
</style>
