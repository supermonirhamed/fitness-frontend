import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { resolveAppContext } from '@/lib/appContext'
import { usePlatformAuth } from '@/stores/platformAuth'

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
    path: '/:pathMatch(.*)*',
    name: 'tenant.home',
    component: () => import('@/views/tenant/TenantHomeView.vue'),
    props: () => ({ slug: context.kind === 'tenant' ? context.slug : '' }),
  },
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

export default router
