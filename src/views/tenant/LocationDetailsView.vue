<script setup lang="ts">
// Branch details (US-01.04) as in the design (ui_kits/admin/BranchDetails.jsx): breadcrumb header
// with zone badge and a "⋯" menu, Draft / Inactive banners with their action, and tabs Overview,
// Business hours (US-01.06), Holidays (US-01.07), Facilities (US-01.08), Services (US-02.03),
// Staff, Tax/VAT, Booking policies (US-01.02) and Activity.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import type { MenuItem } from 'primevue/menuitem'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import ActivityTimeline from '@/components/patterns/ActivityTimeline.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusBanner from '@/components/patterns/StatusBanner.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import ZoneBadge from '@/components/patterns/ZoneBadge.vue'
import CheckInQrDialog from '@/components/locations/CheckInQrDialog.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import BusinessHoursEditor from '@/components/locations/BusinessHoursEditor.vue'
import VatPanel from '@/components/locations/VatPanel.vue'
import PaymentMethodsPanel from '@/components/locations/PaymentMethodsPanel.vue'
import FacilitiesPanel from '@/components/locations/FacilitiesPanel.vue'
import HourOverridesSection from '@/components/locations/HourOverridesSection.vue'
import DeactivateLocationDialog from '@/components/locations/DeactivateLocationDialog.vue'
import LocationFormDrawer from '@/components/locations/LocationFormDrawer.vue'
import BookingPolicyFields from '@/components/policies/BookingPolicyFields.vue'
import {
  tenantApi,
  type BookingPolicyOverrides,
  type LocationBookingPolicy,
  type BookingPolicyOptions,
  type LocationDetails,
  type LocationStaffMember,
  type Service,
  type VatSettings,
  type WeeklyHours,
} from '@/api/tenant'
import { statusOf, validationErrors } from '@/lib/http'
import { toOverrides } from '@/lib/bookingPolicy'
import { useRouter } from 'vue-router'
import { errorCode } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const { t, te, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const location = ref<LocationDetails>()
const route = useRoute()
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'overview')
const router = useRouter()
const canEdit = computed(() => auth.can('locations.update'))

async function load() {
  state.value = 'loading'
  try {
    location.value = await tenantApi.location(props.id)
    state.value = 'ready'
  } catch (e) {
    // 404 also covers branches outside the user's access (US-00.09).
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
watch(() => props.id, load)

const figures = computed(() => {
  const s = location.value?.stats
  if (!s) return []
  return [
    { key: 'today_sessions', value: s.today_sessions },
    { key: 'staff', value: s.staff },
    { key: 'facilities', value: s.facilities },
    { key: 'active_services', value: s.active_services },
  ]
})

// Overview "Key facts": today's opening hours and VAT.
const hours = ref<WeeklyHours | null | undefined>(undefined)
const vat = ref<VatSettings | null>(null)
watch(
  [tab, () => location.value?.id],
  async ([value, id]) => {
    if (value !== 'overview' || !id || hours.value !== undefined) return
    const [h, v] = await Promise.allSettled([
      tenantApi.businessHours(id),
      auth.can('locations.vat') || auth.can('locations.view')
        ? tenantApi.vat.get(id)
        : Promise.reject(),
    ])
    hours.value = h.status === 'fulfilled' ? h.value.hours : null
    vat.value = v.status === 'fulfilled' ? v.value : null
  },
  { immediate: true },
)
const todayHours = computed(() => {
  if (!hours.value || !location.value) return null
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: location.value.timezone,
  }).format(new Date())
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
  const ranges = hours.value[String(index)] ?? []
  return ranges.length
    ? ranges.map((r) => `${r.start}–${r.end}`).join('، ')
    : t('branchPage.closedToday')
})
const vatLine = computed(() => {
  const v = vat.value
  if (!v) return null
  if (!v.enabled) return t('branchPage.vatOff')
  return `${v.rate ?? '—'}% · ${v.prices_include_vat ? t('branchPage.inclusive') : t('branchPage.exclusive')}`
})

