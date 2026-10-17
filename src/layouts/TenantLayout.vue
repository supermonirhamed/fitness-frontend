<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Drawer from 'primevue/drawer'
import AppSidebar, { type NavItem } from '@/components/shell/AppSidebar.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import BranchSwitcher from '@/components/shell/BranchSwitcher.vue'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { allowedPages, allowedSettingsPages, STAFF_PAGES } from '@/lib/permissions'
import { useTheme } from '@/composables/useTheme'

const { t, te, locale } = useI18n()
const org = useOrganization()
const auth = useStaffAuth()
const router = useRouter()
const { theme, toggle: toggleTheme } = useTheme()

// The design's sidebar order (shell/Sidebar.jsx NAV_ITEMS). Calendar, Bookings, Clients and
// Check-in are added as their stories ship. Items are filtered by permission (US-00.07).
const nav = computed<NavItem[]>(() => [
  { key: 'today', icon: 'pi-sun', to: '/', exact: true },
  ...(auth.can('schedule.view') ? [{ key: 'calendar', icon: 'pi-calendar', to: '/calendar' }] : []),
  // Coaches' own schedule (US-03.14); others reach it from the user menu.
  ...(auth.can('schedule.view') && auth.user?.roles.some((r) => COACHING_ROLES.includes(r))
    ? [{ key: 'mySchedule', icon: 'pi-clock', to: '/my-schedule' }]
    : []),
  ...(auth.can('bookings.view') ? [{ key: 'bookings', icon: 'pi-bookmark', to: '/bookings' }] : []),
  ...(auth.can('clients.view') ? [{ key: 'clients', icon: 'pi-users', to: '/clients' }] : []),
  ...(auth.can('attendance.create')
    ? [{ key: 'checkIn', icon: 'pi-qrcode', to: '/check-in' }]
    : []),
  ...(auth.can('services.view') ? [{ key: 'services', icon: 'pi-th-large', to: '/services' }] : []),
  ...(auth.can('memberships.view')
    ? [{ key: 'memberships', icon: 'pi-id-card', to: '/memberships' }]
    : []),
  ...(auth.can('payments.create') ? [{ key: 'pos', icon: 'pi-shopping-cart', to: '/pos' }] : []),
  ...(auth.can('payments.view') ? [{ key: 'invoices', icon: 'pi-file', to: '/invoices' }] : []),
  ...(auth.can('payments.view')
    ? [{ key: 'collections', icon: 'pi-exclamation-circle', to: '/collections' }]
    : []),
  ...(auth.can('payments.view')
    ? [{ key: 'transactions', icon: 'pi-arrow-right-arrow-left', to: '/transactions' }]
    : []),
  ...(auth.can('marketing.view')
    ? [{ key: 'promotions', icon: 'pi-percentage', to: '/promotions' }]
    : []),
  ...(allowedPages(STAFF_PAGES, (p) => auth.can(p)).length
    ? [{ key: 'staff', icon: 'pi-id-card', to: '/staff' }]
    : []),
  ...(auth.can('locations.view')
    ? [{ key: 'branches', icon: 'pi-building', to: '/branches' }]
    : []),
  // Shown when the user can open at least one settings page.
  ...(allowedSettingsPages((p) => auth.can(p)).length
    ? [{ key: 'settings', icon: 'pi-cog', to: '/settings' }]
    : []),
])

const COACHING_ROLES = ['Coach', 'Personal Trainer']

const userMenu = computed(() => [
  ...(auth.can('schedule.view')
    ? [
        {
          label: t('mySchedule.title'),
          icon: 'pi pi-clock',
          command: () => router.push({ name: 'tenant.mySchedule' }),
        },
      ]
    : []),
  {
    label: t('shell.profile'),
    icon: 'pi pi-user',
    command: () => router.push({ name: 'tenant.profile' }),
  },
  {
    label: t('shell.security'),
    icon: 'pi pi-shield',
    command: () => router.push({ name: 'tenant.security' }),
  },
  {
    label: theme.value === 'dark' ? t('shell.lightMode') : t('shell.darkMode'),
    icon: theme.value === 'dark' ? 'pi pi-sun' : 'pi pi-moon',
    command: toggleTheme,
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
  <div
    class="shell"
    :style="{ '--content-start': collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }"
  >
    <AppSidebar
      class="shell__sidebar"
      :items="nav"
      :org-name="org.organization?.name ?? ''"
      :logo-url="org.organization?.logo_url"
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
        :logo-url="org.organization?.logo_url"
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
      >
        <template #context><BranchSwitcher /></template>
      </AppHeader>
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
