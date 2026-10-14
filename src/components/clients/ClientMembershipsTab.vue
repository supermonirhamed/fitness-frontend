<script setup lang="ts">
// A client's memberships and packages (EP-06, US-06.09) on their profile: status, how it starts
// (US-06.03), start and expiry, credits left with their history, visits this period, and the
// services and branches it covers. Current ones first, then the history. Staff with
// memberships.create sell one from here (US-06.08) and freeze it (US-06.11); with
// entitlements.adjust they add or remove credits or extend the end date, with a reason. Recurring
// memberships change plan here (US-06.12); any can be cancelled (US-06.13) or, when its product
// allows, shared with the holder's children (US-06.15). Shared ones show on the child's profile too.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import AdjustEntitlementDialog from '@/components/memberships/AdjustEntitlementDialog.vue'
import AutoRenewDialog from '@/components/memberships/AutoRenewDialog.vue'
import CancelMembershipDialog from '@/components/memberships/CancelMembershipDialog.vue'
import ChangePlanDialog from '@/components/memberships/ChangePlanDialog.vue'
import FamilySharingDialog from '@/components/memberships/FamilySharingDialog.vue'
import FreezeMembershipDialog from '@/components/memberships/FreezeMembershipDialog.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import Message from 'primevue/message'
import EntitlementLedger from '@/components/memberships/EntitlementLedger.vue'
import SellMembershipDrawer from '@/components/memberships/SellMembershipDrawer.vue'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type ClientEntitlement, type UncoveredBooking } from '@/api/tenant'
import AffectedBookingsList from '@/components/memberships/AffectedBookingsList.vue'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const { t, locale } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const sellOpen = ref(false)

