<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import PageHeader from '@/components/patterns/PageHeader.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi, type Invoice, type InvoiceTotals, type UncoveredBooking } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, d, locale } = useI18n()
const auth = useStaffAuth()
const format = useFormat()

// Follows the branch switcher (US-01.13): today's date there, in its timezone.
const subtitle = computed(() => {
  const branch = auth.currentLocation
  const date = d(new Date(), 'long')
  return branch
    ? t('today.atBranch', {
        date: new Date().toLocaleDateString(locale.value, {
          dateStyle: 'full',
          timeZone: branch.timezone,
        }),
        branch: branch.name,
      })
    : date
})

// Onboarding (US-01.03): an organization starts without branches; whoever may add one is asked to.
const needsFirstBranch = ref(false)
onMounted(async () => {
  if (!auth.can('locations.create')) return
  try {
    needsFirstBranch.value = (await tenantApi.locations()).length === 0
  } catch {
    // the prompt is a shortcut; the branches page shows the same
  }
})

// Upcoming bookings their membership or package no longer covers (US-06.14): not cancelled
// automatically, so the desk can sell a renewal or settle them. Follows the branch switcher.
const uncovered = ref<UncoveredBooking[]>([])
async function loadUncovered() {
  if (!auth.can('bookings.view')) return
  try {
    uncovered.value = await tenantApi.dashboard.uncoveredBookings()
  } catch {
    uncovered.value = []
  }
}
onMounted(loadUncovered)
watch(() => auth.currentLocation?.id, loadUncovered)

// Overdue invoices at the branch (US-07.05): past their due date with a balance.
const overdue = ref<{ data: Invoice[]; totals: InvoiceTotals } | null>(null)
async function loadOverdue() {
  if (!auth.can('payments.view')) return
  overdue.value = await tenantApi.invoices.overdue().catch(() => null)
}
onMounted(loadOverdue)
watch(() => auth.currentLocation?.id, loadOverdue)
</script>

<template>
  <div class="today">
    <PageHeader :title="t('today.title')" :subtitle="subtitle" />
    <section v-if="needsFirstBranch" class="card">
      <EmptyState
        icon="pi-building"
        :title="t('today.firstBranchTitle')"
        :body="t('today.firstBranchBody')"
      >
        <Button
          icon="pi pi-plus"
          :label="t('locationForm.firstBranch')"
          @click="$router.push({ name: 'tenant.branches', query: { new: '1' } })"
        />
      </EmptyState>
    </section>
    <section v-if="overdue?.data.length" class="card uncovered">
      <header class="uncovered__head">
        <i class="pi pi-file-excel" aria-hidden="true" />
        <div>
          <h2>{{ t('today.overdueTitle', overdue.totals.overdue) }}</h2>
          <p>{{ t('today.overdueHint') }}</p>
        </div>
        <RouterLink :to="{ name: 'tenant.invoices', query: { due: 'overdue' } }" class="see-all">{{
          t('today.seeAll')
        }}</RouterLink>
      </header>
      <ul>
        <li v-for="i in overdue.data" :key="i.id">
          <RouterLink :to="{ name: 'tenant.invoice', params: { id: i.id } }" class="who">{{
            i.number
          }}</RouterLink>
          <span>{{ i.client.name ?? '—' }}</span>
          <span class="muted">{{ t('today.dueSince', { date: format.date(i.due_on) }) }}</span>
          <strong class="num">{{ format.money(i.balance) }}</strong>
        </li>
      </ul>
    </section>
    <section v-if="uncovered.length" class="card uncovered">
      <header class="uncovered__head">
        <i class="pi pi-exclamation-triangle" aria-hidden="true" />
        <div>
          <h2>{{ t('today.uncoveredTitle', uncovered.length) }}</h2>
          <p>{{ t('today.uncoveredHint') }}</p>
        </div>
      </header>
      <ul>
        <li v-for="b in uncovered" :key="b.id">
          <RouterLink
            :to="{
              name: 'tenant.client',
              params: { id: b.client_id },
              query: { tab: 'memberships' },
            }"
            class="who"
            >{{ b.client }}</RouterLink
          >
          <span>{{ b.session }}</span>
          <span class="muted">{{ format.dateTime(b.starts_at) }}</span>
          <span class="muted"
            >{{ b.plan }} ·
            {{
              b.entitlement_status === 'Active' && b.ends_on
                ? t('today.endsOn', { date: format.date(b.ends_on) })
                : t(`status.${b.entitlement_status}`)
            }}</span
          >
        </li>
      </ul>
    </section>
    <section v-if="!needsFirstBranch" class="card">
      <EmptyState
        icon="pi-sun"
        :title="t('today.welcome', { name: auth.user?.name.split(' ')[0] })"
        :body="t('today.empty')"
      />
    </section>
  </div>
</template>

<style scoped>
.today {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.uncovered {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.uncovered__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.uncovered__head i {
  color: var(--sev-warn-solid);
  margin-top: 4px;
}
.see-all {
  margin-inline-start: auto;
  font: var(--text-small);
  white-space: nowrap;
}
.uncovered__head h2 {
  margin: 0;
  font: var(--text-h4);
}
.uncovered__head p {
  margin: 2px 0 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.uncovered ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.uncovered li {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1.4fr;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border-subtle, var(--border-default));
  font: var(--text-small);
}
.who {
  font-weight: 600;
  color: var(--text-link, var(--primary-700));
}
.muted {
  color: var(--text-muted);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
</style>
