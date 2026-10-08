<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Drawer from 'primevue/drawer'
import AppSidebar, { type NavItem } from '@/components/shell/AppSidebar.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te, locale } = useI18n()
const org = useOrganization()
const auth = useStaffAuth()
const router = useRouter()

// Items are added as their stories ship (Calendar, Bookings, Clients, …) and filtered by permission (US-00.07).
const nav = computed<NavItem[]>(() => [
  { key: 'today', icon: 'pi-sun', to: '/', exact: true },
  // Owner only until role permissions arrive (US-00.07); the API enforces it either way.
  ...(auth.user?.roles.includes('Organization Owner')
    ? [{ key: 'settings', icon: 'pi-cog', to: '/settings/security' }]
    : []),
])

const userMenu = computed(() => [
  {
    label: t('shell.security'),
    icon: 'pi pi-shield',
    command: () => router.push({ name: 'tenant.security' }),
  },
])

const collapsed = ref(false)
const mobileOpen = ref(false)

const role = computed(() => {
  const name = auth.user?.roles[0]
  return name && te(`roles.${name}`) ? t(`roles.${name}`) : name
})

async function signOut() {
  try {
    await auth.logout()
  } finally {
    // Signed out locally either way (the store forgets the user even when the call fails).
    await router.replace({ name: 'tenant.signin' })
  }
}
</script>

<template>
  <div class="shell">
    <AppSidebar
      class="shell__sidebar"
      :items="nav"
      :org-name="org.organization?.name ?? ''"
      :collapsed="collapsed"
      @toggle="collapsed = !collapsed"
    />
    <Drawer
      v-model:visible="mobileOpen"
      :position="locale === 'ar' ? 'right' : 'left'"
      :show-close-icon="false"
      class="shell__drawer"
    >
      <AppSidebar
        :items="nav"
        :org-name="org.organization?.name ?? ''"
        @navigate="mobileOpen = false"
      />
    </Drawer>
    <div class="shell__main">
      <AppHeader
        :user-name="auth.user?.name ?? ''"
        :user-role="role"
        :menu-items="userMenu"
        @menu="mobileOpen = true"
        @sign-out="signOut"
      />
      <main class="shell__content"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  background: var(--bg-app);
}
.shell__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.shell__content {
  flex: 1;
  overflow: auto;
  padding: var(--space-6);
}
@media (max-width: 767px) {
  .shell__sidebar {
    display: none;
  }
  .shell__content {
    padding: var(--space-4);
  }
}
</style>

<style>
.shell__drawer.p-drawer {
  width: var(--sidebar-w);
}
.shell__drawer .p-drawer-header {
  display: none;
}
.shell__drawer .p-drawer-content {
  padding: 0;
}
</style>
