<script setup lang="ts">
// Branch details (US-01.04): header with status and timezone, then tabs. Business hours:
// US-01.06 and holidays US-01.07; facilities and services arrive with US-01.08 and EP-02.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import EmptyState from '@/components/patterns/EmptyState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import BusinessHoursEditor from '@/components/locations/BusinessHoursEditor.vue'
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
} from '@/api/tenant'
import { statusOf, validationErrors } from '@/lib/http'
import { toOverrides } from '@/lib/bookingPolicy'
import { zoneAbbreviation } from '@/lib/datetime'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const { t, te, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const location = ref<LocationDetails>()
const tab = ref('info')
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
    { key: 'today_sessions', icon: 'pi-calendar', value: s.today_sessions },
    { key: 'staff', icon: 'pi-users', value: s.staff },
    { key: 'facilities', icon: 'pi-th-large', value: s.facilities },
    { key: 'active_services', icon: 'pi-tags', value: s.active_services },
  ]
})

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

watch(tab, (value) => {
  if (value === 'staff' && staffState.value === 'idle') loadStaff()
  if (value === 'policies' && policyState.value === 'idle') loadPolicy()
})

const comingSoon = ['facilities', 'services'] as const
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'tenant.settings.locations' }" class="back">
      <i class="pi pi-arrow-left pi-dir" aria-hidden="true" />{{ t('locationDetails.back') }}
    </RouterLink>

    <div
      v-if="state === 'loading'"
      class="skeleton"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <Skeleton height="48px" width="40%" />
      <Skeleton height="200px" />
    </div>

    <section v-else-if="state === 'missing'" class="card">
      <EmptyState
        icon="pi-lock"
        :title="t('locationDetails.missing')"
        :body="t('locationDetails.missingHint')"
      />
    </section>

    <section v-else-if="state === 'error' || !location" class="card">
      <EmptyState icon="pi-exclamation-triangle" :title="t('locationDetails.loadError')">
        <Button
          severity="secondary"
          variant="outlined"
          icon="pi pi-replay pi-dir"
          :label="t('common.retry')"
          @click="load"
        />
      </EmptyState>
    </section>

    <template v-else>
      <PageHeader :title="location.name">
        <template #status>
          <StatusTag :status="location.status" />
          <span class="zone" dir="ltr"
            ><i class="pi pi-clock" aria-hidden="true" />{{ location.timezone }} ·
            {{ zoneAbbreviation(location.timezone, locale) }}</span
          >
        </template>
        <template #actions>
          <Button
            v-if="canChangeStatus && location.status === 'Inactive'"
            severity="secondary"
            variant="outlined"
            icon="pi pi-play"
            :label="t('deactivateLocation.activate')"
            :loading="activating"
            @click="activate"
          />
          <Button
            v-else-if="canChangeStatus"
            severity="danger"
            variant="outlined"
            icon="pi pi-power-off"
            :label="t('deactivateLocation.action')"
            @click="deactivateOpen = true"
          />
          <Button
            v-if="canEdit"
            icon="pi pi-pencil"
            :label="t('locationForm.edit')"
            @click="formOpen = true"
          />
        </template>
      </PageHeader>

      <Message v-if="location.status === 'Draft'" severity="info" :closable="false">{{
        t('locationDetails.draftBanner')
      }}</Message>
      <Message v-else-if="location.status === 'Inactive'" severity="warn" :closable="false">{{
        t('locationDetails.inactiveBanner')
      }}</Message>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="info">{{ t('locationDetails.tabs.info') }}</Tab>
          <Tab value="hours">{{ t('locationDetails.tabs.hours') }}</Tab>
          <Tab value="facilities">{{ t('locationDetails.tabs.facilities') }}</Tab>
          <Tab value="services">{{ t('locationDetails.tabs.services') }}</Tab>
          <Tab v-if="auth.can('staff.view')" value="staff">{{
            t('locationDetails.tabs.staff')
          }}</Tab>
          <Tab value="policies">{{ t('locationDetails.tabs.policies') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="info">
            <div class="info">
              <ul class="figures">
                <li v-for="f in figures" :key="f.key" class="figure">
                  <i :class="['pi', f.icon]" aria-hidden="true" />
                  <span class="value num">{{ f.value ?? '—' }}</span>
                  <span class="label">{{ t(`locationDetails.figures.${f.key}`) }}</span>
                </li>
              </ul>

              <div class="details">
                <img
                  v-if="location.photo_url"
                  :src="location.photo_url"
                  :alt="t('locationForm.photoAlt')"
                  class="photo"
                />
                <dl>
                  <dt>{{ t('locationForm.fields.address') }}</dt>
                  <dd>
                    {{ location.address || '—' }}
                    <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener" class="map"
                      ><i class="pi pi-map-marker" aria-hidden="true" />{{
                        t('locationDetails.openMap')
                      }}</a
                    >
                  </dd>
                  <dt>{{ t('locationForm.fields.phone') }}</dt>
                  <dd dir="ltr" class="ltr-isolate">{{ location.phone || '—' }}</dd>
                  <dt>{{ t('locationForm.fields.email') }}</dt>
                  <dd dir="ltr" class="ltr-isolate">{{ location.email || '—' }}</dd>
                  <dt>{{ t('locationForm.fields.description') }}</dt>
                  <dd class="pre">{{ location.description || '—' }}</dd>
                </dl>
              </div>
              <p class="note">{{ t('locationDetails.figuresNote') }}</p>
            </div>
          </TabPanel>

          <TabPanel value="hours">
            <div v-if="tab === 'hours'" class="hours">
              <BusinessHoursEditor :location-id="location.id" :can-edit="canEdit" />
              <HourOverridesSection
                :location-id="location.id"
                :timezone="location.timezone"
                :can-edit="canEdit"
              />
            </div>
          </TabPanel>

          <TabPanel v-for="key in comingSoon" :key="key" :value="key">
            <EmptyState
              :icon="key === 'facilities' ? 'pi-th-large' : 'pi-tags'"
              :title="t(`locationDetails.soon.${key}.title`)"
              :body="t(`locationDetails.soon.${key}.body`)"
            />
          </TabPanel>

          <TabPanel value="staff">
            <div v-if="staffState === 'loading'" class="skeleton">
              <Skeleton v-for="n in 3" :key="n" height="40px" />
            </div>
            <EmptyState
              v-else-if="staffState === 'forbidden'"
              icon="pi-lock"
              :title="t('permissions.forbidden')"
            />
            <EmptyState
              v-else-if="staffState === 'error'"
              icon="pi-exclamation-triangle"
              :title="t('common.genericError')"
            >
              <Button
                severity="secondary"
                variant="outlined"
                :label="t('common.retry')"
                @click="loadStaff"
              />
            </EmptyState>
            <template v-else-if="staff">
              <EmptyState
                v-if="!staff.data.length"
                icon="pi-users"
                :title="t('locationDetails.noStaff')"
                :body="t('locationDetails.noStaffHint')"
              />
              <DataTable v-else :value="staff.data" data-key="id" size="small">
                <Column :header="t('locationForm.fields.name')">
                  <template #body="{ data }">
                    <div class="name">{{ data.name }}</div>
                    <div class="sub ltr-isolate" dir="ltr">{{ data.email }}</div>
                  </template>
                </Column>
                <Column :header="t('locationDetails.role')">
                  <template #body="{ data }">{{
                    data.roles.map(roleName).join(locale === 'ar' ? '، ' : ', ')
                  }}</template>
                </Column>
                <Column :header="t('locationForm.fields.status')">
                  <template #body="{ data }"><StatusTag :status="data.status" /></template>
                </Column>
              </DataTable>
              <p class="note">
                {{ t('locationDetails.allLocations', staff.all_locations_count) }}
                <RouterLink
                  v-if="auth.can('staff.update')"
                  :to="{ name: 'tenant.settings.users' }"
                  >{{ t('locationDetails.manageAccess') }}</RouterLink
                >
              </p>
            </template>
          </TabPanel>

          <TabPanel value="policies">
            <div v-if="policyState === 'loading'" class="skeleton">
              <Skeleton v-for="n in 2" :key="n" height="120px" />
            </div>
            <EmptyState
              v-else-if="policyState === 'error'"
              icon="pi-exclamation-triangle"
              :title="t('bookingPolicy.loadError')"
            >
              <Button
                severity="secondary"
                variant="outlined"
                :label="t('common.retry')"
                @click="loadPolicy"
              />
            </EmptyState>
            <form v-else-if="policy" class="policies" @submit.prevent="savePolicy">
              <p class="note">{{ t('locationDetails.policiesIntro') }}</p>
              <BookingPolicyFields
                v-model="overrides"
                :options="policyOptions"
                :inherited="policy.organization"
                :inherited-label="t('locationDetails.organizationLevel')"
                :disabled="!canEdit"
                :errors="policyErrors"
              />
              <Message v-if="policyError" severity="error" :closable="false" role="alert">{{
                policyError
              }}</Message>
              <div v-if="canEdit" class="footer">
                <span class="audit"
                  ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
                >
                <Button
                  type="submit"
                  :label="t('permissions.save')"
                  :disabled="!policyDirty"
                  :loading="policySaving"
                />
              </div>
            </form>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <LocationFormDrawer v-model:visible="formOpen" :location="location" @saved="onSaved" />
      <DeactivateLocationDialog
        v-model:visible="deactivateOpen"
        :location="location"
        @deactivated="onDeactivated"
      />
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
  text-decoration: none;
  width: fit-content;
}
.back:hover {
  color: var(--text-primary);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.zone {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-caption);
  color: var(--text-muted);
}
.info {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.figure {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: var(--space-3);
  align-items: center;
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}
.figure .pi {
  grid-row: span 2;
  font-size: 1.25rem;
  color: var(--primary);
}
.figure .value {
  font: var(--text-h3);
}
.figure .label {
  font: var(--text-caption);
  color: var(--text-muted);
}
.details {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
  align-items: flex-start;
}
.photo {
  width: 240px;
  max-width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-subtle);
}
dl {
  flex: 1;
  min-width: 240px;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-5);
  margin: 0;
}
dt {
  font: var(--text-small);
  color: var(--text-muted);
}
dd {
  margin: 0;
  font: var(--text-body);
  min-width: 0;
  overflow-wrap: anywhere;
}
.pre {
  white-space: pre-line;
}
.map {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-inline-start: var(--space-2);
  font: var(--text-small);
  color: var(--text-link);
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.name {
  font-weight: var(--fw-medium);
}
.sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
.hours {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.policies {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 560px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
