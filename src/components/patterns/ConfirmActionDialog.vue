<script setup lang="ts">
// A plain "are you sure?" dialog for actions that need no reason (destructive ones in red).
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

defineProps<{
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="title"
    :style="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="confirm">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <p v-if="description">{{ description }}</p>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="confirmLabel"
        :severity="destructive ? 'danger' : undefined"
        :loading="loading"
        @click="emit('confirm')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.confirm p {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
