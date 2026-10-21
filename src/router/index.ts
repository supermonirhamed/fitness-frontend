import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router'
import { resolveAppContext } from '@/lib/appContext'
import { usePlatformAuth } from '@/stores/platformAuth'
import { useOrganization } from '@/stores/organization'
import { useClientApp } from '@/stores/clientApp'
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
  // A player's evaluation to print or save as PDF for the family (US-10.19), outside the app shell.
  {
    path: '/academy/evaluations/:id(\\d+)/print',
    name: 'tenant.academy.evaluation.print',
    component: () => import('@/views/tenant/academy/EvaluationPrintView.vue'),
    meta: { permission: 'academy.view' },
  },
  // A child's term progress report to print or save as PDF (US-10.20), outside the app shell.
  {
    path: '/academy/progress-report/:id(\\d+)',
    name: 'tenant.academy.progress-report.print',
    component: () => import('@/views/tenant/academy/ProgressReportPrintView.vue'),
    meta: { permission: 'academy.view' },
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
  // The sandbox gateway's test checkout (US-07.12), opened from the client app.
  {
    path: '/pay/sandbox/:reference',
    name: 'tenant.pay.sandbox',
    component: () => import('@/views/pay/SandboxCheckoutView.vue'),
    meta: { link: true },
  },
  // The self check-in kiosk (US-08.05): signed in by its device token, never a staff login.
  {
    path: '/kiosk',
    name: 'tenant.kiosk',
    component: () => import('@/views/kiosk/KioskView.vue'),
    meta: { link: true, kiosk: true },
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
        // Messages to groups of clients (US-12.13).
        path: 'messages',
        name: 'tenant.messages',
        component: () => import('@/views/tenant/messages/BroadcastsView.vue'),
        meta: { permission: 'messages.send' },
      },
      {
        // The notification log (US-12.14).
        path: 'messages/log',
        name: 'tenant.messageLog',
        component: () => import('@/views/tenant/messages/NotificationLogView.vue'),
        meta: { permission: 'messages.view' },
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
        // Attendance rates (US-08.10).
        path: 'attendance',
        name: 'tenant.attendance',
        component: () => import('@/views/tenant/attendance/AttendanceRatesView.vue'),
        meta: { permission: 'attendance.view' },
      },
      {
        // The check-in desk (EP-08).
        path: 'check-in',
        name: 'tenant.checkIn',
        component: () => import('@/views/tenant/CheckInView.vue'),
        meta: { permission: 'attendance.create' },
      },
      {
        // Unpaid and overdue follow-up (US-07.11).
        path: 'collections',
        name: 'tenant.collections',
        component: () => import('@/views/tenant/invoices/CollectionsView.vue'),
        meta: { permission: 'payments.view' },
      },
      {
        // Transactions and daily close (US-07.10).
        path: 'transactions',
        name: 'tenant.transactions',
        component: () => import('@/views/tenant/transactions/TransactionsView.vue'),
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
        // A coach's own availability and time off (US-09.04).
        path: 'account/availability',
        name: 'tenant.availability',
        component: () => import('@/views/tenant/account/AvailabilityView.vue'),
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
        // The Academy (EP-10): groups of every program; coaches see their own.
        path: 'academy',
        name: 'tenant.academy',
        component: () => import('@/views/tenant/academy/AcademyGroupsView.vue'),
        meta: { permission: 'academy.view' },
      },
      {
        // Re-enrollment for a term (US-10.14).
        path: 'academy/terms/:id(\\d+)/reenrollment',
        name: 'tenant.academy.reenrollment',
        component: () => import('@/views/tenant/academy/ReenrollmentView.vue'),
        meta: { permission: 'academy.view' },
        props: (route) => ({ id: Number(route.params.id) }),
      },
      {
        path: 'academy/groups/:id(\\d+)',
        name: 'tenant.academy.group',
        component: () => import('@/views/tenant/academy/AcademyGroupView.vue'),
        meta: { permission: 'academy.view' },
        props: (route) => ({ id: Number(route.params.id) }),
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
            // Staff & scheduling (EP-09).
            path: 'staff',
            name: 'tenant.settings.staff',
            component: () => import('@/views/tenant/settings/StaffSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            // Academy (EP-10): sibling discount, waiting-list offers, absence notices.
            path: 'academy',
            name: 'tenant.settings.academy',
            component: () => import('@/views/tenant/settings/AcademySettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            // Check-in & attendance (EP-08).
            path: 'attendance',
            name: 'tenant.settings.attendance',
            component: () => import('@/views/tenant/settings/AttendanceSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            // The members' app (EP-11): on/off, brand, what clients may do (US-11.01/02).
            path: 'client-app',
            name: 'tenant.settings.clientApp',
            component: () => import('@/views/tenant/settings/ClientAppSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            // Notifications (EP-12): sender, SMS sender ID, the types and their channels.
            path: 'notifications',
            name: 'tenant.settings.notifications',
            component: () => import('@/views/tenant/settings/NotificationSettingsView.vue'),
            meta: { permission: 'settings.view' },
          },
          {
            // Message templates (US-12.06).
            path: 'notification-templates',
            name: 'tenant.settings.notificationTemplates',
            component: () => import('@/views/tenant/settings/NotificationTemplatesView.vue'),
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
            // The team and staff profiles (EP-09).
            path: 'team',
            name: 'tenant.staff.team',
            component: () => import('@/views/tenant/staff/TeamView.vue'),
            meta: { permission: 'staff.view' },
          },
          {
            path: 'members/:id(\\d+)',
            name: 'tenant.staff.member',
            component: () => import('@/views/tenant/staff/StaffProfileView.vue'),
            meta: { permission: 'staff.view' },
          },
          {
            path: 'hours',
            name: 'tenant.staff.hours',
            component: () => import('@/views/tenant/staff/StaffHoursView.vue'),
            meta: { permission: 'staff.view' },
          },
          {
            path: 'pay',
            name: 'tenant.staff.pay',
            component: () => import('@/views/tenant/staff/PayReportView.vue'),
            meta: { permission: 'staff.pay_rates' },
          },
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
  // The client app (EP-11) at /app on the organization's subdomain: members and parents, with their
  // own sign-in. Staff pages stay at the root.
  {
    path: '/app',
    component: () => import('@/layouts/ClientAppLayout.vue'),
    meta: { clientApp: true },
    children: [
      { path: '', name: 'app.home', component: () => import('@/views/app/AppHomeView.vue') },
      {
        path: 'closed',
        name: 'app.closed',
        component: () => import('@/views/app/AppClosedView.vue'),
        meta: { clientGuest: true, clientOpen: true },
      },
      {
        path: 'sign-in',
        name: 'app.signin',
        component: () => import('@/views/app/AppSignInView.vue'),
        meta: { clientGuest: true },
      },
      {
        path: 'sign-up',
        name: 'app.signup',
        component: () => import('@/views/app/AppSignUpView.vue'),
        meta: { clientGuest: true },
      },
      {
        path: 'forgot-password',
        name: 'app.forgot',
        component: () => import('@/views/app/AppForgotView.vue'),
        meta: { clientGuest: true },
      },
      {
        path: 'verify',
        name: 'app.verify',
        component: () => import('@/views/app/AppVerifyView.vue'),
        meta: { clientGuest: true, clientUnverified: true },
      },
      {
        path: 'schedule',
        name: 'app.schedule',
        component: () => import('@/views/app/AppScheduleView.vue'),
      },
      {
        path: 'sessions/:id(\\d+)',
        name: 'app.session',
        component: () => import('@/views/app/AppSessionView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'account',
        name: 'app.account',
        component: () => import('@/views/app/AppAccountView.vue'),
      },
      {
        path: 'bookings',
        name: 'app.bookings',
        component: () => import('@/views/app/AppBookingsView.vue'),
      },
      {
        path: 'appointments',
        name: 'app.appointments',
        component: () => import('@/views/app/AppAppointmentsView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'events',
        name: 'app.events',
        component: () => import('@/views/app/AppEventsView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'events/:id(\\d+)',
        name: 'app.event',
        component: () => import('@/views/app/AppEventView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'shop',
        name: 'app.shop',
        component: () => import('@/views/app/AppShopView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'shop/:id(\\d+)',
        name: 'app.checkout',
        component: () => import('@/views/app/AppCheckoutView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'payments',
        name: 'app.payments',
        component: () => import('@/views/app/AppPaymentsView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'memberships',
        name: 'app.memberships',
        component: () => import('@/views/app/AppMembershipsView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'academy/enroll',
        name: 'app.academy.enroll',
        component: () => import('@/views/app/AppAcademyEnrollView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'family',
        name: 'app.family',
        component: () => import('@/views/app/AppFamilyView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'family/new',
        name: 'app.child.new',
        component: () => import('@/views/app/AppChildFormView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'family/:id(\\d+)',
        name: 'app.child',
        component: () => import('@/views/app/AppChildView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'family/:id(\\d+)/academy',
        name: 'app.child.academy',
        component: () => import('@/views/app/AppChildAcademyView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'family/:id(\\d+)/edit',
        name: 'app.child.edit',
        component: () => import('@/views/app/AppChildFormView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'coaches',
        name: 'app.coaches',
        component: () => import('@/views/app/AppCoachesView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'coaches/:id(\\d+)',
        name: 'app.coach',
        component: () => import('@/views/app/AppCoachView.vue'),
        meta: { tab: 'app.schedule' },
      },
      {
        path: 'check-in/:token([A-Za-z0-9]{40})',
        name: 'app.checkin',
        component: () => import('@/views/app/AppCheckInView.vue'),
        meta: { tab: 'app.home' },
      },
      {
        path: 'attendance',
        name: 'app.attendance',
        component: () => import('@/views/app/AppAttendanceView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'waivers',
        name: 'app.waivers',
        component: () => import('@/views/app/AppWaiversView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'waivers/:id(\\d+)',
        name: 'app.waiver',
        component: () => import('@/views/app/AppWaiverSignView.vue'),
        meta: { tab: 'app.account' },
      },
      {
        path: 'inbox',
        name: 'app.inbox',
        component: () => import('@/views/app/AppInboxView.vue'),
      },
    ],
  },
  // A child's term progress report for their parent to print or save as PDF (US-11.27).
  {
    path: '/app/print/family/:id(\\d+)/report',
    name: 'app.print.report',
    component: () => import('@/views/tenant/academy/ProgressReportPrintView.vue'),
    meta: { clientApp: true, clientDocument: true },
  },
  // A client's invoice or receipt to print or save as PDF (US-11.14), outside the app shell.
  {
    path: '/app/print/invoices/:id(\\d+)',
    name: 'app.print.invoice',
    component: () => import('@/views/tenant/invoices/InvoicePrintView.vue'),
    meta: { clientApp: true, clientDocument: true },
  },
  {
    path: '/app/print/receipts/:id(\\d+)',
    name: 'app.print.receipt',
    component: () => import('@/views/tenant/ReceiptView.vue'),
    meta: { clientApp: true, clientDocument: true },
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
    if (to.matched.some((r) => r.meta.clientApp)) return clientGuard(to)
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
    // The kiosk handles its own 401s (an expired kiosk session or an unpaired device).
    if (router.currentRoute.value.meta.kiosk) return
    if (router.currentRoute.value.matched.some((r) => r.meta.clientApp)) {
      const app = useClientApp()
      if (!app.signedIn) return
      app.forget()
      router.replace({ name: 'app.signin' })
      return
    }
    const auth = useStaffAuth()
    if (!auth.signedIn) return
    auth.forget()
    router.replace({ name: 'tenant.signin', query: { expired: '1' } })
  })
}

/**
 * The client app's pages (EP-11): closed when the owner turned it off (US-11.01); guests sign in or
 * up; an account verifies its email or mobile before anything else (US-11.03).
 */
async function clientGuard(to: RouteLocationNormalized) {
  const app = useClientApp()
  const config = await app.loadConfig().catch(() => null)
  if (!config?.enabled) return to.name === 'app.closed' ? true : { name: 'app.closed' }
  if (to.meta.clientOpen) return true
  const signedIn = await app.check()
  if (!signedIn)
    return to.meta.clientGuest ? true : { name: 'app.signin', query: { redirect: to.fullPath } }
  if (!app.verified) return to.meta.clientUnverified ? true : { name: 'app.verify' }
  if (to.meta.clientGuest) return { name: 'app.home' }
  return true
}

export default router
