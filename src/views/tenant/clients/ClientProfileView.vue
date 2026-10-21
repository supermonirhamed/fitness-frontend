<script setup lang="ts">
// The 360° client profile (US-05.05), as the design's ClientProfile (ui_kits/admin/ClientsScreen.jsx,
// brief 06 §3). Header: photo, name, status, member ID, contact, home branch and alerts (health
// note, blocked, unpaid desk bookings); actions Edit and Book (sell, check-in and message come with
// EP-07/08/12). Tabs: Overview, Bookings, Attendance, Payments, Timeline; Family, Waivers, Notes
// and Memberships arrive with their stories.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Message from 'primevue/message'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import BookingDetailsDrawer from '@/components/bookings/BookingDetailsDrawer.vue'
import ClientFamilyTab from '@/components/clients/ClientFamilyTab.vue'
import ClientHealthCard from '@/components/clients/ClientHealthCard.vue'
import ClientAccountCreditCard from '@/components/clients/ClientAccountCreditCard.vue'
import ClientInvoicesCard from '@/components/clients/ClientInvoicesCard.vue'
import ClientAcademyTab from '@/components/academy/ClientAcademyTab.vue'
import ClientMembershipsTab from '@/components/clients/ClientMembershipsTab.vue'
import ClientPaymentsCard from '@/components/clients/ClientPaymentsCard.vue'
import ClientMessagesTab from '@/components/clients/ClientMessagesTab.vue'
import ClientNotesTab from '@/components/clients/ClientNotesTab.vue'
import KioskPinDrawer from '@/components/clients/KioskPinDrawer.vue'
import MergeClientsDialog from '@/components/clients/MergeClientsDialog.vue'
import ClientTimeline from '@/components/clients/ClientTimeline.vue'
import ClientWaiversTab from '@/components/clients/ClientWaiversTab.vue'
import NewClientDrawer from '@/components/clients/NewClientDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AttendanceEntry,
  type Booking,
  type Client,
  type ClientOverview,
  type Payment,
  type Tag as TagItem,
} from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const client = ref<Client | null>(null)
const overview = ref<ClientOverview | null>(null)
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'overview')
const id = computed(() => Number(route.params.id))

