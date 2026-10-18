<script setup lang="ts">
// The client app's shell (US-11.01): the organization's logo and name, a language switch, the
// page, and the bottom navigation of the design system's BottomNav — Home, Schedule, Account.
// Mobile-first; on wide screens it stays a phone-width column.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import { setLocale } from '@/i18n'
import { useClientApp } from '@/stores/clientApp'

const { t, locale } = useI18n()
const route = useRoute()
const app = useClientApp()
const nav = computed(() => [
  { name: 'app.home', icon: 'pi-home', label: t('app.nav.home') },
  { name: 'app.schedule', icon: 'pi-calendar', label: t('app.nav.schedule') },
  { name: 'app.account', icon: 'pi-user', label: t('app.nav.account') },
])
const active = (name: string) => route.matched.some((r) => r.name === name || r.meta.tab === name)
const showNav = computed(() => app.signedIn && app.verified && !route.meta.clientGuest)
const toggleLanguage = () => setLocale(locale.value === 'ar' ? 'en' : 'ar', true)
</script>

<template>
  <div class="client-app">
    <header class="top">
      <RouterLink :to="{ name: app.signedIn ? 'app.home' : 'app.signin' }" class="brand">
        <img v-if="app.config?.logo_url" :src="app.config.logo_url" alt="" class="logo" />
        <span v-else class="logo logo--initial" aria-hidden="true">{{
          app.config?.name?.charAt(0)
        }}</span>
        <span class="name">{{ app.config?.name }}</span>
      </RouterLink>
      <Button
        variant="text"
        severity="secondary"
        size="small"
        icon="pi pi-globe"
        :label="locale === 'ar' ? 'English' : 'العربية'"
        @click="toggleLanguage"
      />
    </header>
    <main class="page" :class="{ 'page--nav': showNav }">
      <RouterView />
    </main>
    <nav v-if="showNav" class="bottom-nav" :aria-label="t('app.nav.label')">
      <RouterLink
        v-for="item in nav"
        :key="item.name"
        :to="{ name: item.name }"
        class="bottom-nav__item"
        :aria-current="active(item.name) ? 'page' : undefined"
      >
        <i :class="['pi', item.icon]" aria-hidden="true" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.client-app {
  min-height: 100dvh;
  background: var(--surface-50);
  display: flex;
  flex-direction: column;
}
.top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  padding-top: max(8px, env(safe-area-inset-top));
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-default);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--text-primary);
  text-decoration: none;
}
.logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
  flex: none;
}
.logo--initial {
  display: grid;
  place-items: center;
  background: var(--primary-600);
  color: #fff;
  font-weight: 600;
}
.name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page {
  flex: 1;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
}
.page--nav {
  padding-bottom: calc(var(--bottom-nav-h, 64px) + 24px + env(safe-area-inset-bottom));
}
.bottom-nav {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  height: calc(var(--bottom-nav-h, 64px) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface-card);
  border-top: 1px solid var(--border-default);
}
.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: var(--touch-target, 44px);
  color: var(--text-muted);
  font: 500 11px/1 var(--font-sans);
  text-decoration: none;
}
.bottom-nav__item i {
  font-size: 20px;
}
.bottom-nav__item[aria-current='page'] {
  color: var(--primary);
  font-weight: 600;
}
</style>

<style>
/* Shared building blocks of the client app's pages. */
.ca-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ca-card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card, 10px);
  padding: 16px;
}
.ca-title {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 0;
}
.ca-subtitle {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 8px;
}
.ca-muted {
  color: var(--text-secondary);
}
.ca-small {
  font-size: 0.875rem;
}
.ca-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ca-spread {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ca-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ca-num {
  font-variant-numeric: tabular-nums;
}
.ca-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ca-list > li + li {
  border-top: 1px solid var(--border-default);
}
</style>
