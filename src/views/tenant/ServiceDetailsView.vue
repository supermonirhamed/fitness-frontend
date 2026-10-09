<script setup lang="ts">
// Service details (US-02.11): header with status and actions, then tabs Overview, Branches,
// Staff, Facilities, Booking rules, Pricing (MVP-2), Upcoming sessions (EP-03) and Activity.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ArchiveServiceDialog from '@/components/services/ArchiveServiceDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import ServiceBookingRules from '@/components/services/ServiceBookingRules.vue'
import ServiceFormDrawer from '@/components/services/ServiceFormDrawer.vue'
import {
  tenantApi,
  type AuditEntry,
  type Location,
  type Service,
  type ServiceCategory,
  type ServiceInput,
  type ServiceLocation,
  type ServiceStatus,
} from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { actionKey, fieldChanges } from '@/lib/audit'
import { ACTIVITY_ICONS, activityKey, durationParts } from '@/lib/catalog'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const route = useRoute()
const { t, te, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('services.update'))

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const service = ref<Service | null>(null)
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'overview')

async function load() {
  state.value = 'loading'
  try {
    service.value = await tenantApi.services.get(props.id)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
watch(() => props.id, load)

const severity = (s: ServiceStatus) =>
  s === 'Published' ? 'success' : s === 'Draft' ? 'info' : 'secondary'
const minutes = (n: number) => {
  const { h, m } = durationParts(n)
  return (
    [h ? t('catalog.hours', { n: h }) : null, m ? t('catalog.mins', { n: m }) : null]
      .filter(Boolean)
      .join(' ') || t('catalog.mins', { n: 0 })
  )
}
const payments = computed(() => {
  const s = service.value
  if (!s) return ''
  if (s.is_free) return t('catalog.pay.is_free')
  return [
    s.allow_membership ? t('catalog.pay.allow_membership') : null,
    s.allow_package
      ? `${t('catalog.pay.allow_package')} (${t('details.credits', s.credit_cost)})`
      : null,
    s.allow_drop_in ? t('catalog.pay.allow_drop_in') : null,
  ]
    .filter(Boolean)
    .join(locale.value === 'ar' ? '، ' : ', ')
})
const audience = computed(() => {
  const s = service.value
  if (!s) return ''
  const ages =
    s.age_min !== null || s.age_max !== null
      ? t('details.ages', { from: s.age_min ?? 0, to: s.age_max ?? '∞' })
      : null
  return [t(`catalog.skill.${s.skill_level}`), t(`catalog.gender.${s.gender}`), ages]
    .filter(Boolean)
    .join(' · ')
})

// Edit
const categories = ref<ServiceCategory[]>([])
const locations = ref<Location[]>([])
const drawerOpen = ref(false)
async function openEdit() {
  if (!categories.value.length)
    categories.value = await tenantApi.serviceCategories.list().catch(() => [])
  if (!locations.value.length) locations.value = await tenantApi.locations().catch(() => [])
  drawerOpen.value = true
}
function onSaved(saved: Service) {
  service.value = saved
  toast.add({
    severity: 'success',
    summary: t('catalog.serviceSaved', { name: saved.display_name }),
    life: 3000,
  })
}

// Publish / unpublish / archive (bulk endpoint, one service)
const archiveOpen = ref(false)
const busy = ref(false)
async function restore() {
  if (!service.value) return
  busy.value = true
  try {
    service.value = await tenantApi.services.restore(service.value.id)
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 5000 })
  } finally {
    busy.value = false
  }
}
async function setStatus(action: 'publish' | 'draft') {
  if (!service.value) return
  busy.value = true
  try {
    if (action === 'draft') {
      service.value = await tenantApi.services.update(
        service.value.id,
        toInput(service.value, 'Draft'),
      )
    } else {
      const [changed] = await tenantApi.services.bulk([service.value.id], action)
      if (changed) service.value = changed
    }
    archiveOpen.value = false
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 5000 })
  } finally {
    busy.value = false
  }
}
/** The service as an edit payload with a new status (staff, facilities and branches unchanged). */
function toInput(s: Service, status: ServiceStatus): ServiceInput {
  return {
    name: s.name,
    description: s.description,
    activity_type: s.activity_type,
    category_id: s.category_id,
    default_duration: s.default_duration,
    default_capacity: s.default_capacity,
    buffer_before: s.buffer_before,
    buffer_after: s.buffer_after,
    allow_membership: s.allow_membership,
    allow_package: s.allow_package,
    allow_drop_in: s.allow_drop_in,
    is_free: s.is_free,
    credit_cost: s.credit_cost,
    status,
    color: s.own_color,
    skill_level: s.skill_level,
    age_min: s.age_min,
    age_max: s.age_max,
    gender: s.gender,
    equipment_notes: s.equipment_notes,
    locations: (s.locations ?? []).map((l) => ({
      location_id: l.location_id,
      ...(s.activity_type === 'Open Access' ? {} : { capacity_override: l.capacity_override }),
      price_override: l.price_override,
    })) as ServiceLocation[],
  }
}

