import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { resolveAppContext } from '@/lib/appContext'
import { usePlatformAuth } from '@/stores/platformAuth'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { onUnauthenticated } from '@/lib/http'
import { allowedSettingsPages } from '@/lib/permissions'

const context = resolveAppContext(window.location.hostname)

const platformRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'platform.signin',
    component: () => import('@/views/platform/PlatformSignInView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/PlatformLayout.vue'),
    children: [
      {
        path: '',
        name: 'platform.tenants',
        component: () => import('@/views/platform/TenantsView.vue'),
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const tenantRoutes: RouteRecordRaw[] = [
  {
    path: '/unavailable',
    name: 'tenant.status',
    component: () => import('@/views/tenant/TenantStatusView.vue'),
    meta: { public: true },
  },
  {
    path: '/login',
    name: 'tenant.signin',
    component: () => import('@/views/tenant/TenantSignInView.vue'),
    meta: { guest: true },
  },
  {
    path: '/forgot-password',
    name: 'tenant.forgot',
    component: () => import('@/views/tenant/ForgotPasswordView.vue'),
    meta: { guest: true },
  },
  // Emailed links (US-00.05) open whether or not someone is signed in on this browser.
  {
    path: '/reset-password',
    name: 'tenant.reset',
    component: () => import('@/views/tenant/ResetPasswordView.vue'),
    meta: { link: true },
  },
  {
    path: '/invitation/accept',
    name: 'tenant.invitation',
    component: () => import('@/views/tenant/AcceptInvitationView.vue'),
    meta: { link: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/TenantLayout.vue'),
    children: [
      { path: '', name: 'tenant.today', component: () => import('@/views/tenant/TodayView.vue') },
      {
        path: 'account/security',
        name: 'tenant.security',
        component: () => import('@/views/tenant/account/SecurityView.vue'),
      },
      {
        path: 'settings',
        name: 'tenant.settings',
        component: () => import('@/views/tenant/settings/SettingsLayout.vue'),
        children: [
          {
            path: 'users',
            name: 'tenant.settings.users',
            component: () => import('@/views/tenant/settings/UsersAccessView.vue'),
            meta: { permission: 'staff.view' },
          },
          {
            path: 'roles',
            name: 'tenant.settings.roles',
            component: () => import('@/views/tenant/settings/RolesView.vue'),
            meta: { permission: 'roles.view' },
          },
          {
            path: 'security',
            name: 'tenant.settings.security',
            component: () => import('@/views/tenant/settings/SecuritySettingsView.vue'),
            meta: { permission: 'settings.security' },
          },
          {
            path: 'audit',
            name: 'tenant.settings.audit',
            component: () => import('@/views/tenant/settings/AuditLogView.vue'),
            meta: { permission: 'audit.view' },
          },
        ],
      },
      {
        path: 'forbidden',
        name: 'tenant.forbidden',
        component: () => import('@/views/tenant/ForbiddenView.vue'),
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: context.kind === 'platform' ? platformRoutes : tenantRoutes,
})

if (context.kind === 'platform') {
  router.beforeEach(async (to) => {
    const signedIn = await usePlatformAuth().check()
    if (!signedIn && !to.meta.guest)
      return { name: 'platform.signin', query: { redirect: to.fullPath } }
    if (signedIn && to.meta.guest) return { name: 'platform.tenants' }
  })
}

if (context.kind === 'tenant') {
  router.beforeEach(async (to) => {
    // The organization must exist and be active before anything else (US-00.02 / US-00.03).
    const state = await useOrganization().load()
    if (state !== 'ready') return to.name === 'tenant.status' ? true : { name: 'tenant.status' }
    if (to.meta.public) return { name: 'tenant.today' }
    if (to.meta.link) return true

    const signedIn = await useStaffAuth().check()
    if (!signedIn && !to.meta.guest)
      return { name: 'tenant.signin', query: { redirect: to.fullPath } }
    if (signedIn && to.meta.guest) return { name: 'tenant.today' }

    // A role that requires 2FA (US-00.06): nothing else until it is set up. The API enforces this too.
    const auth = useStaffAuth()
    const user = auth.user
    if (user?.two_factor_required && !user.two_factor_enabled && to.name !== 'tenant.security')
      return { name: 'tenant.security', query: { required: '1' } }

    // Pages the role can't open (US-00.07). Hiding links is not enough: the API refuses too.
    if (to.name === 'tenant.settings') {
      const first = allowedSettingsPages((p) => auth.can(p))[0]
      return first ? { name: first.name } : { name: 'tenant.forbidden' }
    }
    const missing = to.matched.find(
      (r) => r.meta.permission && !auth.can(r.meta.permission as string),
    )
    if (missing) return { name: 'tenant.forbidden' }
  })

  // A session that ends server-side (expired, deactivated) sends the user back to sign in.
  onUnauthenticated(() => {
    const auth = useStaffAuth()
    if (!auth.signedIn) return
    auth.forget()
    router.replace({ name: 'tenant.signin', query: { expired: '1' } })
  })
}

export default router
