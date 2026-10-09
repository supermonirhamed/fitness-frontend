<script setup lang="ts">
// Port of the design system's shell/AppHeader. The branch switcher (US-01.13) goes in the
// `context` slot; search and alerts arrive with their stories.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import LanguageToggle from '@/components/LanguageToggle.vue'

const props = defineProps<{ userName: string; userRole?: string; menuItems?: MenuItem[] }>()
const emit = defineEmits<{ menu: []; signOut: [] }>()
const { t } = useI18n()

const userMenu = ref<InstanceType<typeof Menu>>()
const items = computed<MenuItem[]>(() => [
  ...(props.menuItems ?? []),
  ...(props.menuItems?.length ? [{ separator: true }] : []),
  { label: t('common.signOut'), icon: 'pi pi-sign-out pi-dir', command: () => emit('signOut') },
])

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
</script>

<template>
  <header class="app-header">
    <Button
      class="app-header__menu"
      variant="text"
      severity="secondary"
      icon="pi pi-bars"
      :aria-label="t('shell.openMenu')"
      @click="emit('menu')"
    />
    <slot name="context" />
    <span class="app-header__spacer" />
    <LanguageToggle />
    <button
      type="button"
      class="app-header__user"
      aria-haspopup="true"
      aria-controls="user-menu"
      @click="userMenu?.toggle($event)"
    >
      <Avatar :label="initials(props.userName)" shape="circle" class="app-header__avatar" />
      <span class="app-header__user-text">
        <span class="app-header__user-name">{{ props.userName }}</span>
        <span v-if="props.userRole" class="app-header__user-role">{{ props.userRole }}</span>
      </span>
    </button>
    <Menu id="user-menu" ref="userMenu" :model="items" popup />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-h);
  padding: 0 var(--space-4);
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-default);
}
.app-header__spacer {
  flex: 1;
}
.app-header__menu {
  display: none;
}
.app-header__user {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
}
.app-header__user:hover {
  background: var(--surface-hover);
}
.app-header__avatar {
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  font-weight: 600;
}
.app-header__user-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}
.app-header__user-name {
  font: 500 13px var(--font-sans);
  white-space: nowrap;
}
.app-header__user-role {
  font: 400 11px var(--font-sans);
  color: var(--text-muted);
}
@media (max-width: 767px) {
  .app-header__menu {
    display: inline-flex;
  }
  .app-header__user-text {
    display: none;
  }
}
</style>
