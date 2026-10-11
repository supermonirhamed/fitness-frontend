<script setup lang="ts">
// The design system's Tabs (navigation/Tabs.jsx) driven by the router: each tab is a page.
import type { RouteLocationRaw } from 'vue-router'

export interface RouteTab {
  key: string
  label: string
  to: RouteLocationRaw
  icon?: string
  count?: number | null
}

defineProps<{ tabs: RouteTab[]; label: string }>()
</script>

<template>
  <nav class="route-tabs" :aria-label="label">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="route-tabs__tab"
      active-class="route-tabs__tab--active"
    >
      <i v-if="tab.icon" :class="['pi', tab.icon]" aria-hidden="true" />{{ tab.label }}
      <span v-if="tab.count != null" class="tab-count">{{ tab.count }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.route-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.route-tabs__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  color: var(--text-secondary);
  font: 500 14px/1 var(--font-sans);
  white-space: nowrap;
  text-decoration: none;
}
.route-tabs__tab:hover {
  color: var(--text-primary);
  text-decoration: none;
}
.route-tabs__tab--active,
.route-tabs__tab--active:hover {
  color: var(--primary);
}
.route-tabs__tab--active::after {
  content: '';
  position: absolute;
  inset-inline: 8px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
}
</style>
