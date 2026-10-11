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
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import ArchiveServiceDialog from '@/components/services/ArchiveServiceDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ActivityTimeline from '@/components/patterns/ActivityTimeline.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusBanner from '@/components/patterns/StatusBanner.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import ServiceBookingRules from '@/components/services/ServiceBookingRules.vue'
import ServiceFormDrawer from '@/components/services/ServiceFormDrawer.vue'
import {
  tenantApi,
  type Location,
  type Service,
  type ServiceCategory,
  type ServiceInput,
  type ServiceLocation,
  type ServiceStatus,
} from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { ACTIVITY_ICONS, activityKey, durationParts } from '@/lib/catalog'
import { useStaffAuth } from '@/stores/staffAuth'
import type { MenuItem } from 'primevue/menuitem'

const props = defineProps<{ id: number }>()
const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
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

const readOnly = computed(() => service.value?.status === 'Archived')
const missingName = computed(
  () => !!service.value && (!service.value.name.ar?.trim() || !service.value.name.en?.trim()),
)
// Header "⋯" menu (design: Unpublish / Archive, or Restore when archived).
const moreItems = computed<MenuItem[]>(() => {
  const s = service.value
  if (!s || !canEdit.value) return []
  if (s.status === 'Archived')
    return [{ label: t('archive.restore'), icon: 'pi pi-replay pi-dir', command: restore }]
  return [
    s.status === 'Published'
      ? {
          label: t('details.unpublish'),
          icon: 'pi pi-eye-slash',
          command: () => setStatus('draft'),
        }
      : {
          label: t('catalog.bulk.publish'),
          icon: 'pi pi-send',
          command: () => setStatus('publish'),
        },
    { separator: true },
    {
      label: t('catalog.bulk.archive'),
      icon: 'pi pi-inbox',
      command: () => (archiveOpen.value = true),
    },
  ]
})

