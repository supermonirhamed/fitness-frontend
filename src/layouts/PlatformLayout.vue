<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { usePlatformAuth } from '@/stores/platformAuth'

const { t } = useI18n()
const auth = usePlatformAuth()
const router = useRouter()

async function signOut() {
  await auth.logout()
  await router.replace({ name: 'platform.signin' })
}
</script>

<template>
  <div class="platform">
    <header class="platform__header">
      <div class="platform__brand">
        <span class="platform__mark"><i class="pi pi-shield" aria-hidden="true" /></span>
        <span>{{ t('platform.consoleName') }}</span>
      </div>
      <div class="platform__actions">
        <LanguageToggle />
        <span class="platform__user">{{ auth.admin?.name }}</span>
        <Button
          variant="text"
          severity="secondary"
          icon="pi pi-sign-out pi-dir"
          :label="t('common.signOut')"
          @click="signOut"
        />
      </div>
    </header>
    <main class="platform__main"><RouterView /></main>
  </div>
</template>

<style scoped>
.platform {
  min-height: 100vh;
  background: var(--bg-app);
}
.platform__header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-default);
}
.platform__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font: var(--text-h4);
}
.platform__mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.platform__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.platform__user {
  font: var(--text-small);
  color: var(--text-secondary);
  padding-inline: var(--space-2);
}
.platform__main {
  padding: var(--space-6);
  max-width: 1280px;
  margin: 0 auto;
}
</style>
