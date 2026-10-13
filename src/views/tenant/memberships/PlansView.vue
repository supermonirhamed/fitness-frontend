<script setup lang="ts">
// Memberships → Plans (US-06.01): every plan with what it gives, how it is billed, its prices per
// branch and status. Only Published plans can be sold (selling arrives with the next EP-06 stories).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import PlanDrawer from '@/components/memberships/PlanDrawer.vue'
import { tenantApi, type MembershipPlan } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
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

const drawerOpen = ref(false)
const editing = ref<MembershipPlan | null>(null)
function open(plan: MembershipPlan | null) {
  editing.value = plan
  drawerOpen.value = true
}
function onSaved(plan: MembershipPlan) {
  toast.add({
    severity: 'success',
    summary: t('plans.saved', { name: plan.display_name }),
    life: 3000,
  })
  load()
}

const access = (p: MembershipPlan) =>
  p.type === 'Unlimited'
    ? t('plans.types.Unlimited')
    : t('plans.limitedSummary', { n: p.visit_limit, per: t(`plans.per.${p.visit_period}`) })
const billing = (p: MembershipPlan) =>
  p.billing === 'recurring'
    ? [
        t(`plans.intervals.${p.billing_interval}`),
        p.min_commitment_months
          ? t('plans.commitmentSummary', { n: p.min_commitment_months })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : t('plans.durationSummary', { n: p.duration_value, unit: t(`plans.units.${p.duration_unit}`) })
const priceRange = (p: MembershipPlan) => {
  const prices = p.prices.map((x) => x.price)
  if (!prices.length) return '—'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? format.money(min) : `${format.money(min)} – ${format.money(max)}`
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('plans.title')">
      <template v-if="canManage" #primary>
        <Button icon="pi pi-plus" :label="t('plans.new')" @click="open(null)" />
      </template>
    </PageHeader>

    <Skeleton v-if="state === 'loading'" height="200px" />
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
      <Button v-if="canManage" icon="pi pi-plus" :label="t('plans.new')" @click="open(null)" />
    </EmptyState>
    <div v-else class="grid">
      <article
        v-for="p in plans"
        :key="p.id"
        :class="['card', 'plan', { archived: p.status === 'Archived' }]"
      >
        <div class="plan__head">
          <h3>{{ p.display_name }}</h3>
          <StatusTag :status="p.status" size="sm" />
        </div>
        <div class="plan__price num">{{ priceRange(p) }}</div>
        <ul class="facts">
          <li><i class="pi pi-ticket" aria-hidden="true" /> {{ access(p) }}</li>
          <li><i class="pi pi-refresh" aria-hidden="true" /> {{ billing(p) }}</li>
          <li v-if="p.joining_fee">
            <i class="pi pi-plus-circle" aria-hidden="true" />
            {{ t('plans.feeSummary', { fee: format.money(p.joining_fee) }) }}
          </li>
          <li v-if="p.rules.limits.hours">
            <i class="pi pi-clock" aria-hidden="true" />
            {{ t('plans.hoursSummary', p.rules.limits.hours) }}
          </li>
          <li>
            <i class="pi pi-building" aria-hidden="true" />
            {{ p.prices.map((x) => x.location).join(', ') }}
          </li>
        </ul>
        <Button
          v-if="canManage"
          size="small"
          variant="text"
          icon="pi pi-pencil"
          :label="t('common.edit')"
          @click="open(p)"
        />
      </article>
    </div>

    <PlanDrawer v-model:visible="drawerOpen" :plan="editing" @saved="onSaved" />
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.plan {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plan.archived {
  opacity: 0.6;
}
.plan__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.plan__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.plan__price {
  font: 600 20px var(--font-sans);
}
.facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.facts .pi {
  margin-inline-end: 6px;
}
</style>
