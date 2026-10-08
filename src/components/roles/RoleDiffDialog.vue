<script setup lang="ts">
// "Here is what will change" before saving permissions (design brief 08 §6).
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import type { PermissionDiff } from '@/lib/permissions'

defineProps<{
  roleName: string
  diff: PermissionDiff
  scopeChange?: string | null
  usersCount: number
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ confirm: [] }>()

const { t, te } = useI18n()
const label = (permission: string) => {
  const [module, action] = permission.split('.')
  const actionText = te(`permissions.actions.${action}`)
    ? t(`permissions.actions.${action}`)
    : action
  return `${t(`permissions.modules.${module}`)}: ${actionText}`
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('permissions.reviewTitle', { role: roleName })"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="diff">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <p class="muted">{{ t('permissions.reviewHint', { count: usersCount }, usersCount) }}</p>
      <p v-if="scopeChange" class="scope">
        <i class="pi pi-map-marker" aria-hidden="true" />{{ scopeChange }}
      </p>
      <ul class="diff__list">
        <li v-for="p in diff.added" :key="p" class="diff__added">
          <i class="pi pi-plus" aria-hidden="true" /><span class="sr-only">{{
            t('permissions.added')
          }}</span
          >{{ label(p) }}
        </li>
        <li v-for="p in diff.removed" :key="p" class="diff__removed">
          <i class="pi pi-minus" aria-hidden="true" /><span class="sr-only">{{
            t('permissions.removed')
          }}</span
          >{{ label(p) }}
        </li>
      </ul>
      <div class="audit">
        <i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}
      </div>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button :label="t('permissions.saveChanges')" :loading="loading" @click="emit('confirm')" />
    </template>
  </Dialog>
</template>

<style scoped>
.diff {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.scope {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
}
.diff__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.diff__list li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-2);
  border-radius: 4px;
  font: var(--text-small);
}
.diff__list i {
  font-size: 10px;
}
.diff__added {
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
}
.diff__removed {
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
