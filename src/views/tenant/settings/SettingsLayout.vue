<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { allowedSettingsPages } from '@/lib/permissions'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const auth = useStaffAuth()
const pages = computed(() => allowedSettingsPages((p) => auth.can(p)))
</script>

<template>
  <div class="settings">
    <PageHeader :title="t('settings.title')" :subtitle="t('settings.subtitle')" />
    <nav class="settings__tabs" :aria-label="t('settings.title')">
      <RouterLink
        v-for="page in pages"
        :key="page.key"
        :to="{ name: page.name }"
        class="settings__tab"
        active-class="settings__tab--active"
        >{{ t(`settings.pages.${page.key}`) }}</RouterLink
      >
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.settings__tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}
.settings__tab {
  padding: var(--space-2) var(--space-3);
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
  text-decoration: none;
  white-space: nowrap;
}
.settings__tab:hover {
  color: var(--text-primary);
}
.settings__tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--primary);
}
</style>
