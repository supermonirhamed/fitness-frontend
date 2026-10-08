<script setup lang="ts">
import LanguageToggle from '@/components/LanguageToggle.vue'
import { useOrganization } from '@/stores/organization'
import { tenantDomain } from '@/lib/appContext'

defineProps<{ subtitle?: string }>()
defineEmits<{ submit: [] }>()

const org = useOrganization()
</script>

<template>
  <div class="auth">
    <div class="auth__lang"><LanguageToggle /></div>
    <form class="auth__card" novalidate @submit.prevent="$emit('submit')">
      <div class="auth__brand">
        <span class="auth__logo" aria-hidden="true"><i class="pi pi-image" /></span>
        <div class="auth__title">{{ org.organization?.name }}</div>
        <div v-if="subtitle" class="auth__subtitle">{{ subtitle }}</div>
      </div>
      <slot />
    </form>
    <div class="auth__domain ltr-isolate">
      {{ org.organization ? tenantDomain(org.organization.slug) : '' }}
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--bg-app);
}
.auth__lang {
  position: fixed;
  top: var(--space-4);
  inset-inline-end: var(--space-4);
}
.auth__card {
  width: 400px;
  max-width: 100%;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-1);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.auth__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-1);
  text-align: center;
}
.auth__logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-sunken);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.auth__logo i {
  font-size: 20px;
}
.auth__title {
  font: var(--text-h2);
}
.auth__subtitle {
  font: var(--text-small);
  color: var(--text-secondary);
}
.auth__domain {
  margin-top: var(--space-4);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
/* Shared by the forms placed in the card. */
.auth__card :deep(.field) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth__card :deep(.field label) {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.auth__card :deep(.field small) {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.auth__card :deep(.field small.field__error) {
  color: var(--sev-danger-fg);
}
.auth__card :deep(.auth-link) {
  align-self: center;
  font: var(--text-small);
}
</style>
