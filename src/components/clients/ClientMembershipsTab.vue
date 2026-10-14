<script setup lang="ts">
// A client's memberships and packages (EP-06) on their profile: status, how it starts (US-06.03),
// start and expiry (counted from the actual activation), credits left and where it is valid.
// Current ones first, then the history. Staff with memberships.create sell one from here (US-06.08).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SellMembershipDrawer from '@/components/memberships/SellMembershipDrawer.vue'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type ClientEntitlement } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const sellOpen = ref(false)

const state = ref<'loading' | 'ready' | 'error'>('loading')
const rows = ref<ClientEntitlement[]>([])
async function load() {
  state.value = 'loading'
  try {
    rows.value = await tenantApi.clients.entitlements(props.clientId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const current = (e: ClientEntitlement) => ['Active', 'Pending', 'Frozen'].includes(e.status)
const what = (e: ClientEntitlement) =>
  e.kind === 'package'
    ? t('plans.kindOne.package')
    : e.type === 'Unlimited'
      ? t('plans.types.Unlimited')
      : t('plans.types.Limited')
const starts = (e: ClientEntitlement) => {
  if (e.starts_on) return format.date(e.starts_on)
  if (e.activation === 'first_use')
    return t('clientMemberships.onFirstUse', {
      date: e.activate_by ? format.date(e.activate_by) : '–',
    })
  return '–'
}
const ends = (e: ClientEntitlement) => {
  if (e.ends_on) return format.date(e.ends_on)
  if (e.ends_if_started_today)
    return t('clientMemberships.ifUsedToday', { date: format.date(e.ends_if_started_today) })
  return e.billing === 'recurring' ? t('clientMemberships.untilCancelled') : '–'
}
const where = (e: ClientEntitlement) => {
  const l = e.locations
  if (!l || l.mode === 'all')
    return l && !l.include_future ? t('plans.allCurrentBranches') : t('plans.locationModes.all')
  if (l.mode === 'home') return t('plans.locationModes.home')
  return t('plans.validAtCount', { n: l.location_ids.length })
}
</script>

<template>
  <div class="tab">
    <div v-if="auth.can('memberships.create')" class="toolbar">
      <Button icon="pi pi-shopping-cart" :label="t('sell.title')" @click="sellOpen = true" />
    </div>
    <div v-if="state === 'loading'" class="card pad">
      <Skeleton v-for="n in 2" :key="n" height="88px" class="sk" />
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('clientMemberships.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!rows.length"
      class="card"
      icon="pi-id-card"
      :title="t('clientMemberships.empty')"
      :body="
        auth.can('memberships.create')
          ? t('clientMemberships.emptyHintSell')
          : t('clientMemberships.emptyHint')
      "
    />
    <ul v-else class="list">
      <li v-for="e in rows" :key="e.id" :class="['card', 'item', { 'item--past': !current(e) }]">
        <div class="item__head">
          <span :class="['icon', `icon--${e.kind}`]" aria-hidden="true"
            ><i :class="['pi', e.kind === 'package' ? 'pi-ticket' : 'pi-id-card']"
          /></span>
          <div class="item__title">
            <strong>{{ e.name }}</strong>
            <small class="muted"
              >{{ what(e) }} ·
              {{ t('clientMemberships.bought', { date: format.date(e.purchased_on) })
              }}<template v-if="e.sold_at"> · {{ e.sold_at }}</template></small
            >
          </div>
          <span class="item__tags">
            <span v-if="e.awaiting_payment" class="awaiting"
              ><i class="pi pi-lock" aria-hidden="true" />{{
                t('clientMemberships.awaitingPayment')
              }}</span
            >
            <StatusTag :status="e.status" size="sm" />
          </span>
        </div>
        <dl class="facts">
          <div>
            <dt>{{ t('clientMemberships.starts') }}</dt>
            <dd>{{ starts(e) }}</dd>
          </div>
          <div>
            <dt>{{ t('clientMemberships.ends') }}</dt>
            <dd>{{ ends(e) }}</dd>
          </div>
          <div>
            <dt>{{ t('clientMemberships.validAt') }}</dt>
            <dd>{{ where(e) }}</dd>
          </div>
          <div v-if="e.invoice">
            <dt>{{ t('clientMemberships.invoice') }}</dt>
            <dd>
              <span class="mono">{{ e.invoice.number }}</span>
              <StatusTag :status="e.invoice.status" size="sm" />
            </dd>
          </div>
          <div v-if="e.activated_by">
            <dt>{{ t('clientMemberships.activatedBy') }}</dt>
            <dd>{{ t(`clientMemberships.triggers.${e.activated_by}`) }}</dd>
          </div>
        </dl>
        <div v-if="e.credits_total !== null" class="credits">
          <div class="credits__row">
            <span>{{ t('clientMemberships.credits') }}</span>
            <span class="num">{{
              t('clientMemberships.creditsLeft', { n: e.credits_left, total: e.credits_total })
            }}</span>
          </div>
          <ProgressBar
            :value="
              e.credits_total ? Math.round(((e.credits_left ?? 0) / e.credits_total) * 100) : 0
            "
            :show-value="false"
            class="credits__bar"
          />
        </div>
      </li>
    </ul>
    <SellMembershipDrawer v-model:visible="sellOpen" :client-id="clientId" @sold="load" />
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: flex-end;
}
.item__tags {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.awaiting {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font: var(--text-caption);
  color: var(--sev-warn-fg);
}
.mono {
  font-family: var(--font-mono);
  margin-inline-end: 6px;
}
.card {
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
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item--past {
  opacity: 0.65;
}
.item__head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.item__title {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--primary-50);
  color: var(--primary-700);
}
.icon--package {
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.facts dt {
  font: var(--text-caption);
  color: var(--text-muted);
}
.facts dd {
  margin: 2px 0 0;
  font: 500 14px var(--font-sans);
}
.credits {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.credits__row {
  display: flex;
  justify-content: space-between;
  font: var(--text-small);
}
.credits__bar {
  height: 6px;
}
@media (max-width: 720px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
