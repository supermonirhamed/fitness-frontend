<script setup lang="ts">
// Port of the design system's shell/Sidebar: start side, collapsible, org logo slot + name.
import { useI18n } from 'vue-i18n'

export interface NavItem {
  key: string
  icon: string
  to: string
  /** Highlight only on this exact route (e.g. "/", which contains every other page). */
  exact?: boolean
}

defineProps<{ items: NavItem[]; orgName: string; collapsed?: boolean }>()
const emit = defineEmits<{ toggle: []; navigate: [] }>()
const { t } = useI18n()
</script>

<template>
  <nav :aria-label="t('shell.mainNav')" :class="['sidebar', { 'sidebar--collapsed': collapsed }]">
    <div class="sidebar__org">
      <span class="sidebar__logo" aria-hidden="true"><i class="pi pi-image" /></span>
      <span v-if="!collapsed" class="sidebar__org-name">{{ orgName }}</span>
    </div>
    <ul class="sidebar__items">
      <li v-for="item in items" :key="item.key">
        <RouterLink
          :to="item.to"
          class="sidebar__item"
          :active-class="item.exact ? '' : 'sidebar__item--active'"
          exact-active-class="sidebar__item--active"
          :title="collapsed ? t(`shell.nav.${item.key}`) : undefined"
          @click="emit('navigate')"
        >
          <i :class="['pi', item.icon]" aria-hidden="true" />
          <span v-if="!collapsed">{{ t(`shell.nav.${item.key}`) }}</span>
        </RouterLink>
      </li>
    </ul>
    <div class="sidebar__footer">
      <button
        type="button"
        class="sidebar__item sidebar__toggle"
        :aria-label="collapsed ? t('shell.expand') : t('shell.collapse')"
        @click="emit('toggle')"
      >
        <i
          :class="['pi', 'pi-dir', collapsed ? 'pi-angle-double-right' : 'pi-angle-double-left']"
        />
        <span v-if="!collapsed">{{ t('shell.collapse') }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-card);
  border-inline-end: 1px solid var(--border-default);
  transition: width var(--dur-base) var(--ease-standard);
}
.sidebar--collapsed {
  width: var(--sidebar-w-collapsed);
}
.sidebar__org {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--header-h);
  padding: 0 14px;
  border-bottom: 1px solid var(--border-subtle);
}
.sidebar__logo {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
  background: var(--surface-sunken);
  border: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}
.sidebar__org-name {
  font: 600 14px/1.3 var(--font-sans);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar__items {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: auto;
}
.sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font: 500 14px/1 var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  text-align: start;
}
.sidebar--collapsed .sidebar__item {
  justify-content: center;
  padding: 0;
}
.sidebar__item:hover {
  background: var(--surface-hover);
  text-decoration: none;
  color: var(--text-secondary);
}
.sidebar__item i {
  font-size: 16px;
  width: 18px;
  text-align: center;
}
.sidebar__item--active,
.sidebar__item--active:hover {
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  font-weight: 600;
}
.sidebar__footer {
  padding: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}
.sidebar__toggle {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
