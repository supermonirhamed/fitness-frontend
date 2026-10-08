import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { resolveAppContext } from '@/lib/appContext'
import { usePlatformAuth } from '@/stores/platformAuth'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { onUnauthenticated } from '@/lib/http'

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
    path: '/',
    component: () => import('@/layouts/TenantLayout.vue'),
    children: [
      { path: '', name: 'tenant.today', component: () => import('@/views/tenant/TodayView.vue') },
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

    const signedIn = await useStaffAuth().check()
    if (!signedIn && !to.meta.guest)
      return { name: 'tenant.signin', query: { redirect: to.fullPath } }
    if (signedIn && to.meta.guest) return { name: 'tenant.today' }
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