// Header "⋯" menu: Deactivate / Activate, Archive (only once the branch isn't active).
const archiveOpen = ref(false)
const archiving = ref(false)
const archiveError = ref<string | null>(null)
const qrOpen = ref(false)
const moreItems = computed<MenuItem[]>(() => {
  const l = location.value
  if (!l) return []
  const qr: MenuItem = {
    label: t('checkInQr.title'),
    icon: 'pi pi-qrcode',
    command: () => (qrOpen.value = true),
  }
  if (!canChangeStatus.value) return [qr]
  return [
    qr,
    l.status === 'Active'
      ? {
          label: t('deactivateLocation.action'),
          icon: 'pi pi-power-off',
          class: 'menu-danger',
          command: () => (deactivateOpen.value = true),
        }
      : { label: t('branchPage.activate'), icon: 'pi pi-check-circle', command: activate },
    {
      label:
        l.status === 'Active'
          ? `${t('archive.archive')} — ${t('branchPage.deactivateFirst')}`
          : t('archive.archive'),
      icon: 'pi pi-inbox',
      disabled: l.status === 'Active',
      command: () => {
        archiveError.value = null
        archiveOpen.value = true
      },
    },
  ]
})
async function archive() {
  if (!location.value) return
  archiving.value = true
  archiveError.value = null
  try {
    await tenantApi.archiveLocation(location.value.id)
    toast.add({
      severity: 'success',
      summary: t('archive.archivedToast', { name: location.value.name }),
      life: 4000,
    })
    if (auth.user?.location_ids !== null) await auth.check(true)
    router.push({ name: 'tenant.branches' })
  } catch (e) {
    archiveError.value =
      errorCode(e) === 'last_location' ? t('locationsPage.lastLocation') : t('common.genericError')
  } finally {
    archiving.value = false
  }
}

