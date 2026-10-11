<script setup lang="ts">
// Layout from the design (ui_kits/admin/OrgSettings.jsx): breadcrumb + title, a sticky vertical
// sub-menu on the start side, and the section title above the page.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { allowedSettingsPages } from '@/lib/permissions'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const route = useRoute()
const auth = useStaffAuth()
const pages = computed(() => allowedSettingsPages((p) => auth.can(p)))
const current = computed(() => pages.value.find((p) => p.name === route.name))
</script>

<template>
  <div class="settings">
    <PageHeader
      :title="t('settings.title')"
      :breadcrumb="[
        { label: t('shell.nav.settings'), to: { name: 'tenant.settings' } },
        ...(current ? [{ label: t(`settings.pages.${current.key}`) }] : []),
      ]"
    />
    <div class="settings__body">
      <nav class="settings__nav" :aria-label="t('settings.title')">
        <RouterLink
          v-for="page in pages"
          :key="page.key"
          :to="{ name: page.name }"
          class="settings__link"
          active-class="settings__link--active"
        >
          <i :class="['pi', page.icon]" aria-hidden="true" />{{ t(`settings.pages.${page.key}`) }}
        </RouterLink>
      </nav>
      <div class="settings__content">
        <h2 v-if="current">{{ t(`settings.pages.${current.key}`) }}</h2>
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 72px; /* room for the unsaved-changes bar */
}
.settings__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.settings__nav {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
}
.settings__link {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  font: 500 14px var(--font-sans);
  text-decoration: none;
}
.settings__link:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
  text-decoration: none;
}
.settings__link--active,
.settings__link--active:hover {
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  font-weight: 600;
}
.settings__content {
  flex: 1 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings__content h2 {
  margin: 0;
  font: var(--text-h2);
}
@media (max-width: 767px) {
  .settings__nav {
    position: static;
    flex: 1 1 100%;
    flex-direction: row;
    overflow-x: auto;
  }
  .settings__link {
    white-space: nowrap;
  }
}
</style>
