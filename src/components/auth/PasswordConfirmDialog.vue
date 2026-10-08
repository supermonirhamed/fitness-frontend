<script setup lang="ts">
// Re-enter the password before a security change (US-00.06).
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Password from 'primevue/password'

defineProps<{
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ confirm: [password: string] }>()

const { t } = useI18n()
const password = ref('')

watch(visible, (open) => {
  if (open) password.value = ''
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="title"
    :style="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form
      id="password-confirm-form"
      class="confirm"
      @submit.prevent="password && emit('confirm', password)"
    >
      <p v-if="description" class="confirm__description">{{ description }}</p>
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="confirm__field">
        <label for="confirm-current-password">{{ t('tenantApp.security.currentPassword') }}</label>
        <Password
          v-model="password"
          input-id="confirm-current-password"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          fluid
          autofocus
          :invalid="!!error"
        />
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
        form="password-confirm-form"
        :label="confirmLabel"
        :severity="destructive ? 'danger' : undefined"
        :disabled="!password"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.confirm__description {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.confirm__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.confirm__field label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
</style>