// Activity (needs audit.view)
const activity = ref<AuditEntry[] | null>(null)
const activityState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
async function loadActivity() {
  activityState.value = 'loading'
  try {
    activity.value = (
      await tenantApi.auditLogs({ entity_type: 'Service', entity_id: props.id }, 1)
    ).data
    activityState.value = 'ready'
  } catch {
    activityState.value = 'error'
  }
}
watch(tab, (value) => value === 'activity' && activityState.value === 'idle' && loadActivity(), {
  immediate: true,
})
const actionLabel = (action: string) =>
  te(`audit.actions.${actionKey(action)}`) ? t(`audit.actions.${actionKey(action)}`) : action
// Edits list what changed; a creation just says so.
const changedFields = (entry: AuditEntry) =>
  entry.old_values === null
    ? ''
    : fieldChanges(entry.old_values, entry.new_values)
        .map((c) => c.field)
        .filter((f) => f !== 'bulk')
        .join(', ')
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'tenant.services' }" class="back">
      <i class="pi pi-arrow-left pi-dir" aria-hidden="true" />{{ t('catalog.title') }}
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
    <EmptyState
      v-else-if="state === 'missing'"
      icon="pi-lock"
      :title="t('details.missing')"
      :body="t('details.missingHint')"
    />
    <EmptyState
      v-else-if="state === 'error' || !service"
      icon="pi-exclamation-triangle"
      :title="t('catalog.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>

    <template v-else>
      <PageHeader :title="service.display_name ?? ''">
        <template #status>
          <span
            class="dot"
            :style="{ background: service.color ?? 'var(--border-default)' }"
            aria-hidden="true"
          />
          <span class="type"
            ><i :class="['pi', ACTIVITY_ICONS[service.activity_type]]" aria-hidden="true" />{{
              t(`catalog.types.${activityKey(service.activity_type)}`)
            }}</span
          >
          <Tag
            :severity="severity(service.status)"
            :value="t(`catalog.status.${service.status}`)"
          />
        </template>
        <template v-if="canEdit" #actions>
          <Button
            v-if="service.status === 'Draft'"
            icon="pi pi-check"
            :label="t('catalog.bulk.publish')"
            severity="secondary"
            variant="outlined"
            :loading="busy"
            @click="setStatus('publish')"
          />
          <Button
            v-else-if="service.status === 'Published'"
            icon="pi pi-eye-slash"
            :label="t('details.unpublish')"
            severity="secondary"
            variant="outlined"
            :loading="busy"
            @click="setStatus('draft')"
          />
          <Button
            v-if="service.status === 'Archived'"
            icon="pi pi-replay pi-dir"
            :label="t('archive.restore')"
            severity="secondary"
            variant="outlined"
            :loading="busy"
            @click="restore"
          />
          <Button
            v-else
            icon="pi pi-box"
            :label="t('catalog.bulk.archive')"
            severity="secondary"
            variant="outlined"
            @click="archiveOpen = true"
          />
          <Button icon="pi pi-pencil" :label="t('locationForm.edit')" @click="openEdit" />
        </template>
      </PageHeader>

      <Message v-if="service.status === 'Draft'" severity="info" :closable="false">{{
        t('details.draftBanner')
      }}</Message>
      <Message v-else-if="service.status === 'Archived'" severity="warn" :closable="false">{{
        t('details.archivedBanner')
      }}</Message>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="overview">{{ t('details.tabs.overview') }}</Tab>
          <Tab value="branches">{{ t('details.tabs.branches') }}</Tab>
          <Tab value="staff">{{ t('details.tabs.staff') }}</Tab>
          <Tab value="facilities">{{ t('details.tabs.facilities') }}</Tab>
          <Tab value="rules">{{ t('details.tabs.rules') }}</Tab>
          <Tab value="pricing" disabled v-tooltip.top="t('details.pricingSoon')">{{
            t('details.tabs.pricing')
          }}</Tab>
          <Tab value="sessions">{{ t('details.tabs.sessions') }}</Tab>
          <Tab v-if="auth.can('audit.view')" value="activity">{{ t('details.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="overview">
            <div class="overview">
              <img
                v-if="service.photo_url"
                :src="service.photo_url"
                :alt="t('catalog.photoAlt')"
                class="photo"
              />
              <dl>
                <dt>{{ t('catalog.category') }}</dt>
                <dd>
                  <i :class="['pi', service.category?.icon]" aria-hidden="true" />
                  {{ service.category?.display_name }}
                </dd>
                <dt>{{ t('catalog.duration') }}</dt>
                <dd>{{ minutes(service.default_duration) }}</dd>
                <template v-if="service.default_capacity">
                  <dt>{{ t('catalog.capacity') }}</dt>
                  <dd>{{ t('catalog.people', service.default_capacity) }}</dd>
                </template>
                <dt>{{ t('details.buffers') }}</dt>
                <dd>
                  {{
                    t('details.bufferValues', {
                      before: minutes(service.buffer_before),
                      after: minutes(service.buffer_after),
                    })
                  }}
                </dd>
                <dt>{{ t('catalog.payment') }}</dt>
                <dd>{{ payments }}</dd>
                <dt>{{ t('details.audience') }}</dt>
                <dd>{{ audience }}</dd>
                <template v-if="service.equipment_notes">
                  <dt>{{ t('catalog.equipment') }}</dt>
                  <dd class="pre">{{ service.equipment_notes }}</dd>
                </template>
                <dt>{{ t('catalog.description') }}</dt>
                <dd class="pre">{{ service.display_description || '—' }}</dd>
              </dl>
            </div>
          </TabPanel>

          <TabPanel value="branches">
            <EmptyState
              v-if="!service.locations?.length"
              icon="pi-building"
              :title="t('details.noBranches')"
            />
            <ul v-else class="list">
              <li v-for="l in service.locations" :key="l.location_id">
                <RouterLink
                  :to="{
                    name: 'tenant.locations.show',
                    params: { id: l.location_id },
                    query: { tab: 'services' },
                  }"
                  class="name"
                  >{{ l.name }}</RouterLink
                >
                <span class="sub">
                  {{
                    l.capacity_override
                      ? t('details.capacityAt', { n: l.capacity_override })
                      : t('details.defaultCapacity')
                  }}
                  <template v-if="l.price_override !== null">
                    · {{ format.money(Number(l.price_override)) }}</template
                  >
                </span>
              </li>
            </ul>
          </TabPanel>

          <TabPanel value="staff">
            <EmptyState
              v-if="!service.staff?.length"
              icon="pi-users"
              :title="t('details.anyStaff')"
              :body="t('details.anyStaffHint')"
            />
            <ul v-else class="list">
              <li v-for="u in service.staff" :key="u.id">
                <span class="name">{{ u.name }}</span>
              </li>
            </ul>
          </TabPanel>

          <TabPanel value="facilities">
            <EmptyState
              v-if="!service.facilities?.length"
              icon="pi-th-large"
              :title="t('details.noFacilities')"
              :body="t('details.noFacilitiesHint')"
            />
            <ul v-else class="list">
              <li v-for="f in service.facilities" :key="f.id">
                <RouterLink
                  :to="{ name: 'tenant.facilities.availability', params: { id: f.id } }"
                  class="name"
                  >{{ f.name }}</RouterLink
                >
                <span class="sub">{{
                  service.locations?.find((l) => l.location_id === f.location_id)?.name
                }}</span>
              </li>
            </ul>
          </TabPanel>

          <TabPanel value="rules">
            <ServiceBookingRules v-if="tab === 'rules'" :service="service" :can-edit="canEdit" />
          </TabPanel>

          <TabPanel value="sessions">
            <EmptyState
              icon="pi-calendar"
              :title="t('details.noSessions')"
              :body="t('details.noSessionsHint')"
            />
          </TabPanel>

          <TabPanel value="activity">
            <div v-if="activityState === 'loading'" class="skeleton">
              <Skeleton v-for="n in 3" :key="n" height="40px" />
            </div>
            <EmptyState
              v-else-if="activityState === 'error'"
              icon="pi-exclamation-triangle"
              :title="t('common.genericError')"
            >
              <Button
                severity="secondary"
                variant="outlined"
                :label="t('common.retry')"
                @click="loadActivity"
              />
            </EmptyState>
            <EmptyState
              v-else-if="!activity?.length"
              icon="pi-history"
              :title="t('details.noActivity')"
            />
            <ol v-else class="timeline">
              <li v-for="entry in activity" :key="entry.id">
                <span class="when">{{ format.dateTime(entry.created_at) }}</span>
                <span class="what">
                  <strong>{{ entry.actor?.name ?? t('details.system') }}</strong> ·
                  {{ actionLabel(entry.action) }}
                  <small v-if="changedFields(entry)" class="sub">{{ changedFields(entry) }}</small>
                </span>
              </li>
            </ol>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ServiceFormDrawer
        v-model:visible="drawerOpen"
        :service="service"
        :categories="categories"
        :locations="locations"
        @saved="onSaved"
      />
      <ArchiveServiceDialog
        v-model:visible="archiveOpen"
        :service="service"
        @archived="(s) => (service = s)"
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
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.type {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  color: var(--text-secondary);
}
.overview {
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
  min-width: 260px;
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
  min-width: 0;
  overflow-wrap: anywhere;
}
.pre {
  white-space: pre-line;
}
.list,
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.list li,
.timeline li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.list li + li,
.timeline li + li {
  border-top: 1px solid var(--border-subtle);
}
.timeline li {
  justify-content: flex-start;
}
.when {
  min-width: 160px;
  font: var(--text-caption);
  color: var(--text-muted);
}
.what {
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: var(--fw-medium);
}
.sub {
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 560px) {
  dl {
    grid-template-columns: 1fr;
  }
  .timeline li {
    flex-direction: column;
  }
}
</style>