const state = ref<'loading' | 'ready' | 'error'>('loading')
const rows = ref<ClientEntitlement[]>([])
// Upcoming bookings their membership or package no longer covers (US-06.14).
const uncovered = ref<UncoveredBooking[]>([])
async function load() {
  state.value = 'loading'
  try {
    const [list, flagged] = await Promise.all([
      tenantApi.clients.entitlements(props.clientId),
      auth.can('bookings.view')
        ? tenantApi.clients.uncoveredBookings(props.clientId).catch(() => [])
        : Promise.resolve([]),
    ])
    rows.value = list
    uncovered.value = flagged
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

/** Held by this client, not shared with them by a guardian (US-06.15): only the holder's are managed here. */
const own = (e: ClientEntitlement) => e.holder.id === props.clientId
const current = (e: ClientEntitlement) =>
  ['Active', 'Pending', 'Frozen', 'Suspended'].includes(e.status)
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
const period = (e: ClientEntitlement) =>
  e.period_starts_on && e.period_ends_on
    ? `${format.date(e.period_starts_on)} – ${format.date(e.period_ends_on)}`
    : '–'

// Auto-renewal (US-06.10).
const renewing = ref<ClientEntitlement | null>(null)
const renewOpen = ref(false)
function openAutoRenew(e: ClientEntitlement) {
  renewing.value = e
  renewOpen.value = true
}
const canToggleRenew = (e: ClientEntitlement) =>
  own(e) &&
  e.recurring &&
  !e.cancellation &&
  auth.can('memberships.create') &&
  ['Active', 'Suspended', 'Pending', 'Frozen'].includes(e.status)
const list = (names: string[]) => names.join(locale.value === 'ar' ? '، ' : ', ')
const where = (e: ClientEntitlement) => {
  const l = e.locations
  if (l?.mode === 'home') return t('plans.locationModes.home')
  if (l?.mode === 'selected') return list(e.covers.locations)
  return l && !l.include_future ? t('plans.allCurrentBranches') : t('plans.locationModes.all')
}
const covers = (e: ClientEntitlement) => {
  const c = e.covers
  const base =
    c.mode === 'categories'
      ? list(c.categories)
      : c.mode === 'services'
        ? list(c.services)
        : c.mode === 'programs'
          ? list(c.programs)
          : t('plans.coverModes.all')
  return c.excluded.length ? t('clientMemberships.except', { base, names: list(c.excluded) }) : base
}
const visits = (e: ClientEntitlement) =>
  e.visits.limit !== null
    ? t('clientMemberships.visitsOf', { n: e.visits.used, limit: e.visits.limit })
    : String(e.visits.used)

// Credit history and manual adjustments (US-06.09).
const historyOpen = ref<Set<number>>(new Set())
function toggleHistory(e: ClientEntitlement) {
  const open = new Set(historyOpen.value)
  if (open.has(e.id)) open.delete(e.id)
  else open.add(e.id)
  historyOpen.value = open
}
const adjusting = ref<ClientEntitlement | null>(null)
const adjustOpen = ref(false)
function openAdjust(e: ClientEntitlement) {
  adjusting.value = e
  adjustOpen.value = true
}
const canAdjust = (e: ClientEntitlement) =>
  auth.can('entitlements.adjust') &&
  e.status !== 'Cancelled' &&
  (e.credits_total !== null || !!e.ends_on)
function onAdjusted(saved: ClientEntitlement) {
  rows.value = rows.value.map((r) => (r.id === saved.id ? saved : r))
  ledgerVersion.value++
}
const ledgerVersion = ref(0)

// Freezing (US-06.11).
const toast = useToast()
const freezing = ref<ClientEntitlement | null>(null)
const freezeOpen = ref(false)
const canFreeze = (e: ClientEntitlement) =>
  auth.can('memberships.create') && !!e.freeze_policy && e.status === 'Active' && !e.freeze
function onFrozen(saved: ClientEntitlement) {
  onAdjusted(saved)
  toast.add({
    severity: 'success',
    summary:
      saved.status === 'Frozen'
        ? t('freeze.frozen', { date: format.date(saved.freeze!.ends_on) })
        : t('freeze.scheduled', { date: format.date(saved.freeze!.starts_on) }),
    life: 4000,
  })
}
// A confirmation before ending a freeze or calling off a planned change.
const confirm = ref<{
  title: string
  text: string
  run: () => Promise<ClientEntitlement>
} | null>(null)
const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmError = ref<string | null>(null)
function ask(title: string, text: string, run: () => Promise<ClientEntitlement>) {
  confirm.value = { title, text, run }
  confirmError.value = null
  confirmOpen.value = true
}
async function confirmed() {
  if (!confirm.value) return
  confirmBusy.value = true
  confirmError.value = null
  try {
    onAdjusted(await confirm.value.run())
    confirmOpen.value = false
  } catch (err) {
    confirmError.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    confirmBusy.value = false
  }
}
function openEndFreeze(e: ClientEntitlement) {
  const active = e.freeze?.status === 'Active'
  ask(
    active ? t('freeze.endNow') : t('freeze.callOff'),
    active ? t('freeze.endNowText') : t('freeze.callOffText'),
    () => tenantApi.clients.endFreeze(props.clientId, e.id, e.freeze!.id),
  )
}

// Upgrade / downgrade (US-06.12).
const changing = ref<ClientEntitlement | null>(null)
const changeOpen = ref(false)
const canChange = (e: ClientEntitlement) =>
  auth.can('memberships.create') && e.recurring && e.status === 'Active' && !e.scheduled_change
function onChanged(saved: ClientEntitlement) {
  onAdjusted(saved)
  toast.add({
    severity: 'success',
    summary: saved.scheduled_change
      ? t('changePlan.scheduled', {
          name: saved.scheduled_change.name,
          date: format.date(saved.scheduled_change.on),
        })
      : t('changePlan.changed', { name: saved.name }),
    life: 4000,
  })
}
function openCancelChange(e: ClientEntitlement) {
  ask(
    t('changePlan.callOff'),
    t('changePlan.callOffText', { name: e.scheduled_change!.name }),
    () => tenantApi.clients.cancelPlanChange(props.clientId, e.id),
  )
}
// Cancelling (US-06.13); one cancelled at the end of its period can be withdrawn.
const cancelling = ref<ClientEntitlement | null>(null)
const cancelOpen = ref(false)
const canCancel = (e: ClientEntitlement) =>
  auth.can('memberships.create') && current(e) && !e.cancellation
function onCancelled(saved: ClientEntitlement) {
  onAdjusted(saved)
  toast.add({
    severity: 'success',
    summary:
      saved.status === 'Cancelled'
        ? t('cancelMembership.cancelled')
        : t('cancelMembership.cancelsOn', { date: format.date(saved.ends_on!) }),
    life: 4000,
  })
}
function openWithdraw(e: ClientEntitlement) {
  ask(t('cancelMembership.withdraw'), t('cancelMembership.withdrawText'), () =>
    tenantApi.clients.setAutoRenew(props.clientId, e.id, { auto_renew: true }),
  )
}

// Family sharing (US-06.15).
const sharingWith = ref<ClientEntitlement | null>(null)
const shareOpen = ref(false)
const canShare = (e: ClientEntitlement) =>
  auth.can('memberships.create') && !!e.sharing && current(e)
const sharedWith = (e: ClientEntitlement) =>
  list(e.sharing!.members.map((m) => t('sharing.memberVisits', { name: m.name, n: m.visits })))

// The actions menu of one membership or package.
const menu = ref<InstanceType<typeof Menu>>()
const menuItems = ref<MenuItem[]>([])
function itemsFor(e: ClientEntitlement): MenuItem[] {
  if (!own(e)) return []
  return [
    canShare(e) && {
      label: t('sharing.title'),
      icon: 'pi pi-users',
      command: () => {
        sharingWith.value = e
        shareOpen.value = true
      },
    },
    canChange(e) && {
      label: t('changePlan.title'),
      icon: 'pi pi-arrow-right-arrow-left',
      command: () => {
        changing.value = e
        changeOpen.value = true
      },
    },
    canFreeze(e) && {
      label: t('freeze.title'),
      icon: 'pi pi-pause-circle',
      command: () => {
        freezing.value = e
        freezeOpen.value = true
      },
    },
    canAdjust(e) && {
      label: t('adjust.title'),
      icon: 'pi pi-sliders-h',
      command: () => openAdjust(e),
    },
    canCancel(e) && { separator: true },
    canCancel(e) && {
      label: t('cancelMembership.title'),
      icon: 'pi pi-ban',
      command: () => {
        cancelling.value = e
        cancelOpen.value = true
      },
    },
  ].filter(Boolean) as MenuItem[]
}
function openMenu(event: Event, e: ClientEntitlement) {
  menuItems.value = itemsFor(e)
  menu.value?.toggle(event)
}
</script>

<template>
  <div class="tab">
    <div v-if="auth.can('memberships.create')" class="toolbar">
      <Button icon="pi pi-shopping-cart" :label="t('sell.title')" @click="sellOpen = true" />
    </div>
    <AffectedBookingsList
      v-if="state === 'ready' && uncovered.length"
      :bookings="uncovered"
      :title="t('clientMemberships.uncovered', uncovered.length)"
    />
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
            <span v-if="!own(e)" class="shared"
              ><i class="pi pi-users" aria-hidden="true" />{{
                t('sharing.sharedBy', { name: e.holder.name })
              }}</span
            >
            <span v-if="e.awaiting_payment" class="awaiting"
              ><i class="pi pi-lock" aria-hidden="true" />{{
                t('clientMemberships.awaitingPayment')
              }}</span
            >
            <StatusTag :status="e.status" size="sm" />
          </span>
        </div>
        <Message
          v-if="e.status === 'Suspended'"
          severity="error"
          :closable="false"
          icon="pi pi-lock"
          size="small"
          >{{ t('clientMemberships.suspended') }}</Message
        >
        <Message
          v-if="e.freeze"
          :severity="e.freeze.status === 'Active' ? 'info' : 'secondary'"
          :closable="false"
          icon="pi pi-pause-circle"
          size="small"
        >
          <span class="banner">
            <span>{{
              t(e.freeze.status === 'Active' ? 'freeze.frozenBanner' : 'freeze.scheduledBanner', {
                from: format.date(e.freeze.starts_on),
                to: format.date(e.freeze.ends_on),
              })
            }}</span>
            <Button
              v-if="own(e) && auth.can('memberships.create')"
              size="small"
              variant="text"
              :label="e.freeze.status === 'Active' ? t('freeze.endNow') : t('freeze.callOff')"
              @click="openEndFreeze(e)"
            />
          </span>
        </Message>
        <Message
          v-if="e.cancellation"
          :severity="e.status === 'Cancelled' ? 'secondary' : 'warn'"
          :closable="false"
          icon="pi pi-ban"
          size="small"
        >
          <span class="banner">
            <span
              >{{
                e.status === 'Cancelled'
                  ? t('cancelMembership.cancelledOn', { date: format.date(e.cancellation.at) })
                  : t('cancelMembership.cancelsOn', { date: format.date(e.ends_on!) })
              }}
              · {{ t(`cancelMembership.reasons.${e.cancellation.reason}`)
              }}<template v-if="e.cancellation.note"> · {{ e.cancellation.note }}</template></span
            >
            <Button
              v-if="
                own(e) && e.status !== 'Cancelled' && e.recurring && auth.can('memberships.create')
              "
              size="small"
              variant="text"
              :label="t('cancelMembership.withdraw')"
              @click="openWithdraw(e)"
            />
          </span>
        </Message>
        <Message
          v-if="e.scheduled_change"
          severity="secondary"
          :closable="false"
          icon="pi pi-arrow-down"
          size="small"
        >
          <span class="banner">
            <span>{{
              t('changePlan.waiting', {
                name: e.scheduled_change.name,
                date: format.date(e.scheduled_change.on),
              })
            }}</span>
            <Button
              v-if="own(e) && auth.can('memberships.create')"
              size="small"
              variant="text"
              :label="t('changePlan.callOff')"
              @click="openCancelChange(e)"
            />
          </span>
        </Message>
        <dl class="facts">
          <div>
            <dt>{{ t('clientMemberships.starts') }}</dt>
            <dd>{{ starts(e) }}</dd>
          </div>
          <div>
            <dt>{{ t('clientMemberships.ends') }}</dt>
            <dd>{{ ends(e) }}</dd>
          </div>
          <template v-if="e.recurring && e.period_ends_on">
            <div>
              <dt>{{ t('clientMemberships.period') }}</dt>
              <dd>{{ period(e) }}</dd>
            </div>
            <div>
              <dt>
                {{ e.renews_on ? t('clientMemberships.renewsOn') : t('clientMemberships.endsOn') }}
              </dt>
              <dd>
                {{ format.date((e.renews_on ?? e.ends_on)!) }}
                <small v-if="!e.auto_renew" class="muted">{{
                  t('clientMemberships.autoRenewOff')
                }}</small>
              </dd>
            </div>
            <div v-if="e.commitment_ends_on">
              <dt>{{ t('clientMemberships.commitment') }}</dt>
              <dd>{{ format.date(e.commitment_ends_on) }}</dd>
            </div>
          </template>
          <div v-if="own(e) && e.sharing">
            <dt>{{ t('sharing.sharedWith') }}</dt>
            <dd>{{ e.sharing.members.length ? sharedWith(e) : t('sharing.nobody') }}</dd>
          </div>
          <div>
            <dt>{{ t('clientMemberships.validAt') }}</dt>
            <dd>{{ where(e) }}</dd>
          </div>
          <div>
            <dt>{{ t('clientMemberships.covers') }}</dt>
            <dd>{{ covers(e) }}</dd>
          </div>
          <div v-if="e.kind === 'membership' && e.status !== 'Pending'">
            <dt>{{ t(`clientMemberships.visitsThis.${e.visits.period}`) }}</dt>
            <dd class="num">{{ visits(e) }}</dd>
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
        <div
          v-if="e.credits_total !== null || itemsFor(e).length || canToggleRenew(e)"
          class="item__actions"
        >
          <Button
            v-if="canToggleRenew(e)"
            size="small"
            variant="text"
            :severity="e.auto_renew ? 'secondary' : 'primary'"
            icon="pi pi-refresh"
            :label="e.auto_renew ? t('autoRenew.turnOff') : t('autoRenew.turnOn')"
            @click="openAutoRenew(e)"
          />
          <Button
            v-if="e.credits_total !== null"
            size="small"
            variant="text"
            severity="secondary"
            :icon="historyOpen.has(e.id) ? 'pi pi-chevron-up' : 'pi pi-history'"
            :label="t('ledger.title')"
            :aria-expanded="historyOpen.has(e.id)"
            @click="toggleHistory(e)"
          />
          <Button
            v-if="itemsFor(e).length"
            size="small"
            variant="outlined"
            severity="secondary"
            icon="pi pi-ellipsis-h"
            :label="t('clientMemberships.actions')"
            aria-haspopup="true"
            @click="openMenu($event, e)"
          />
        </div>
        <EntitlementLedger
          v-if="historyOpen.has(e.id)"
          :key="`${e.id}-${ledgerVersion}`"
          :client-id="clientId"
          :entitlement-id="e.id"
        />
      </li>
    </ul>
    <Menu ref="menu" :model="menuItems" popup />
    <SellMembershipDrawer v-model:visible="sellOpen" :client-id="clientId" @sold="load" />
    <FreezeMembershipDialog
      v-model:visible="freezeOpen"
      :client-id="clientId"
      :entitlement="freezing"
      @saved="onFrozen"
    />
    <FamilySharingDialog
      v-model:visible="shareOpen"
      :client-id="clientId"
      :entitlement="sharingWith"
      @saved="onAdjusted"
    />
    <CancelMembershipDialog
      v-model:visible="cancelOpen"
      :client-id="clientId"
      :entitlement="cancelling"
      @saved="onCancelled"
    />
    <ChangePlanDialog
      v-model:visible="changeOpen"
      :client-id="clientId"
      :entitlement="changing"
      @saved="onChanged"
    />
    <ConfirmActionDialog
      v-model:visible="confirmOpen"
      :title="confirm?.title ?? ''"
      :description="confirm?.text"
      :confirm-label="confirm?.title ?? ''"
      :loading="confirmBusy"
      :error="confirmError"
      @confirm="confirmed"
    />
    <AutoRenewDialog
      v-model:visible="renewOpen"
      :client-id="clientId"
      :entitlement="renewing"
      @saved="onAdjusted"
    />
    <AdjustEntitlementDialog
      v-model:visible="adjustOpen"
      :client-id="clientId"
      :entitlement="adjusting"
      @saved="onAdjusted"
    />
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
.item__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.banner {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.item__tags {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.shared {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font: var(--text-caption);
  color: var(--primary-700);
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
