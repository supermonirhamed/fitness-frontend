<script setup lang="ts">
// Design system OverrideDialog: required-reason dialog for every override and destructive action (audited).
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const props = defineProps<{
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ confirm: [reason: string] }>()

const { t } = useI18n()
const reason = ref('')

watch(visible, (open) => {
  if (open) reason.value = ''
})

const ok = () => reason.value.trim().length >= 3
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="title"
    :style="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form
      id="override-form"
      class="override"
      @submit.prevent="ok() && emit('confirm', reason.trim())"
    >
      <p v-if="description" class="override__description">{{ description }}</p>
      <Message v-if="props.error" severity="error" :closable="false">{{ props.error }}</Message>
      <div class="override__field">
        <label for="override-reason"
          >{{ t('override.reason') }} <span aria-hidden="true">*</span></label
        >
        <Textarea
          id="override-reason"
          v-model="reason"
          rows="3"
          maxlength="500"
          :placeholder="t('override.placeholder')"
          fluid
          autofocus
        />
      </div>
      <div class="override__audit">
        <i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}
      </div>
    </form>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="override-form"
        :label="confirmLabel"
        :severity="destructive ? 'danger' : undefined"
        :disabled="!ok()"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.override {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.override__description {
  margin: 0;
  color: var(--text-secondary);
}
.override__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.override__field label {
  font: var(--fw-medium) var(--fs-small)/var(--lh-small) var(--font-sans);
}
.override__audit {
  display: flex;
  gap: 6px;
  align-items: center;
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.override__audit i {
  font-size: 12px;
}
</style>
