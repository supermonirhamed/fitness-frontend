<script setup lang="ts">
// Plan or package details (US-06.07): header with status, what it gives and its counts, then tabs
// Pricing (per branch with VAT), Entitlement rules, Locations, Active holders and Activity log.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import ActivityTimeline from '@/components/patterns/ActivityTimeline.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type MembershipPlanDetails, type PlanHolder } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePlanSummary } from '@/composables/usePlanSummary'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const summary = usePlanSummary()
const canManage = computed(() => auth.can('memberships.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden' | 'missing'>('loading')
const plan = ref<MembershipPlanDetails | null>(null)
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'pricing')

async function load() {
  state.value = 'loading'
  try {
    plan.value = await tenantApi.membershipPlans.get(props.id)
    state.value = 'ready'
  } catch (e) {
    const status = statusOf(e)
    state.value = status === 403 ? 'forbidden' : status === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
watch(() => props.id, load)

const edit = () => router.push({ name: 'tenant.memberships.edit', params: { id: props.id } })
const list = (names: string[]) => names.join(locale.value === 'ar' ? '، ' : ', ')
const description = computed(() => {
  const d = plan.value?.description
  return locale.value === 'ar' ? d?.ar || d?.en : d?.en || d?.ar
})

const coverage = computed(() => {
  const p = plan.value
  if (!p) return []
  const s = p.rules.services
  const n = p.rule_names
  const rows: { label: string; value: string }[] = []
  if (p.drop_in_service_id) {
    rows.push({ label: t('plans.covers'), value: p.drop_in_service ?? '–' })
    return rows
  }
  rows.push({
    label: t('plans.covers'),
    value:
      s.mode === 'categories'
        ? list(n.categories)
        : s.mode === 'services'
          ? list(n.services)
          : s.mode === 'programs'
            ? list(n.programs)
            : t('plans.coverModes.all'),
  })
  if (n.excluded.length) rows.push({ label: t('plans.exclude'), value: list(n.excluded) })
  return rows
})
const limits = computed(() => {
  const p = plan.value
  if (!p) return []
  const l = p.rules.limits
  return [
    l.per_day ? { label: t('plans.perDay'), value: String(l.per_day) } : null,
    l.per_week ? { label: t('plans.perWeek'), value: String(l.per_week) } : null,
    l.hours ? { label: t('plans.offPeakShort'), value: t('plans.hoursSummary', l.hours) } : null,
  ].filter((x): x is { label: string; value: string } => x !== null)
})
const activation = computed(() => {
  const p = plan.value
  if (!p) return ''
  return p.activation === 'first_use'
    ? t('plans.activationSummary.first_use', { n: p.activation_max_wait_days ?? 30 })
    : t(`plans.activationSummary.${p.activation}`)
})
const locationMode = computed(() => {
  const l = plan.value?.rules.locations
  if (!l) return ''
  if (l.mode === 'all')
    return l.include_future ? t('plans.locationModes.all') : t('plans.allCurrentBranches')
  return t(`plans.locationModes.${l.mode}`)
})

// Active holders, loaded when the tab opens.
const holders = ref<PlanHolder[] | null>(null)
const holdersTotal = ref(0)
const holdersPage = ref(1)
const holdersState = ref<'loading' | 'ready' | 'error'>('loading')
async function loadHolders(page = 1) {
  holdersState.value = 'loading'
  try {
    const res = await tenantApi.membershipPlans.holders(props.id, page)
    holders.value = res.data
    holdersTotal.value = res.meta.total
    holdersPage.value = res.meta.current_page
    holdersState.value = 'ready'
  } catch {
    holdersState.value = 'error'
  }
}
watch(
  tab,
  (value) => {
    if (value === 'holders' && holders.value === null && auth.can('clients.view')) loadHolders()
  },
  { immediate: true },
)
const credits = (h: PlanHolder) =>
  h.credits_total === null
    ? '–'
    : t('clientMemberships.creditsLeft', { n: h.credits_left, total: h.credits_total })
</script>

<template>
  <div class="page">
    <div v-if="state === 'loading'" class="skeleton" aria-busy="true">
      <Skeleton height="20px" width="20%" />
      <Skeleton height="32px" width="40%" />
      <Skeleton height="200px" />
    </div>
    <NoPermission v-else-if="state === 'forbidden'" class="panel" />
    <EmptyState
      v-else-if="state === 'missing'"
      class="panel"
      icon="pi-search"
      :title="t('plans.notFound')"
    >
      <RouterLink :to="{ name: 'tenant.memberships' }">{{ t('plans.backToPlans') }}</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="state === 'error' || !plan"
      class="panel"
      :title="t('plans.loadError')"
      @retry="load"
    />

    <template v-else>
      <PageHeader
        :title="plan.display_name"
        :breadcrumb="[
          { label: t('plans.title'), to: { name: 'tenant.memberships' } },
          { label: plan.display_name },
        ]"
      >
        <template #status>
          <StatusTag :status="plan.status" />
          <span :class="['type', `type--${summary.badge(plan).cls}`]">
            <i :class="['pi', summary.badge(plan).icon]" aria-hidden="true" />
            {{ summary.badge(plan).label }}
          </span>
          <span v-if="plan.intro_offer" class="type type--intro">
            <i class="pi pi-gift" aria-hidden="true" />{{ summary.intro(plan) }}
          </span>
        </template>
        <template #meta>
          <span>{{ summary.access(plan) }}</span>
          <span>{{ summary.billing(plan) }}</span>
        </template>
        <template v-if="canManage" #actions>
          <Button
            icon="pi pi-pencil"
            :label="t('common.edit')"
            severity="secondary"
            variant="outlined"
            @click="edit"
          />
        </template>
      </PageHeader>

      <div class="stats">
        <div class="panel stat">
          <span class="stat__icon"><i class="pi pi-users" aria-hidden="true" /></span>
          <div>
            <div class="stat__value num">{{ plan.active_holders ?? 0 }}</div>
            <div class="stat__label">{{ t('plans.activeHolders') }}</div>
          </div>
        </div>
        <div class="panel stat">
          <span class="stat__icon"><i class="pi pi-shopping-cart" aria-hidden="true" /></span>
          <div>
            <div class="stat__value num">{{ plan.sales_this_month ?? 0 }}</div>
            <div class="stat__label">{{ t('plans.salesThisMonth') }}</div>
          </div>
        </div>
        <div class="panel stat">
          <span class="stat__icon"><i class="pi pi-wallet" aria-hidden="true" /></span>
          <div>
            <div class="stat__value num">
              {{ summary.priceRange(plan) ?? t('plans.noPriceYet') }}
            </div>
            <div class="stat__label">
              {{
                plan.billing === 'recurring'
                  ? t(`plans.intervals.${plan.billing_interval}`)
                  : t('plans.price')
              }}
            </div>
          </div>
        </div>
      </div>

      <p v-if="description" class="panel desc">{{ description }}</p>

      <Tabs v-model:value="tab" scrollable>
        <TabList>
          <Tab value="pricing">{{ t('plans.tabs.pricing') }}</Tab>
          <Tab value="rules">{{ t('plans.tabs.rules') }}</Tab>
          <Tab value="locations">{{ t('plans.tabs.locations') }}</Tab>
          <Tab v-if="auth.can('clients.view')" value="holders"
            >{{ t('plans.tabs.holders') }}
            <span class="tab-count">{{ plan.active_holders ?? 0 }}</span></Tab
          >
          <Tab v-if="auth.can('audit.view')" value="activity">{{ t('plans.tabs.activity') }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="pricing">
            <EmptyState
              v-if="!plan.pricing.length"
              class="panel"
              icon="pi-wallet"
              :title="t('plans.noPriceYet')"
            />
            <DataTable v-else :value="plan.pricing" data-key="location_id" class="panel">
              <Column :header="t('plans.branch')" field="location" />
              <Column :header="t('plans.price')" header-class="end" body-class="end">
                <template #body="{ data }">
                  <span class="num">{{ format.money(data.price) }}</span>
                </template>
              </Column>
              <Column :header="t('plans.vat')" header-class="end" body-class="end">
                <template #body="{ data }">
                  <span v-if="data.vat_rate" class="num"
                    >{{ format.money(data.vat) }}
                    <small class="muted"
                      >({{ data.vat_rate }}% ·
                      {{
                        data.prices_include_vat ? t('plans.vatIncluded') : t('plans.vatAdded')
                      }})</small
                    ></span
                  >
                  <span v-else class="muted">{{ t('plans.noVat') }}</span>
                </template>
              </Column>
              <Column :header="t('plans.clientPays')" header-class="end" body-class="end">
                <template #body="{ data }">
                  <strong class="num">{{ format.money(data.gross) }}</strong>
                </template>
              </Column>
            </DataTable>
            <dl class="panel facts">
              <template v-if="plan.kind === 'membership'">
                <dt>{{ t('plans.sections.billing') }}</dt>
                <dd>{{ summary.billing(plan) }}</dd>
                <dt>{{ t('plans.joiningFee') }}</dt>
                <dd>{{ plan.joining_fee ? format.money(plan.joining_fee) : t('plans.noFee') }}</dd>
              </template>
              <template v-else>
                <dt>{{ t('plans.credits') }}</dt>
                <dd>{{ summary.access(plan) }}</dd>
                <dt>{{ t('plans.validity') }}</dt>
                <dd>{{ summary.billing(plan) }}</dd>
              </template>
              <dt>{{ t('plans.sections.activation') }}</dt>
              <dd>{{ activation }}</dd>
              <dt>{{ t('plans.sections.intro') }}</dt>
              <dd>{{ summary.intro(plan) ?? t('plans.intros.none') }}</dd>
            </dl>
          </TabPanel>

          <TabPanel value="rules">
            <dl class="panel facts">
              <template v-if="plan.kind === 'membership'">
                <dt>{{ t('plans.sections.access') }}</dt>
                <dd>{{ summary.access(plan) }}</dd>
              </template>
              <template v-for="row in coverage" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
              <dt>{{ t('plans.usageLimits') }}</dt>
              <dd>
                <template v-if="!limits.length">{{ t('plans.noLimit') }}</template>
                <ul v-else class="plain">
                  <li v-for="l in limits" :key="l.label">
                    <span class="muted">{{ l.label }}:</span> {{ l.value }}
                  </li>
                </ul>
              </dd>
            </dl>
          </TabPanel>

          <TabPanel value="locations">
            <dl class="panel facts">
              <dt>{{ t('plans.validAt') }}</dt>
              <dd>{{ locationMode }}</dd>
              <template v-if="plan.rule_names.locations.length">
                <dt>{{ t('plans.branches') }}</dt>
                <dd>{{ list(plan.rule_names.locations) }}</dd>
              </template>
              <dt>{{ t('plans.soldAt') }}</dt>
              <dd>{{ list(plan.pricing.map((p) => p.location)) || '–' }}</dd>
            </dl>
          </TabPanel>

          <TabPanel v-if="auth.can('clients.view')" value="holders">
            <div v-if="holdersState === 'loading' && !holders" class="panel pad">
              <Skeleton v-for="n in 3" :key="n" height="36px" class="sk" />
            </div>
            <ErrorState
              v-else-if="holdersState === 'error'"
              class="panel"
              compact
              @retry="loadHolders(holdersPage)"
            />
            <EmptyState
              v-else-if="!holders?.length"
              class="panel"
              compact
              icon="pi-users"
              :title="t('plans.noHolders')"
            />
            <DataTable
              v-else
              :value="holders"
              data-key="id"
              lazy
              paginator
              :rows="50"
              :total-records="holdersTotal"
              :first="(holdersPage - 1) * 50"
              :loading="holdersState === 'loading'"
              class="panel"
              @page="loadHolders($event.page + 1)"
            >
              <Column :header="t('plans.client')">
                <template #body="{ data }">
                  <RouterLink
                    :to="{
                      name: 'tenant.client',
                      params: { id: data.client.id },
                      query: { tab: 'memberships' },
                    }"
                    >{{ data.client.name }}</RouterLink
                  >
                  <small v-if="data.client.member_id" class="muted num">
                    · {{ data.client.member_id }}</small
                  >
                </template>
              </Column>
              <Column :header="t('plans.status')">
                <template #body="{ data }"><StatusTag :status="data.status" size="sm" /></template>
              </Column>
              <Column :header="t('clientMemberships.starts')">
                <template #body="{ data }">{{
                  data.starts_on ? format.date(data.starts_on) : '–'
                }}</template>
              </Column>
              <Column :header="t('clientMemberships.ends')">
                <template #body="{ data }">{{
                  data.ends_on ? format.date(data.ends_on) : '–'
                }}</template>
              </Column>
              <Column v-if="plan.kind === 'package'" :header="t('clientMemberships.credits')">
                <template #body="{ data }"
                  ><span class="num">{{ credits(data) }}</span></template
                >
              </Column>
              <Column :header="t('plans.soldAtOne')" field="sold_at" />
            </DataTable>
          </TabPanel>

          <TabPanel v-if="auth.can('audit.view')" value="activity">
            <ActivityTimeline entity-type="MembershipPlan" :entity-id="plan.id" />
          </TabPanel>
        </TabPanels>
      </Tabs>
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
.pad {
  padding: 16px;
}
.sk {
  margin-bottom: 8px;
}
.type {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font: var(--text-caption);
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.type .pi {
  font-size: 11px;
}
.type--package,
.type--intro {
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
}
.type--unlimited {
  background: var(--primary-50);
  color: var(--primary-700);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.stat {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
}
.stat__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--primary-50);
  color: var(--primary-700);
}
.stat__value {
  font: 600 20px var(--font-sans);
}
.stat__label {
  font: var(--text-small);
  color: var(--text-muted);
}
.desc {
  margin: 0;
  padding: 14px 16px;
  color: var(--text-secondary);
  white-space: pre-line;
}
.facts {
  margin: 16px 0 0;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 12px 16px;
}
.facts:first-child {
  margin-top: 0;
}
.facts dt {
  color: var(--text-muted);
  font: var(--text-small);
}
.facts dd {
  margin: 0;
}
.plain {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.muted {
  color: var(--text-muted);
}
.tab-count {
  margin-inline-start: 6px;
  font: var(--text-caption);
  color: var(--text-muted);
}
:deep(.end) {
  text-align: end;
}
@media (max-width: 720px) {
  .stats {
    grid-template-columns: 1fr;
  }
  .facts {
    grid-template-columns: 1fr;
  }
}
</style>
