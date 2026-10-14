import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { resolveAppContext } from '@/lib/appContext'
import { usePlatformAuth } from '@/stores/platformAuth'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'
import { onUnauthenticated } from '@/lib/http'
import { allowedPages, SETTINGS_PAGES, STAFF_PAGES } from '@/lib/permissions'

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
  // An invoice to print or save as PDF (US-07.05), outside the app shell.
  {
    path: '/invoices/:id(\\d+)/print',
    name: 'tenant.invoice.print',
    component: () => import('@/views/tenant/invoices/InvoicePrintView.vue'),
    meta: { permission: 'payments.view' },
  },
  // A payment's receipt, outside the app shell so it prints cleanly (US-04.15).
  {
    path: '/receipts/:id(\\d+)',
    name: 'tenant.receipt',
    component: () => import('@/views/tenant/ReceiptView.vue'),
    meta: { permission: 'payments.view' },
  },
  // Signing a waiver on a staff tablet, handed to the client (US-05.07): no app shell.
  {
    path: '/waivers/sign/:client(\\d+)/:template(\\d+)',
    name: 'tenant.waiver.sign',
    component: () => import('@/views/tenant/WaiverSignView.vue'),
    meta: { permission: 'clients.update' },
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
        path: 'calendar',
        name: 'tenant.calendar',
        component: () => import('@/views/tenant/CalendarView.vue'),
        meta: { permission: 'schedule.view' },
      },
      {
        path: 'bookings',
        name: 'tenant.bookings',
        component: () => import('@/views/tenant/bookings/BookingsView.vue'),
        meta: { permission: 'bookings.view' },
      },
      {
        path: 'clients',
        name: 'tenant.clients',
        component: () => import('@/views/tenant/clients/ClientsView.vue'),
        meta: { permission: 'clients.view' },
      },
      {
        // Promotions: discounts and coupons (US-07.07).
        path: 'promotions',
        name: 'tenant.promotions',
        component: () => import('@/views/tenant/PromotionsView.vue'),
        meta: { permission: 'marketing.view' },
      },
      {
        // Invoices (US-07.05).
        path: 'invoices',
        name: 'tenant.invoices',
        component: () => import('@/views/tenant/invoices/InvoicesView.vue'),
        meta: { permission: 'payments.view' },
      },
      {
        path: 'invoices/:id(\\d+)',
        name: 'tenant.invoice',
        component: () => import('@/views/tenant/invoices/InvoiceDetailsView.vue'),
        meta: { permission: 'payments.view' },
      },
      {
        // Point of sale (US-07.02).
        path: 'pos',
        name: 'tenant.pos',
        component: () => import('@/views/tenant/PosView.vue'),
        meta: { permission: 'payments.create' },
      },
      {
        path: 'memberships',
        name: 'tenant.memberships',
        component: () => import('@/views/tenant/memberships/PlansView.vue'),
        meta: { permission: 'memberships.view' },
      },
      {
        path: 'memberships/:id(\\d+)',
        name: 'tenant.memberships.show',
        component: () => import('@/views/tenant/memberships/PlanDetailsView.vue'),
        props: (r) => ({ id: Number(r.params.id) }),
        meta: { permission: 'memberships.view' },
      },
      {
        path: 'memberships/plans/new',
        name: 'tenant.memberships.new',
        component: () => import('@/views/tenant/memberships/PlanFormView.vue'),
        meta: { permission: 'memberships.update' },
      },
      {
        path: 'memberships/packages/new',
        name: 'tenant.memberships.newPackage',
        component: () => import('@/views/tenant/memberships/PlanFormView.vue'),
        meta: { permission: 'memberships.update', kind: 'package' },
      },
      {
        path: 'memberships/plans/:id(\\d+)',
        name: 'tenant.memberships.edit',
        component: () => import('@/views/tenant/memberships/PlanFormView.vue'),
        meta: { permission: 'memberships.update' },
      },
      {
        path: 'clients/import',
        name: 'tenant.clients.import',
        component: () => import('@/views/tenant/clients/ImportClientsView.vue'),
        meta: { permission: 'clients.create' },
      },
      {
        path: 'clients/segments',
        name: 'tenant.clients.segments',
        component: () => import('@/views/tenant/clients/SegmentsView.vue'),
        meta: { permission: 'clients.view' },
      },
      {
        path: 'clients/:id(\\d+)/family',
        name: 'tenant.client.family',
        component: () => import('@/views/tenant/clients/FamilyView.vue'),
        meta: { permission: 'clients.view' },
      },
      {
        path: 'clients/:id(\\d+)',
        name: 'tenant.client',
        component: () => import('@/views/tenant/clients/ClientProfileView.vue'),
        meta: { permission: 'clients.view' },
      },
      {
        path: 'my-schedule',
        name: 'tenant.mySchedule',
        component: () => import('@/views/tenant/schedule/MyScheduleView.vue'),
        meta: { permission: 'schedule.view' },
      },
      {
        path: 'calendar/conflicts',
        name: 'tenant.conflicts',
        component: () => import('@/views/tenant/schedule/ConflictCenterView.vue'),
        meta: { permission: 'schedule.update' },
      },
      {
        path: 'calendar/sessions/:id(\\d+)',
        name: 'tenant.session',
        component: () => import('@/views/tenant/schedule/SessionDetailsView.vue'),
        meta: { permission: 'schedule.view' },
      },
      {
        path: 'account/profile',
        name: 'tenant.profile',
        component: () => import('@/views/tenant/account/ProfileView.vue'),
      },
      {
        path: 'account/security',
        name: 'tenant.security',
        component: () => import('@/views/tenant/account/SecurityView.vue'),
      },
      {
        path: 'services',
        name: 'tenant.services',
        component: () => import('@/views/tenant/ServicesView.vue'),
        meta: { permission: 'services.view' },
      },
      {
        path: 'services/categories',
        name: 'tenant.services.categories',
        component: () => import('@/views/tenant/CategoriesView.vue'),
        meta: { permission: 'services.view' },
      },
      {
        path: 'services/new',
        name: 'tenant.services.new',
        component: () => import('@/views/tenant/ServiceWizardView.vue'),
        meta: { permission: 'services.create' },
      },
      {
        path: 'services/programs/:id(\\d+)',
        name: 'tenant.programs.show',
        component: () => import('@/views/tenant/ProgramDetailsView.vue'),
        meta: { permission: 'services.view' },
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: 'services/:id(\\d+)',
        name: 'tenant.services.show',
        component: () => import('@/views/tenant/ServiceDetailsView.vue'),
        meta: { permission: 'services.view' },
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: 'facilities/:id(\\d+)/availability',
        name: 'tenant.facilities.availability',
        component: () => import('@/views/tenant/FacilityAvailabilityView.vue'),
        meta: { permission: 'locations.view' },
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: 'branches',
        name: 'tenant.branches',
        component: () => import('@/views/tenant/branches/BranchesView.vue'),
        meta: { permission: 'locations.view' },
      },
      { path: 'locations/:id(\\d+)', redirect: (to) => `/branches/${to.params.id}` },
      {
        path: 'branches/:id(\\d+)',
        name: 'tenant.locations.show',
        component: () => import('@/views/tenant/LocationDetailsView.vue'),
        meta: { permission: 'locations.view' },
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: 'settings',
        name: 'tenant.settings',
        component: () => import('@/views/tenant/settings/SettingsLayout.vue'),
        children: [
          {
            path: 'organization',
            name: 'tenant.settings.organization',
            component: () => import('@/views/tenant/settings/OrganizationSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            path: 'regional',
            name: 'tenant.settings.regional',
            component: () => import('@/views/tenant/settings/RegionalSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            path: 'booking-policies',
            name: 'tenant.settings.booking',
            component: () => import('@/views/tenant/settings/BookingPolicyView.vue'),
            meta: { permission: 'settings.view' },
          },
          // Moved out of Settings with the design's navigation.
          { path: 'locations', redirect: { name: 'tenant.branches' } },
          { path: 'users', redirect: { name: 'tenant.staff.users' } },
          { path: 'roles', redirect: { name: 'tenant.staff.roles' } },
          {
            path: 'memberships',
            name: 'tenant.settings.memberships',
            component: () => import('@/views/tenant/settings/MembershipSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            path: 'payments',
            name: 'tenant.settings.payments',
            component: () => import('@/views/tenant/settings/PaymentSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            path: 'security',
            name: 'tenant.settings.security',
            component: () => import('@/views/tenant/settings/SecuritySettingsView.vue'),
            meta: { permission: 'settings.security' },
          },
          {
            path: 'waivers',
            name: 'tenant.settings.waivers',
            component: () => import('@/views/tenant/settings/WaiversView.vue'),
            meta: { permission: 'settings.view' },
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
        path: 'staff',
        name: 'tenant.staff',
        component: () => import('@/views/tenant/staff/StaffLayout.vue'),
        children: [
          {
            path: 'users',
            name: 'tenant.staff.users',
            component: () => import('@/views/tenant/settings/UsersAccessView.vue'),
            meta: { permission: 'staff.view' },
          },
          {
            path: 'roles',
            name: 'tenant.staff.roles',
            component: () => import('@/views/tenant/settings/RolesView.vue'),
            meta: { permission: 'roles.view' },
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
    if (to.name === 'tenant.settings' || to.name === 'tenant.staff') {
      const pages = to.name === 'tenant.settings' ? SETTINGS_PAGES : STAFF_PAGES
      const first = allowedPages(pages, (p) => auth.can(p))[0]
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
