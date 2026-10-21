<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import PageHeader from '@/components/patterns/PageHeader.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import {
  tenantApi,
  type Invoice,
  type InvoiceTotals,
  type StaffInboxItem,
  type UncoveredBooking,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffInboxText } from '@/composables/useStaffInboxText'
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

// The Alerts Center (Breakdown §2, US-12.15): the user's unread staff alerts, urgent first.
const alertText = useStaffInboxText()
const alerts = ref<StaffInboxItem[]>([])
onMounted(async () => {
  alerts.value = await tenantApi.staffInbox.alerts().catch(() => [])
})
async function dismiss(ids?: number[]) {
  const gone = ids ?? alerts.value.map((a) => a.id)
  alerts.value = alerts.value.filter((a) => !gone.includes(a.id))
  await tenantApi.staffInbox.read(gone).catch(() => undefined)
}
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
    <section v-if="alerts.length" class="card uncovered" :aria-label="t('today.alertsTitle')">
      <header class="uncovered__head">
        <i class="pi pi-bell" aria-hidden="true" />
        <div>
          <h2>{{ t('today.alertsTitle') }}</h2>
          <p>{{ t('today.alertsHint') }}</p>
        </div>
        <Button
          :label="t('today.dismissAll')"
          variant="text"
          size="small"
          class="see-all"
          @click="dismiss()"
        />
      </header>
      <ul>
        <li v-for="a in alerts" :key="a.id" class="alert">
          <i
            :class="['pi', a.urgent ? 'pi-exclamation-circle urgent' : 'pi-info-circle muted']"
            aria-hidden="true"
          />
          <RouterLink
            v-if="typeof a.data.link === 'string'"
            :to="a.data.link"
            class="alert__text"
            @click="dismiss([a.id])"
            >{{ alertText(a) }}</RouterLink
          >
          <span v-else class="alert__text">{{ alertText(a) }}</span>
          <span class="muted">{{ a.at ? format.dateTime(a.at) : '' }}</span>
          <Button
            icon="pi pi-check"
            variant="text"
            size="small"
            severity="secondary"
            rounded
            :aria-label="t('today.dismiss')"
            @click="dismiss([a.id])"
          />
        </li>
      </ul>
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
.uncovered li.alert {
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
}
.alert__text {
  color: var(--text-primary);
}
a.alert__text:hover {
  text-decoration: underline;
}
.urgent {
  color: var(--sev-warn-solid);
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