// Branches tab: capacity per branch against the largest facility there (design).
const facilities = ref<{ location_id: number; capacity: number }[] | null>(null)
watch(
  tab,
  async (value) => {
    if (value !== 'branches' || facilities.value) return
    facilities.value = await tenantApi.facilities.list().catch(() => [])
  },
  { immediate: true },
)
const largestFacility = (locationId: number) => {
  const caps = (facilities.value ?? [])
    .filter((f) => f.location_id === locationId)
    .map((f) => f.capacity)
  return caps.length ? Math.max(...caps) : null
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
      class="panel"
      icon="pi-search"
      :title="t('details.missing')"
      :body="t('details.missingHint')"
    >
      <RouterLink :to="{ name: 'tenant.services' }">{{ t('catalog.title') }}</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="state === 'error' || !service"
      class="panel"
      :title="t('catalog.loadError')"
      @retry="load"
    />

    <template v-else>
      <PageHeader
        :title="service.display_name ?? ''"
        :breadcrumb="[
          { label: t('catalog.title'), to: { name: 'tenant.services' } },
          { label: service.display_name ?? '' },
        ]"
        :more-items="moreItems"
      >
        <template #leading>
          <span
            class="title-swatch"
            :style="{ background: service.color ?? 'var(--border-strong)' }"
            aria-hidden="true"
          />
        </template>
        <template #status>
          <StatusTag :status="service.status" />
          <span class="type"
            ><i :class="['pi', ACTIVITY_ICONS[service.activity_type]]" aria-hidden="true" />{{
              t(`catalog.types.${activityKey(service.activity_type)}`)
            }}</span
          >
        </template>
        <template #meta>
          <span>{{ service.category?.display_name }}</span>
          <span v-if="service.activity_type !== 'Open Access'" class="num"
            >{{ t('catalog.minShort', { n: service.default_duration }) }}
            <template v-if="service.default_capacity">
              · {{ t('catalog.people', service.default_capacity) }}</template
            ></span
          >
        </template>
        <template v-if="canEdit && !readOnly" #actions>
          <Button
            icon="pi pi-pencil"
            :label="t('common.edit')"
            severity="secondary"
            variant="outlined"
            @click="openEdit"
          />
        </template>
      </PageHeader>

      <StatusBanner
        v-if="service.status === 'Draft'"
        severity="info"
        icon="pi-eye-slash"
        :title="t('details.draftTitle')"
      >
        {{ t('details.draftBanner') }}
        <template v-if="canEdit" #action>
          <Button
            size="small"
            :label="t('catalog.bulk.publish')"
            :loading="busy"
            @click="setStatus('publish')"
          />
        </template>
      </StatusBanner>
      <StatusBanner
        v-else-if="service.status === 'Archived'"
        severity="secondary"
        icon="pi-inbox"
        :title="t('details.archivedTitle')"
      >
        {{ t('details.archivedBanner') }}
        <template v-if="canEdit" #action>
          <Button
            size="small"
            variant="outlined"
            severity="secondary"
            icon="pi pi-replay pi-dir"
            :label="t('archive.restore')"
            :loading="busy"
            @click="restore"
          />
        </template>
      </StatusBanner>
      <StatusBanner
        v-if="missingName"
        severity="warn"
        icon="pi-language"
        :title="t('catalog.nameMissing')"
      >
        {{ t('wizard.nameBoth') }}
        <template v-if="canEdit && !readOnly" #action>
          <Button
            size="small"
            variant="outlined"
            severity="warn"
            :label="t('details.addName')"
            @click="openEdit"
          />
        </template>
      </StatusBanner>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="overview">{{ t('details.tabs.overview') }}</Tab>
          <Tab value="branches"
            >{{ t('details.tabs.branches')
            }}<span class="tab-count">{{ service.locations?.length ?? 0 }}</span></Tab
          >
          <Tab value="staff"
            >{{ t('details.tabs.staff') }}
            <span v-if="service.staff?.length" class="tab-count">{{
              service.staff.length
            }}</span></Tab
          >
          <Tab value="facilities"
            >{{ t('details.tabs.facilities') }}
            <span v-if="service.facilities?.length" class="tab-count">{{
              service.facilities.length
            }}</span></Tab
          >
          <Tab value="rules">{{ t('details.tabs.rules') }}</Tab>
          <Tab v-tooltip.top="t('details.pricingSoon')" value="pricing" disabled>{{
            t('details.tabs.pricing')
          }}</Tab>
          <Tab value="sessions">{{ t('details.tabs.sessions') }}</Tab>
          <Tab v-if="auth.can('audit.view')" value="activity">{{ t('details.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="overview">
            <div class="overview">
              <div class="panel overview__main">
                <div class="names">
                  <div>
                    <div class="caption">العربية</div>
                    <div class="names__value" dir="rtl">{{ service.name.ar || '—' }}</div>
                  </div>
                  <div>
                    <div class="caption">English</div>
                    <div
                      :class="['names__value', { 'names__value--missing': !service.name.en }]"
                      dir="ltr"
                    >
                      {{ service.name.en || t('details.missingName') }}
                    </div>
                  </div>
                </div>
                <dl class="facts">
                  <dt>{{ t('catalog.skillLevel') }}</dt>
                  <dd>{{ audience }}</dd>
                  <template v-if="service.activity_type !== 'Open Access'">
                    <dt>{{ t('details.buffers') }}</dt>
                    <dd>
                      {{
                        t('details.bufferValues', {
                          before: minutes(service.buffer_before),
                          after: minutes(service.buffer_after),
                        })
                      }}
                    </dd>
                  </template>
                  <dt>{{ t('wizard.acceptedWith') }}</dt>
                  <dd>{{ payments }}</dd>
                  <template v-if="service.equipment_notes">
                    <dt>{{ t('catalog.equipment') }}</dt>
                    <dd class="pre">{{ service.equipment_notes }}</dd>
                  </template>
                  <dt>{{ t('catalog.description') }}</dt>
                  <dd class="pre">{{ service.display_description || '—' }}</dd>
                </dl>
              </div>
              <div class="overview__side">
                <img
                  v-if="service.photo_url"
                  :src="service.photo_url"
                  :alt="t('catalog.photoAlt')"
                  class="photo"
                />
                <div class="panel stat">
                  <div class="caption">{{ t('details.tabs.sessions') }}</div>
                  <div class="stat__value num">—</div>
                  <div class="stat__hint">{{ t('details.noSessionsHint') }}</div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="branches">
            <EmptyState
              v-if="!service.locations?.length"
              class="panel"
              icon="pi-building"
              :title="t('details.noBranches')"
            />
            <DataTable v-else :value="service.locations" data-key="location_id">
              <Column :header="t('catalog.columns.branches')">
                <template #body="{ data }">
                  <RouterLink
                    :to="{
                      name: 'tenant.locations.show',
                      params: { id: data.location_id },
                      query: { tab: 'services' },
                    }"
                    >{{ data.name }}</RouterLink
                  >
                </template>
              </Column>
              <Column :header="t('catalog.columns.capacity')" header-class="end" body-class="end">
                <template #body="{ data }">
                  <span class="num">{{
                    data.capacity_override ?? service.default_capacity ?? '—'
                  }}</span>
                </template>
              </Column>
              <Column :header="t('details.limit')" header-class="end" body-class="end">
                <template #body="{ data }">
                  <span class="num muted">{{ largestFacility(data.location_id) ?? '—' }}</span>
                </template>
              </Column>
              <Column>
                <template #body="{ data }">
                  <Tag
                    v-if="data.capacity_override !== null"
                    class="tag-sm"
                    severity="help"
                    icon="pi pi-th-large"
                    :value="t('details.thisService')"
                  />
                  <Tag v-else class="tag-sm" :value="t('details.default')" />
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="staff">
            <EmptyState
              v-if="!service.staff?.length"
              class="panel"
              compact
              icon="pi-users"
              :title="t('details.anyStaff')"
              :body="t('details.anyStaffHint')"
            />
            <ul v-else class="panel rows">
              <li v-for="u in service.staff" :key="u.id">
                <PersonAvatar :name="u.name" />
                <span class="rows__name">{{ u.name }}</span>
              </li>
            </ul>
          </TabPanel>

          <TabPanel value="facilities">
            <EmptyState
              v-if="!service.facilities?.length"
              class="panel"
              compact
              icon="pi-th-large"
              :title="t('details.noFacilities')"
              :body="t('details.noFacilitiesHint')"
            />
            <ul v-else class="panel rows">
              <li v-for="f in service.facilities" :key="f.id">
                <span class="tile" aria-hidden="true"><i class="pi pi-th-large" /></span>
                <RouterLink
                  :to="{ name: 'tenant.facilities.availability', params: { id: f.id } }"
                  class="rows__name"
                  >{{ f.name }}</RouterLink
                >
                <span class="muted">{{
                  service.locations?.find((l) => l.location_id === f.location_id)?.name
                }}</span>
              </li>
            </ul>
          </TabPanel>

          <TabPanel value="rules">
            <ServiceBookingRules
              v-if="tab === 'rules'"
              :service="service"
              :can-edit="canEdit && !readOnly"
            />
          </TabPanel>

          <TabPanel value="sessions">
            <EmptyState
              class="panel"
              icon="pi-calendar"
              :title="t('details.noSessions')"
              :body="t('details.noSessionsHint')"
            />
          </TabPanel>

          <TabPanel value="activity">
            <ActivityTimeline
              v-if="tab === 'activity'"
              entity-type="Service"
              :entity-id="service.id"
            />
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
  gap: 16px;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.title-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex: none;
}
.type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font: var(--text-small);
}
.overview {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.overview__main {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.overview__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.names {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.caption {
  font: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}
.names__value {
  font: var(--text-h3);
}
.names__value--missing {
  color: var(--sev-warn-fg);
}
.facts {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 10px 24px;
  margin: 0;
}
.facts dt {
  color: var(--text-secondary);
}
.facts dd {
  margin: 0;
}
.pre {
  white-space: pre-line;
}
.photo {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-default);
}
.stat {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stat__value {
  font: var(--text-display);
}
.stat__hint {
  font: var(--text-small);
  color: var(--text-secondary);
}
.muted {
  color: var(--text-muted);
}
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}
.rows li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.rows li:last-child {
  border-bottom: 0;
}
.rows__name {
  flex: 1;
  font: 500 14px var(--font-sans);
}
.tile {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--primary-subtle);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (max-width: 900px) {
  .overview {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .names,
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