async function load() {
  state.value = 'loading'
  try {
    client.value = await tenantApi.clients.get(id.value)
    state.value = 'ready'
    loadOverview()
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
async function loadOverview() {
  overview.value = await tenantApi.clients.overview(id.value).catch(() => null)
}
onMounted(load)
watch(id, () => {
  tab.value = 'overview'
  load()
})
const qrUrl = computed(() => (client.value ? `/api/clients/${client.value.id}/qr` : null))
const blocked = computed(() => client.value?.status === 'Blocked')

// Status (US-05.13): block, deactivate, reactivate, delete personal data.
const canManage = computed(() => auth.can('clients.delete') && !client.value?.anonymized)
const statusMenu = ref<InstanceType<typeof Menu>>()
const statusAction = ref<'deactivate' | 'reactivate' | 'block' | 'unblock' | null>(null)
const anonymizeOpen = ref(false)
const mergeOpen = ref(false)
const pinOpen = ref(false)
function onMerged(merged: Client) {
  client.value = merged
  toast.add({ severity: 'success', summary: t('merge.done'), life: 4000 })
  loadOverview()
}
const anonymizeReason = ref('')
const anonymizeName = ref('')
const statusBusy = ref(false)
const statusItems = computed(() => {
  const s = client.value?.status
  const item = (action: NonNullable<typeof statusAction.value>, icon: string) => ({
    label: t(`clientStatus.actions.${action}`),
    icon: `pi ${icon}`,
    command: () => (statusAction.value = action),
  })
  // Kiosk PIN (US-08.05) for front-desk staff too; the rest needs clients.delete.
  const pinItem = {
    label: t('kioskPin.title'),
    icon: 'pi pi-key',
    command: () => (pinOpen.value = true),
  }
  if (!canManage.value)
    return auth.can('clients.update') && !client.value?.anonymized ? [pinItem] : []
  return [
    pinItem,
    ...(s === 'Blocked' ? [item('unblock', 'pi-unlock')] : [item('block', 'pi-ban')]),
    ...(s === 'Inactive'
      ? [item('reactivate', 'pi-replay')]
      : s !== 'Blocked'
        ? [item('deactivate', 'pi-pause')]
        : []),
    { label: t('merge.title'), icon: 'pi pi-clone', command: () => (mergeOpen.value = true) },
    { separator: true },
    {
      label: t('clientStatus.actions.anonymize'),
      icon: 'pi pi-eraser',
      class: 'menu-danger',
      command: () => {
        anonymizeReason.value = ''
        anonymizeName.value = ''
        anonymizeOpen.value = true
      },
    },
  ]
})
async function applyStatus(reason?: string) {
  if (!client.value || !statusAction.value) return
  statusBusy.value = true
  try {
    client.value = await tenantApi.clients.setStatus(
      client.value.id,
      statusAction.value,
      reason ?? null,
    )
    toast.add({
      severity: 'success',
      summary: t(`clientStatus.done.${statusAction.value}`),
      life: 3000,
    })
    statusAction.value = null
    loadOverview()
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    statusBusy.value = false
  }
}
async function anonymize() {
  if (!client.value) return
  statusBusy.value = true
  try {
    client.value = await tenantApi.clients.anonymize(client.value.id, anonymizeReason.value.trim())
    anonymizeOpen.value = false
    toast.add({ severity: 'success', summary: t('clientStatus.done.anonymize'), life: 4000 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    statusBusy.value = false
  }
}

// Tags (US-05.12)
const tagsOpen = ref(false)
const allTags = ref<TagItem[]>([])
const tagSelection = ref<number[]>([])
const tagsSaving = ref(false)
async function openTags() {
  allTags.value = await tenantApi.tags.list().catch(() => [])
  tagSelection.value = (client.value?.tags ?? []).map((tag) => tag.id)
  tagsOpen.value = true
}
async function saveTags() {
  if (!client.value) return
  tagsSaving.value = true
  try {
    client.value = {
      ...client.value,
      tags: await tenantApi.tags.setForClient(client.value.id, tagSelection.value),
    }
    tagsOpen.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    tagsSaving.value = false
  }
}

// Edit
const editOpen = ref(false)
function onEdited(updated: Client) {
  client.value = updated
  toast.add({ severity: 'success', summary: t('clients.updated'), life: 3000 })
}
// Book: from a session on the calendar.
const book = () => router.push({ name: 'tenant.calendar' })

// Bookings and attendance tabs: the bookings list for this client.
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const yesterday = () => {
  const d = new Date(Date.now() - 864e5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const when = ref<'upcoming' | 'past'>('upcoming')
const bookings = ref<Booking[] | null>(null)
const attendance = ref<AttendanceEntry[] | null>(null)
const ATTENDANCE_SEVERITY: Record<string, string> = {
  attended: 'success',
  late: 'warn',
  excused: 'info',
  no_show: 'danger',
  late_cancel: 'secondary',
}
const payments = ref<Payment[] | null>(null)
async function loadBookings() {
  bookings.value = null
  bookings.value = (
    await tenantApi.bookings
      .list({
        client_id: id.value,
        ...(when.value === 'upcoming'
          ? { from: today() }
          : { to: yesterday(), order: 'desc' as const }),
        per_page: 50,
      })
      .catch(() => ({ data: [] }))
  ).data
}
async function loadAttendance() {
  attendance.value = await tenantApi.clients.attendance(id.value).catch(() => [])
}
async function loadPayments() {
  payments.value = await tenantApi.clients.payments(id.value).catch(() => [])
}
// Also when the profile opens on a tab (?tab=payments).
watch(
  tab,
  (value) => {
    if (value === 'bookings' && !bookings.value) loadBookings()
    if (value === 'attendance' && !attendance.value) loadAttendance()
    if (value === 'payments' && !payments.value) loadPayments()
  },
  { immediate: true },
)
watch(when, loadBookings)

const detailsOpen = ref(false)
const openId = ref<number | null>(null)
function openBooking(b: Booking) {
  openBookingId(b.id)
}
// A payment voided: payments and invoices reload (the invoices card remounts on the tab).
const invoicesKey = ref(0)
function onPaymentVoided() {
  loadPayments()
  invoicesKey.value++
}
function openBookingId(bookingId: number) {
  openId.value = bookingId
  detailsOpen.value = true
}
function onBookingChanged() {
  bookings.value = null
  attendance.value = null
  payments.value = null
  loadOverview()
  if (tab.value === 'bookings') loadBookings()
  if (tab.value === 'attendance') loadAttendance()
  if (tab.value === 'payments') loadPayments()
}

const whenOptions = computed(() => [
  { value: 'upcoming', label: t('clientProfile.upcoming') },
  { value: 'past', label: t('clientProfile.past') },
])
const PAYMENT_SEVERITY = { unpaid: 'danger', partial: 'warn', paid: 'success' } as const
</script>

<template>
  <div class="page">
    <nav class="crumbs" :aria-label="t('shell.breadcrumb')">
      <RouterLink :to="{ name: 'tenant.clients' }">{{ t('clients.title') }}</RouterLink>
      <i class="pi pi-chevron-right pi-dir" aria-hidden="true" />
      <span aria-current="page">{{ client?.name }}</span>
    </nav>

    <div v-if="state === 'loading'" class="card head"><Skeleton height="80px" /></div>
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-search"
      :title="t('clients.missing')"
      :body="t('clients.missingHint')"
    />
    <ErrorState
      v-else-if="state === 'error' || !client"
      class="card"
      :title="t('clients.loadError')"
      @retry="load"
    />
    <template v-else>
      <div class="card head">
        <PersonAvatar :name="client.name" :image="client.photo_url" size="xl" />
        <div class="head__text">
          <div class="head__title">
            <h1>{{ client.name }}</h1>
            <StatusTag :status="client.status" />
          </div>
          <div class="head__meta">
            <span class="mono">{{ client.member_id }}</span>
            <span v-if="client.mobile" dir="ltr">{{ client.mobile }}</span>
            <Tag
              v-if="client.mobile_invalid"
              severity="warn"
              :value="t('clients.mobileInvalid')"
              v-tooltip.bottom="t('clients.mobileInvalidHint')"
            />
            <span v-if="client.email" dir="ltr">{{ client.email }}</span>
            <Tag
              v-if="client.email_bounced"
              severity="danger"
              :value="t('clients.emailBounced')"
              v-tooltip.bottom="client.email_bounce_reason ?? t('clients.emailBouncedHint')"
            />
            <span v-if="client.home_location"
              ><i class="pi pi-map-marker" aria-hidden="true" />{{
                client.home_location.name
              }}</span
            >
            <span v-if="client.age !== null">{{ t('clients.age', { n: client.age }) }}</span>
          </div>
          <div class="head__alerts">
            <Tag
              v-for="tag in client.tags ?? []"
              :key="`tag-${tag.id}`"
              class="tag-sm"
              :value="tag.name"
              :style="tag.color ? { background: tag.color, color: '#fff' } : undefined"
            />
            <Button
              v-if="auth.can('clients.update')"
              size="small"
              variant="text"
              icon="pi pi-tag"
              :label="t('clientProfile.editTags')"
              class="tags-btn"
              @click="openTags"
            />
            <Tag
              v-if="blocked"
              severity="danger"
              icon="pi pi-ban"
              class="tag-sm"
              :value="t('clientProfile.alerts.blocked')"
            />
            <Tag
              v-if="client.has_health_notes"
              severity="danger"
              icon="pi pi-heart"
              class="tag-sm"
              :value="t('clientHealth.alert')"
            />
            <Tag
              v-for="injury in overview?.alerts.injuries ?? []"
              :key="injury.id"
              v-tooltip.bottom="`${injury.body} — ${injury.author ?? ''}`"
              severity="danger"
              icon="pi pi-exclamation-triangle"
              class="tag-sm"
              :value="t('academy.notes.injuryAlert')"
            />
            <Tag
              v-if="overview?.alerts.unpaid_bookings"
              severity="warn"
              icon="pi pi-wallet"
              class="tag-sm"
              :value="t('clientProfile.alerts.unpaid', overview.alerts.unpaid_bookings)"
            />
            <Tag
              v-if="overview?.alerts.balance?.overdue"
              severity="danger"
              icon="pi pi-exclamation-triangle"
              class="tag-sm"
              :value="
                t('clientProfile.alerts.overdue', {
                  amount: format.money(overview.alerts.balance.overdue),
                })
              "
            />
            <Tag
              v-if="overview?.alerts.uncovered_bookings"
              severity="warn"
              icon="pi pi-id-card"
              class="tag-sm"
              :value="t('clientProfile.alerts.uncovered', overview.alerts.uncovered_bookings)"
            />
          </div>
        </div>
        <div class="head__actions">
          <Button
            v-if="client.mobile"
            as="a"
            :href="`tel:${client.mobile}`"
            icon="pi pi-phone"
            severity="secondary"
            variant="outlined"
            :aria-label="t('clientProfile.call')"
          />
          <Button
            v-if="client.email"
            as="a"
            :href="`mailto:${client.email}`"
            icon="pi pi-envelope"
            severity="secondary"
            variant="outlined"
            :aria-label="t('clientProfile.email')"
          />
          <Button
            v-if="auth.can('clients.update')"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            severity="secondary"
            variant="outlined"
            @click="editOpen = true"
          />
          <span v-tooltip.bottom="t('sessionPage.later')">
            <Button
              icon="pi pi-qrcode"
              :label="t('sessionPage.checkIn')"
              severity="secondary"
              disabled
            />
          </span>
          <template v-if="statusItems.length">
            <Button
              icon="pi pi-ellipsis-v"
              severity="secondary"
              variant="outlined"
              :aria-label="t('clientStatus.more')"
              @click="statusMenu?.toggle($event)"
            />
            <Menu ref="statusMenu" :model="statusItems" popup />
          </template>
          <Button
            v-if="auth.can('bookings.create')"
            icon="pi pi-plus"
            :label="t('clientProfile.book')"
            :disabled="blocked"
            @click="book"
          />
        </div>
      </div>

      <Message
        v-if="client.anonymized"
        severity="secondary"
        :closable="false"
        icon="pi pi-eraser"
        >{{ t('clientStatus.anonymizedBanner') }}</Message
      >
      <Message v-else-if="blocked" severity="error" :closable="false" icon="pi pi-ban">{{
        t('clientStatus.blockedBanner', { reason: client.status_reason ?? '—' })
      }}</Message>
      <Message
        v-else-if="client.status === 'Inactive'"
        severity="secondary"
        :closable="false"
        icon="pi pi-pause"
        >{{ t('clientStatus.inactiveBanner', { reason: client.status_reason ?? '—' }) }}</Message
      >

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="overview">{{ t('clientProfile.tabs.overview') }}</Tab>
          <Tab v-if="auth.can('bookings.view')" value="bookings">{{
            t('clientProfile.tabs.bookings')
          }}</Tab>
          <Tab v-if="auth.can('bookings.view')" value="attendance">{{
            t('clientProfile.tabs.attendance')
          }}</Tab>
          <Tab v-if="auth.can('payments.view')" value="payments">{{
            t('clientProfile.tabs.payments')
          }}</Tab>
          <Tab value="family">{{ t('clientProfile.tabs.family') }}</Tab>
          <Tab value="waivers">{{ t('clientProfile.tabs.waivers') }}</Tab>
          <Tab value="notes">{{ t('clientProfile.tabs.notes') }}</Tab>
          <Tab v-if="auth.can('academy.view')" value="academy">{{
            t('clientProfile.tabs.academy')
          }}</Tab>
          <Tab value="messages">{{ t('clientProfile.tabs.messages') }}</Tab>
          <Tab value="timeline">{{ t('clientProfile.tabs.timeline') }}</Tab>
          <Tab v-if="auth.can('entitlements.view')" value="memberships">{{
            t('clientProfile.tabs.memberships')
          }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="overview">
            <div class="grid">
              <div class="stack">
                <section class="card pad">
                  <h3 class="card__title">{{ t('clientProfile.nextBookings') }}</h3>
                  <p v-if="!overview" class="muted"><Skeleton height="40px" /></p>
                  <p v-else-if="!overview.upcoming.length" class="muted">
                    {{ t('clientProfile.noUpcoming') }}
                  </p>
                  <ul v-else class="rows">
                    <li
                      v-for="b in overview.upcoming"
                      :key="b.id"
                      class="row-click"
                      @click="openBooking(b)"
                    >
                      <span class="num rows__when"
                        >{{ b.session?.local.date }} {{ b.session?.local.start }}</span
                      >
                      <span class="rows__what">{{ b.session?.service }}</span>
                      <StatusTag :status="b.status" size="sm" />
                      <Tag
                        v-if="b.payment_status && b.payment_status !== 'not_required'"
                        class="tag-sm"
                        :severity="
                          PAYMENT_SEVERITY[b.payment_status as 'unpaid' | 'partial' | 'paid']
                        "
                        :value="t(`payments.status.${b.payment_status}`)"
                      />
                    </li>
                  </ul>
                </section>
                <ClientHealthCard :client-id="client.id" @changed="load" />
              </div>
              <div class="stack">
                <section class="card pad">
                  <h3 class="card__title">{{ t('clientProfile.attendance') }}</h3>
                  <div v-if="overview" class="rates">
                    <div v-for="key in ['last_30', 'last_90'] as const" :key="key" class="rate">
                      <span class="rate__value num">{{
                        overview.attendance[key].rate === null
                          ? '—'
                          : `${overview.attendance[key].rate}%`
                      }}</span>
                      <small class="muted">{{
                        t(`clientProfile.${key}`, {
                          attended: overview.attendance[key].attended,
                          noShows: overview.attendance[key].no_shows,
                        })
                      }}</small>
                    </div>
                  </div>
                </section>
                <div class="card qr">
                  <div class="qr__title">{{ t('clients.checkInCode') }}</div>
                  <img
                    v-if="qrUrl"
                    :src="qrUrl"
                    :alt="t('clients.checkInCode')"
                    width="160"
                    height="160"
                  />
                  <div class="qr__id mono">{{ client.member_id }}</div>
                  <small class="qr__hint">{{ t('clients.checkInHint') }}</small>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="bookings">
            <div class="card">
              <div class="tab-bar">
                <SelectButton
                  v-model="when"
                  :options="whenOptions"
                  option-label="label"
                  option-value="value"
                  :allow-empty="false"
                />
              </div>
              <DataTable
                :value="bookings ?? []"
                :loading="bookings === null"
                data-key="id"
                :row-class="() => 'row-click'"
                @row-click="openBooking($event.data)"
              >
                <template #empty>
                  <EmptyState compact icon="pi-calendar" :title="t('clientProfile.noBookings')" />
                </template>
                <Column :header="t('bookings.columns.when')">
                  <template #body="{ data }">
                    <span class="num"
                      >{{ data.session?.local.date }} {{ data.session?.local.start }}</span
                    >
                  </template>
                </Column>
                <Column :header="t('bookings.columns.session')">
                  <template #body="{ data }">
                    {{ data.session?.service }}
                    <small class="muted">· {{ data.session?.location.name }}</small>
                  </template>
                </Column>
                <Column :header="t('bookings.columns.status')">
                  <template #body="{ data }"
                    ><StatusTag :status="data.status" size="sm"
                  /></template>
                </Column>
                <Column :header="t('booking.payment')">
                  <template #body="{ data }">
                    {{
                      data.entitlement_source
                        ? t(`booking.payments.${data.entitlement_source}`)
                        : '—'
                    }}
                    <Tag
                      v-if="data.payment_status && data.payment_status !== 'not_required'"
                      class="tag-sm"
                      :severity="
                        PAYMENT_SEVERITY[data.payment_status as 'unpaid' | 'partial' | 'paid']
                      "
                      :value="t(`payments.status.${data.payment_status}`)"
                    />
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel value="attendance">
            <!-- Attendance history (US-08.09) -->
            <div class="card">
              <DataTable
                :value="attendance ?? []"
                :loading="attendance === null"
                :data-key="(r: AttendanceEntry) => `${r.type}-${r.id}`"
              >
                <template #empty>
                  <EmptyState
                    compact
                    icon="pi-check-square"
                    :title="t('clientProfile.noAttendance')"
                  />
                </template>
                <Column :header="t('bookings.columns.when')">
                  <template #body="{ data }">
                    <span class="num">{{ format.date(data.date) }} {{ data.time }}</span>
                  </template>
                </Column>
                <Column :header="t('bookings.columns.session')">
                  <template #body="{ data }">
                    {{ data.title }}
                    <div v-if="data.coach" class="muted">{{ data.coach }}</div>
                  </template>
                </Column>
                <Column :header="t('invoices.branch')">
                  <template #body="{ data }">{{ data.location }}</template>
                </Column>
                <Column :header="t('bookings.columns.status')">
                  <template #body="{ data }">
                    <Tag
                      class="tag-sm"
                      :severity="ATTENDANCE_SEVERITY[data.status] ?? 'secondary'"
                      :value="t(`attendanceHistory.status.${data.status}`)"
                    />
                  </template>
                </Column>
                <Column :header="t('attendanceHistory.method')">
                  <template #body="{ data }">
                    <span class="muted">{{
                      data.method ? t(`attendanceHistory.methods.${data.method}`, data.method) : '—'
                    }}</span>
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel value="payments">
            <div class="payments-tab">
              <ClientAccountCreditCard
                v-if="tab === 'payments' && auth.can('payments.view')"
                :key="`credit-${invoicesKey}`"
                :client-id="client.id"
                @changed="invoicesKey++"
              />
              <ClientInvoicesCard
                v-if="tab === 'payments'"
                :key="invoicesKey"
                :client-id="client.id"
                @paid="loadPayments"
              />
              <ClientPaymentsCard
                :payments="payments"
                @open-booking="openBookingId"
                @changed="onPaymentVoided"
              />
            </div>
          </TabPanel>

          <TabPanel value="family">
            <ClientFamilyTab v-if="tab === 'family'" :client="client" @changed="loadOverview" />
          </TabPanel>
          <TabPanel value="waivers">
            <ClientWaiversTab v-if="tab === 'waivers'" :client-id="client.id" />
          </TabPanel>
          <TabPanel value="notes">
            <ClientNotesTab v-if="tab === 'notes'" :client-id="client.id" />
          </TabPanel>
          <TabPanel value="academy">
            <ClientAcademyTab v-if="tab === 'academy'" :client-id="client.id" />
          </TabPanel>
          <TabPanel value="memberships">
            <ClientMembershipsTab v-if="tab === 'memberships'" :client-id="client.id" />
          </TabPanel>
          <TabPanel value="messages">
            <ClientMessagesTab v-if="tab === 'messages'" :client-id="client.id" />
          </TabPanel>
          <TabPanel value="timeline">
            <ClientTimeline v-if="tab === 'timeline'" :client-id="client.id" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>

    <KioskPinDrawer
      v-if="client"
      v-model:visible="pinOpen"
      :client="client"
      @changed="(has: boolean) => client && (client.has_kiosk_pin = has)"
    />
    <MergeClientsDialog
      v-if="client"
      v-model:visible="mergeOpen"
      :client="client"
      @merged="onMerged"
    />
    <OverrideDialog
      :visible="statusAction === 'block' || statusAction === 'deactivate'"
      :title="statusAction ? t(`clientStatus.titles.${statusAction}`, { name: client?.name }) : ''"
      :description="statusAction ? t(`clientStatus.descriptions.${statusAction}`) : ''"
      :confirm-label="statusAction ? t(`clientStatus.actions.${statusAction}`) : ''"
      :loading="statusBusy"
      destructive
      @update:visible="(v: boolean) => !v && (statusAction = null)"
      @confirm="applyStatus"
    />
    <ConfirmActionDialog
      :visible="statusAction === 'reactivate' || statusAction === 'unblock'"
      :title="statusAction ? t(`clientStatus.titles.${statusAction}`, { name: client?.name }) : ''"
      :confirm-label="statusAction ? t(`clientStatus.actions.${statusAction}`) : ''"
      :loading="statusBusy"
      @update:visible="(v: boolean) => !v && (statusAction = null)"
      @confirm="applyStatus()"
    />
    <FormDialog
      v-model:visible="anonymizeOpen"
      :title="t('clientStatus.titles.anonymize', { name: client?.name })"
      icon="pi-eraser"
      danger
      :saving="statusBusy"
      :save-label="t('clientStatus.actions.anonymize')"
      :save-disabled="anonymizeReason.trim().length < 3 || anonymizeName.trim() !== client?.name"
      @save="anonymize"
    >
      <Message severity="error" :closable="false" icon="pi pi-exclamation-triangle">{{
        t('clientStatus.descriptions.anonymize')
      }}</Message>
      <FormField
        :label="t('clientStatus.anonymizeReason')"
        for="anon-reason"
        required
        :help="t('clientStatus.reasonHelp')"
      >
        <InputText id="anon-reason" v-model="anonymizeReason" maxlength="500" fluid />
      </FormField>
      <FormField :label="t('clientStatus.typeName', { name: client?.name })" for="anon-name">
        <InputText
          id="anon-name"
          v-model="anonymizeName"
          fluid
          autocomplete="off"
          :invalid="!!anonymizeName.trim() && anonymizeName.trim() !== client?.name"
        />
      </FormField>
    </FormDialog>
    <FormDialog
      v-model:visible="tagsOpen"
      :title="t('clientProfile.editTags')"
      :subtitle="client?.name"
      icon="pi-tags"
      size="sm"
      :saving="tagsSaving"
      @save="saveTags"
    >
      <FormField
        :label="t('segments.tags')"
        for="client-tags"
        :help="allTags.length ? undefined : t('clientProfile.noTagsYet')"
      >
        <MultiSelect
          v-model="tagSelection"
          input-id="client-tags"
          :options="allTags"
          option-label="name"
          option-value="id"
          display="chip"
          filter
          fluid
          :placeholder="t('clientProfile.pickTags')"
        >
          <template #option="{ option }">
            <span class="tag-opt"
              ><span class="tag-dot" :style="{ background: option.color }" />{{ option.name }}</span
            >
          </template>
        </MultiSelect>
      </FormField>
    </FormDialog>
    <NewClientDrawer v-model:visible="editOpen" :client="client" @saved="onEdited" />
    <BookingDetailsDrawer
      v-model:visible="detailsOpen"
      :booking-id="openId"
      @changed="onBookingChanged"
    />
  </div>
</template>

<style scoped>
.tag-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.crumbs a {
  color: var(--text-link);
  text-decoration: none;
}
.crumbs i {
  font-size: 10px;
}
.payments-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card__head {
  padding: 14px 16px 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.card__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.card__title {
  font: var(--text-h4);
  margin: 0 0 12px;
}
.head {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  padding: 20px;
}
.head__text {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head__title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.head__title h1 {
  margin: 0;
  font: var(--text-h1);
}
.head__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.head__meta i {
  font-size: 12px;
  margin-inline-end: 4px;
}
.head__alerts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.head__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.anon {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mono {
  font-family: var(--font-mono);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rows li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border-subtle);
}
.rows__when {
  width: 130px;
}
.rows__what {
  flex: 1;
}
.row-click {
  cursor: pointer;
}
.rates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.rate {
  display: flex;
  flex-direction: column;
}
.rate__value {
  font: var(--text-display, 600 28px var(--font-sans));
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.tab-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
}
.qr {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qr__title {
  font: var(--text-h4);
  align-self: flex-start;
}
.qr__id {
  font: 600 14px var(--font-mono);
}
.qr__hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
:deep(.row-click) {
  cursor: pointer;
}
@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