const mapUrl = computed(() => {
  const l = location.value
  return l?.latitude != null && l?.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=17/${l.latitude}/${l.longitude}`
    : null
})

// Edit
const formOpen = ref(false)
function onSaved(saved: LocationDetails) {
  location.value = { ...location.value, ...saved }
  toast.add({
    severity: 'success',
    summary: t('locationForm.saved', { name: saved.name }),
    life: 4000,
  })
}

// Deactivate / activate (US-01.05)
const canChangeStatus = computed(() => auth.can('locations.delete'))
const deactivateOpen = ref(false)
const activating = ref(false)
function onDeactivated(saved: LocationDetails) {
  location.value = { ...location.value, ...saved }
  toast.add({
    severity: 'success',
    summary: t('deactivateLocation.done', { name: saved.name }),
    life: 4000,
  })
}
async function activate() {
  activating.value = true
  try {
    const saved = await tenantApi.activateLocation(props.id)
    location.value = { ...location.value, ...saved }
    toast.add({
      severity: 'success',
      summary: t('deactivateLocation.activated', { name: saved.name }),
      life: 4000,
    })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 5000 })
  } finally {
    activating.value = false
  }
}

// Staff tab
const staff = ref<{ data: LocationStaffMember[]; all_locations_count: number } | null>(null)
const staffState = ref<'idle' | 'loading' | 'ready' | 'error' | 'forbidden'>('idle')
async function loadStaff() {
  staffState.value = 'loading'
  try {
    staff.value = await tenantApi.locationStaff(props.id)
    staffState.value = 'ready'
  } catch (e) {
    staffState.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
const roleName = (role: string) => (te(`roles.${role}`) ? t(`roles.${role}`) : role)

// Booking policies tab (US-01.02): overrides of the organization defaults
const policy = ref<LocationBookingPolicy | null>(null)
const policyOptions = ref<BookingPolicyOptions>({ penalties: [], waitlist_modes: [] })
const overrides = ref<BookingPolicyOverrides>(toOverrides())
const savedOverrides = ref('')
const policyState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const policySaving = ref(false)
const policyError = ref<string | null>(null)
const policyErrors = ref<Record<string, string[]>>({})
const policyDirty = computed(() => JSON.stringify(overrides.value) !== savedOverrides.value)

function applyPolicy(result: LocationBookingPolicy) {
  policy.value = result
  overrides.value = toOverrides(result.overrides)
  savedOverrides.value = JSON.stringify(overrides.value)
}
async function loadPolicy() {
  policyState.value = 'loading'
  try {
    const result = await tenantApi.bookingPolicy.forLocation(props.id)
    policyOptions.value = result.options
    applyPolicy(result.data)
    policyState.value = 'ready'
  } catch {
    policyState.value = 'error'
  }
}
async function savePolicy() {
  policySaving.value = true
  policyError.value = null
  policyErrors.value = {}
  try {
    applyPolicy(await tenantApi.bookingPolicy.updateLocation(props.id, overrides.value))
    toast.add({ severity: 'success', summary: t('bookingPolicy.saved'), life: 3000 })
  } catch (e) {
    policyErrors.value = validationErrors(e)
    policyError.value = Object.keys(policyErrors.value).length
      ? t('bookingPolicy.checkFields')
      : t('common.genericError')
  } finally {
    policySaving.value = false
  }
}

watch(
  tab,
  (value) => {
    if (value === 'staff' && staffState.value === 'idle') loadStaff()
    if (value === 'policies' && policyState.value === 'idle') loadPolicy()
  },
  { immediate: true },
)
function discardPolicy() {
  overrides.value = JSON.parse(savedOverrides.value)
  policyErrors.value = {}
  policyError.value = null
}

// Services tab (US-02.03): what this branch offers; managed on the Services page (design).
const services = ref<Service[] | null>(null)
const servicesState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
async function loadServices() {
  servicesState.value = 'loading'
  try {
    services.value = (await tenantApi.services.list({ location_id: props.id })).filter(
      (s) => s.status !== 'Archived',
    )
    servicesState.value = 'ready'
  } catch {
    servicesState.value = 'error'
  }
}
watch(tab, (value) => value === 'services' && servicesState.value === 'idle' && loadServices(), {
  immediate: true,
})

// The facilities figure changes when facilities are added or archived.
async function refreshStats() {
  try {
    const fresh = await tenantApi.location(props.id)
    if (location.value) location.value = { ...location.value, stats: fresh.stats }
  } catch {
    // Figures stay as they were.
  }
}
</script>

<template>
  <div class="page">
    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="20px" width="20%" />
      <Skeleton height="32px" width="40%" />
      <Skeleton height="200px" />
    </div>
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-search"
      :title="t('locationDetails.missing')"
      :body="t('locationDetails.missingHint')"
    >
      <RouterLink :to="{ name: 'tenant.branches' }">{{ t('branches.title') }}</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="state === 'error' || !location"
      class="card"
      :title="t('locationDetails.loadError')"
      @retry="load"
    />

    <template v-else>
      <PageHeader
        :title="location.name"
        :breadcrumb="[
          { label: t('branches.title'), to: { name: 'tenant.branches' } },
          { label: location.name },
        ]"
        :more-items="moreItems"
      >
        <template #status>
          <StatusTag :status="location.status" />
          <ZoneBadge :timezone="location.timezone" with-name icon />
        </template>
        <template v-if="location.address" #meta>
          <span class="meta-address"
            ><i class="pi pi-map-marker" aria-hidden="true" />{{ location.address }}</span
          >
        </template>
        <template v-if="canEdit" #primary>
          <Button icon="pi pi-pencil" :label="t('common.edit')" @click="formOpen = true" />
        </template>
      </PageHeader>
      <CheckInQrDialog
        v-model:visible="qrOpen"
        :location-id="location.id"
        :location-name="location.name"
        :can-edit="canEdit"
      />

      <StatusBanner
        v-if="location.status === 'Draft'"
        severity="info"
        icon="pi-eye-slash"
        :title="t('branchPage.draftTitle')"
      >
        {{ t('branchPage.draftHint') }}
        <template v-if="canChangeStatus" #action>
          <Button
            size="small"
            :label="t('branchPage.activate')"
            :loading="activating"
            @click="activate"
          />
        </template>
      </StatusBanner>
      <StatusBanner
        v-else-if="location.status === 'Inactive'"
        severity="warn"
        icon="pi-power-off"
        :title="t('branchPage.inactiveTitle')"
      >
        {{ t('branchPage.inactiveHint') }}
        <template v-if="canChangeStatus" #action>
          <Button
            size="small"
            variant="outlined"
            severity="warn"
            :label="t('branchPage.reactivate')"
            :loading="activating"
            @click="activate"
          />
        </template>
      </StatusBanner>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="overview">{{ t('branchPage.tabs.overview') }}</Tab>
          <Tab value="hours">{{ t('locationDetails.tabs.hours') }}</Tab>
          <Tab value="holidays">{{ t('branchPage.tabs.holidays') }}</Tab>
          <Tab value="facilities"
            >{{ t('locationDetails.tabs.facilities')
            }}<span v-if="location.stats?.facilities != null" class="tab-count">{{
              location.stats.facilities
            }}</span></Tab
          >
          <Tab value="services"
            >{{ t('locationDetails.tabs.services')
            }}<span v-if="location.stats?.active_services != null" class="tab-count">{{
              location.stats.active_services
            }}</span></Tab
          >
          <Tab v-if="auth.can('staff.view')" value="staff"
            >{{ t('locationDetails.tabs.staff')
            }}<span v-if="location.stats" class="tab-count">{{ location.stats.staff }}</span></Tab
          >
          <Tab value="vat">{{ t('locationDetails.tabs.vat') }}</Tab>
          <Tab value="payments">{{ t('locationDetails.tabs.payments') }}</Tab>
          <Tab value="policies">{{ t('locationDetails.tabs.policies') }}</Tab>
          <Tab v-if="auth.can('audit.view')" value="activity">{{ t('details.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="overview">
            <div class="overview">
              <div class="card figures">
                <div v-for="f in figures" :key="f.key">
                  <div class="caption">{{ t(`locationDetails.figures.${f.key}`) }}</div>
                  <div class="figure num">{{ f.value ?? '—' }}</div>
                </div>
              </div>
              <div class="card facts">
                <div class="facts__title">{{ t('branchPage.keyFacts') }}</div>
                <div class="facts__row">
                  <span>{{ t('branchPage.today') }}</span
                  ><span dir="ltr">{{ todayHours ?? '—' }}</span>
                </div>
                <div v-if="vatLine" class="facts__row">
                  <span>{{ t('branchPage.vat') }}</span
                  ><span>{{ vatLine }}</span>
                </div>
                <div class="facts__row">
                  <span>{{ t('locationForm.fields.phone') }}</span
                  ><span dir="ltr">{{ location.phone || '—' }}</span>
                </div>
                <div v-if="location.email" class="facts__row">
                  <span>{{ t('locationForm.fields.email') }}</span
                  ><span dir="ltr">{{ location.email }}</span>
                </div>
                <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener" class="map"
                  ><i class="pi pi-map-marker" aria-hidden="true" />{{
                    t('locationDetails.openMap')
                  }}</a
                >
              </div>
              <div v-if="location.photo_url || location.description" class="card about">
                <img
                  v-if="location.photo_url"
                  :src="location.photo_url"
                  :alt="t('locationForm.photoAlt')"
                  class="photo"
                />
                <p v-if="location.description" class="pre">{{ location.description }}</p>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="hours">
            <BusinessHoursEditor
              v-if="tab === 'hours'"
              :location-id="location.id"
              :can-edit="canEdit"
            />
          </TabPanel>

          <TabPanel value="holidays">
            <HourOverridesSection
              v-if="tab === 'holidays'"
              :location-id="location.id"
              :timezone="location.timezone"
              :can-edit="canEdit"
            />
          </TabPanel>

          <TabPanel value="facilities">
            <FacilitiesPanel
              v-if="tab === 'facilities'"
              :location-id="location.id"
              :can-edit="canEdit"
              @changed="refreshStats"
            />
          </TabPanel>

          <TabPanel value="services">
            <div class="card">
              <div class="managed">
                <i class="pi pi-info-circle" aria-hidden="true" />{{
                  t('branchPage.servicesManaged')
                }}
                <RouterLink :to="{ name: 'tenant.services' }">{{ t('catalog.title') }}</RouterLink>
              </div>
              <div v-if="servicesState === 'loading'" class="pad">
                <Skeleton v-for="n in 3" :key="n" height="28px" />
              </div>
              <ErrorState v-else-if="servicesState === 'error'" compact @retry="loadServices" />
              <EmptyState
                v-else-if="!services?.length"
                compact
                icon="pi-th-large"
                :title="t('branchPage.noServices')"
              />
              <RouterLink
                v-for="s in services ?? []"
                v-else
                :key="s.id"
                :to="{ name: 'tenant.services.show', params: { id: s.id } }"
                class="link-row"
              >
                <span
                  class="swatch"
                  :style="{ background: s.color ?? 'var(--border-strong)' }"
                  aria-hidden="true"
                />
                <span class="link-row__name">{{ s.display_name }}</span>
                <StatusTag v-if="s.status !== 'Published'" :status="s.status" size="sm" />
                <i class="pi pi-arrow-up-right link-row__icon" aria-hidden="true" />
              </RouterLink>
            </div>
          </TabPanel>

          <TabPanel value="staff">
            <div class="card">
              <div class="managed">
                <i class="pi pi-info-circle" aria-hidden="true" />{{ t('branchPage.staffManaged') }}
                <RouterLink v-if="auth.can('staff.view')" :to="{ name: 'tenant.staff.users' }">{{
                  t('staff.title')
                }}</RouterLink>
              </div>
              <div v-if="staffState === 'loading'" class="pad">
                <Skeleton v-for="n in 3" :key="n" height="32px" />
              </div>
              <NoPermission v-else-if="staffState === 'forbidden'" compact />
              <ErrorState v-else-if="staffState === 'error'" compact @retry="loadStaff" />
              <template v-else-if="staff">
                <EmptyState
                  v-if="!staff.data.length"
                  compact
                  icon="pi-users"
                  :title="t('locationDetails.noStaff')"
                  :body="t('locationDetails.noStaffHint')"
                />
                <div v-for="member in staff.data" :key="member.id" class="person-row">
                  <PersonAvatar :name="member.name" />
                  <div class="person-row__text">
                    <div class="person-row__name">{{ member.name }}</div>
                    <div class="person-row__sub">
                      {{ member.roles.map(roleName).join(locale === 'ar' ? '، ' : ', ') }}
                    </div>
                  </div>
                  <StatusTag v-if="member.status !== 'Active'" :status="member.status" size="sm" />
                </div>
                <p class="note">
                  {{ t('locationDetails.allLocations', staff.all_locations_count) }}
                </p>
              </template>
            </div>
          </TabPanel>

          <TabPanel value="vat">
            <VatPanel
              v-if="tab === 'vat'"
              :location-id="location.id"
              :can-edit="auth.can('locations.vat')"
            />
          </TabPanel>

          <TabPanel value="payments">
            <PaymentMethodsPanel
              v-if="tab === 'payments'"
              :location-id="location.id"
              :can-edit="auth.can('locations.update')"
            />
          </TabPanel>

          <TabPanel value="policies">
            <div v-if="policyState === 'loading'" class="card pad">
              <Skeleton v-for="n in 4" :key="n" height="36px" />
            </div>
            <ErrorState
              v-else-if="policyState === 'error'"
              class="card"
              :title="t('bookingPolicy.loadError')"
              @retry="loadPolicy"
            />
            <form v-else-if="policy" class="stack" @submit.prevent="savePolicy">
              <Message severity="info" :closable="false">{{
                t('locationDetails.policiesIntro')
              }}</Message>
              <Message v-if="policyError" severity="error" :closable="false" role="alert">{{
                policyError
              }}</Message>
              <BookingPolicyFields
                v-model="overrides"
                :options="policyOptions"
                :inherited="policy.organization"
                :inherited-label="t('locationDetails.organizationLevel')"
                :disabled="!canEdit"
                :errors="policyErrors"
              />
              <UnsavedBar
                v-if="canEdit && policyDirty"
                :saving="policySaving"
                @discard="discardPolicy"
                @save="savePolicy"
              />
            </form>
          </TabPanel>

          <TabPanel value="activity">
            <ActivityTimeline
              v-if="tab === 'activity'"
              entity-type="Location"
              :entity-id="location.id"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <LocationFormDrawer v-model:visible="formOpen" :location="location" @saved="onSaved" />
      <DeactivateLocationDialog
        v-model:visible="deactivateOpen"
        :location="location"
        @deactivated="onDeactivated"
      />
      <ConfirmActionDialog
        v-model:visible="archiveOpen"
        :title="t('archive.archiveTitle', { name: location.name })"
        :description="t('locationsPage.archiveDescription')"
        :confirm-label="t('archive.archive')"
        :loading="archiving"
        :error="archiveError"
        destructive
        @confirm="archive"
      />
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 72px;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.meta-address {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.meta-address i {
  font-size: 12px;
}
.overview {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.figures {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.caption {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.figure {
  font: 600 20px/1.4 var(--font-sans);
}
.facts {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font: var(--text-small);
}
.facts__title {
  font: var(--text-h4);
}
.facts__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.facts__row > span:first-child {
  color: var(--text-secondary);
}
.map {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.about {
  grid-column: 1 / -1;
  padding: 16px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.photo {
  width: 200px;
  max-width: 40%;
  border-radius: 8px;
  object-fit: cover;
}
.pre {
  margin: 0;
  white-space: pre-line;
}
.managed {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-default);
  font: var(--text-small);
  color: var(--text-secondary);
}
.link-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  text-decoration: none;
}
.link-row:last-child {
  border-bottom: 0;
}
.link-row:hover {
  background: var(--surface-hover);
  text-decoration: none;
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.link-row__name {
  flex: 1;
}
.link-row__icon {
  font-size: 11px;
  color: var(--text-muted);
}
.person-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.person-row__text {
  flex: 1;
  min-width: 0;
}
.person-row__name {
  font: 500 14px/1.3 var(--font-sans);
}
.person-row__sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
.note {
  margin: 0;
  padding: 10px 16px;
  font: var(--text-small);
  color: var(--text-muted);
}
@media (max-width: 900px) {
  .overview {
    grid-template-columns: 1fr;
  }
  .figures {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
