<script setup lang="ts">
// Memberships → Plans & packages (US-06.01/02/07): every membership plan and credit package with
// what it gives, how it is billed or how long it lasts, its prices per branch, status, clients
// holding it and sales this month; filtered by kind, status and branch, and searched by name.
// A card opens the plan's details page; New opens the editor.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar from '@/components/patterns/FilterBar.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type MembershipPlan, type PlanKind } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePlanSummary } from '@/composables/usePlanSummary'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const format = useFormat()
const canManage = computed(() => auth.can('memberships.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const plans = ref<MembershipPlan[]>([])
async function load() {
  state.value = 'loading'
  try {
    plans.value = await tenantApi.membershipPlans.list()
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

const branch = ref<number | null>(null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const search = ref('')
const kind = ref<'all' | PlanKind>('all')
const kindOptions = computed(() => [
  { value: 'all', label: t('plans.kinds.all') },
  { value: 'membership', label: t('plans.kinds.membership') },
  { value: 'package', label: t('plans.kinds.package') },
])
const status = ref<'all' | MembershipPlan['status']>('all')
const count = (s: MembershipPlan['status']) => plans.value.filter((p) => p.status === s).length
const statusOptions = computed(() => [
  { value: 'all', label: t('plans.filters.all', { n: plans.value.length }) },
  ...(['Published', 'Draft', 'Archived'] as const).map((s) => ({
    value: s,
    label: t(`plans.filters.${s}`, { n: count(s) }),
  })),
])
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return plans.value.filter(
    (p) =>
      (status.value === 'all' || p.status === status.value) &&
      (kind.value === 'all' || p.kind === kind.value) &&
      (branch.value === null || p.prices.some((x) => x.location_id === branch.value)) &&
      (!q ||
        [p.display_name, p.name.ar, p.name.en].some((n) => (n ?? '').toLowerCase().includes(q))),
  )
})

const stats = computed(() => [
  { icon: 'pi-shopping-cart', label: t('plans.stats.onSale'), value: count('Published') },
  { icon: 'pi-pencil', label: t('plans.stats.drafts'), value: count('Draft') },
  {
    icon: 'pi-id-card',
    label: t('plans.stats.memberships'),
    value: plans.value.filter((p) => p.kind === 'membership' && p.status !== 'Archived').length,
  },
  {
    icon: 'pi-ticket',
    label: t('plans.stats.packages'),
    value: plans.value.filter((p) => p.kind === 'package' && p.status !== 'Archived').length,
  },
])

const create = () => router.push({ name: 'tenant.memberships.new' })
const createPackage = () => router.push({ name: 'tenant.memberships.newPackage' })
const open = (p: MembershipPlan) =>
  router.push({ name: 'tenant.memberships.show', params: { id: p.id } })

const { access, billing, covers, badge, priceRange, intro } = usePlanSummary()
</script>

<template>
  <div class="page">
    <PageHeader :title="t('plans.title')" :subtitle="t('plans.subtitle')">
      <template v-if="canManage" #actions>
        <Button
          icon="pi pi-ticket"
          :label="t('plans.newPackage')"
          severity="secondary"
          variant="outlined"
          @click="createPackage"
        />
      </template>
      <template v-if="canManage" #primary>
        <Button icon="pi pi-plus" :label="t('plans.new')" @click="create" />
      </template>
    </PageHeader>

    <div v-if="state === 'loading'" class="grid">
      <Skeleton v-for="n in 3" :key="n" height="240px" />
    </div>
    <NoPermission v-else-if="state === 'forbidden'" class="card" />
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('plans.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!plans.length"
      class="card"
      icon="pi-id-card"
      :title="t('plans.empty')"
      :body="t('plans.emptyHint')"
    >
      <div v-if="canManage" class="empty-actions">
        <Button icon="pi pi-plus" :label="t('plans.new')" @click="create" />
        <Button
          icon="pi pi-ticket"
          :label="t('plans.newPackage')"
          severity="secondary"
          variant="outlined"
          @click="createPackage"
        />
      </div>
    </EmptyState>

    <template v-else>
      <div class="stats">
        <div v-for="s in stats" :key="s.label" class="card stat">
          <span class="stat__icon"><i :class="['pi', s.icon]" aria-hidden="true" /></span>
          <div>
            <div class="stat__value num">{{ s.value }}</div>
            <div class="stat__label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <FilterBar v-model:search="search" :placeholder="t('plans.search')">
        <SelectButton
          v-model="kind"
          :options="kindOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('plans.kinds.label')"
        />
        <Select
          v-if="branches.length > 1"
          v-model="branch"
          :options="branches"
          option-label="name"
          option-value="id"
          show-clear
          :placeholder="t('plans.allBranches')"
          :aria-label="t('plans.branch')"
          class="branch-filter"
        />
        <SelectButton
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('plans.status')"
        />
      </FilterBar>

      <EmptyState
        v-if="!shown.length"
        class="card"
        compact
        icon="pi-search"
        :title="t('plans.noMatch')"
      />
      <div v-else class="grid">
        <article
          v-for="p in shown"
          :key="p.id"
          :class="['card', 'plan', 'plan--link', { 'plan--archived': p.status === 'Archived' }]"
          tabindex="0"
          role="link"
          :aria-label="t('plans.openNamed', { name: p.display_name })"
          @click="open(p)"
          @keydown.enter="open(p)"
        >
          <div class="plan__top">
            <span :class="['type', `type--${badge(p).cls}`]">
              <i :class="['pi', badge(p).icon]" aria-hidden="true" />
              {{ badge(p).label }}
            </span>
            <StatusTag :status="p.status" size="sm" />
          </div>
          <h3 class="plan__name">{{ p.display_name }}</h3>
          <p v-if="p.description?.en || p.description?.ar" class="plan__desc">
            {{
              $i18n.locale === 'ar'
                ? p.description?.ar || p.description?.en
                : p.description?.en || p.description?.ar
            }}
          </p>
          <div class="plan__price">
            <span class="num">{{ priceRange(p) ?? t('plans.noPriceYet') }}</span>
            <small v-if="priceRange(p) && p.billing === 'recurring'">{{
              t(`plans.perInterval.${p.billing_interval ?? 'month'}`)
            }}</small>
          </div>
          <ul class="facts">
            <li><i class="pi pi-ticket" aria-hidden="true" />{{ access(p) }}</li>
            <li><i class="pi pi-refresh" aria-hidden="true" />{{ billing(p) }}</li>
            <li><i class="pi pi-th-large" aria-hidden="true" />{{ covers(p) }}</li>
            <li v-if="p.joining_fee">
              <i class="pi pi-plus-circle" aria-hidden="true" />{{
                t('plans.feeSummary', { fee: format.money(p.joining_fee) })
              }}
            </li>
            <li v-if="p.intro_offer"><i class="pi pi-gift" aria-hidden="true" />{{ intro(p) }}</li>
            <li v-if="p.rules.limits.hours">
              <i class="pi pi-clock" aria-hidden="true" />{{
                t('plans.hoursSummary', p.rules.limits.hours)
              }}
            </li>
          </ul>
          <footer class="plan__foot">
            <span class="branches">
              <i class="pi pi-building" aria-hidden="true" />
              {{
                p.prices.length === 1
                  ? p.prices[0]!.location
                  : t('plans.branchCount', { n: p.prices.length })
              }}
            </span>
            <span class="sold num">
              {{ t('plans.holdersShort', { n: p.active_holders ?? 0 }) }} ·
              {{ t('plans.soldThisMonth', { n: p.sales_this_month ?? 0 }) }}
            </span>
          </footer>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.plan {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.plan--link {
  cursor: pointer;
}
.plan--link:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-1);
}
.plan--link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.plan--archived {
  opacity: 0.6;
}
.plan__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
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
.empty-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
.type--package {
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
}
.type--unlimited {
  background: var(--primary-50);
  color: var(--primary-700);
}
.type .pi {
  font-size: 11px;
}
.plan__name {
  margin: 4px 0 0;
  font: var(--text-h4);
}
.plan__desc {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.plan__price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.plan__price .num {
  font: 600 22px var(--font-sans);
}
.plan__price small {
  font: var(--text-small);
  color: var(--text-muted);
}
.facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font: var(--text-small);
  color: var(--text-secondary);
  flex: 1;
}
.facts .pi {
  margin-inline-end: 8px;
  color: var(--text-muted);
}
.plan__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid var(--border-subtle);
  font: var(--text-small);
  color: var(--text-muted);
}
.branches .pi {
  margin-inline-end: 6px;
}
.sold {
  color: var(--text-secondary);
}
.branch-filter {
  min-width: 180px;
}
@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
