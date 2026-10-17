<script setup lang="ts">
// The check-in desk (ui_kits/admin/CheckInScreen.jsx; US-08.01–08.03, US-08.08), made for a
// tablet: search by name, mobile or member ID, or scan a QR code (camera, or a USB scanner typing
// into the box). The client's card shows their photo, status and alerts, today's bookings here
// with one-click check-in inside the window, gym floor entry with open access, and sessions they
// could book and enter now. A refusal says why; staff with attendance.override allow entry with a
// reason (flagged Override). Recent check-ins can be undone within the undo window.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import QrScanDialog from '@/components/checkin/QrScanDialog.vue'
import StaffClockDialog from '@/components/checkin/StaffClockDialog.vue'
import {
  tenantApi,
  type CheckInCard,
  type CheckInDenial,
  type CheckInRecord,
  type CheckInSearchResult,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const locationId = computed(
  () => auth.currentLocation?.id ?? auth.user?.switchable_locations[0]?.id ?? null,
)

// Search
const q = ref('')
const input = ref<{ $el: HTMLInputElement } | null>(null)
const matches = ref<CheckInSearchResult[]>([])
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
async function search(now = false) {
  clearTimeout(timer)
  const term = q.value.trim()
  if (!term) {
    matches.value = []
    return
  }
  const run = async () => {
    const mine = ++seq
    searching.value = true
    const found = await tenantApi.checkIn.search(term).catch(() => [])
    if (mine !== seq) return
    matches.value = found
    searching.value = false
    // A scanned code (an exact match) opens the client at once.
    if (now && found.length && found[0]!.exact) pick(found[0]!.id)
  }
  if (now) await run()
  else timer = setTimeout(run, 250)
}
watch(q, () => {
  card.value = null
  search()
})
const focusSearch = () => nextTick(() => input.value?.$el?.focus?.())

// The client's card
const card = ref<CheckInCard | null>(null)
const loadingCard = ref(false)
async function pick(clientId: number) {
  loadingCard.value = true
  try {
    card.value = await tenantApi.checkIn.card(clientId, locationId.value)
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    loadingCard.value = false
  }
}
async function refreshCard() {
  if (card.value) await pick(card.value.client.id)
}

// What stands in the way: the first booking's denials, else gym floor entry's.
const nextBooking = computed(() => card.value?.bookings.find((b) => !b.check_in) ?? null)
const gym = computed(() => card.value?.open_access[0] ?? null)
const blocking = computed<CheckInDenial[]>(() => {
  if (!card.value) return []
  if (card.value.alerts.blocked)
    return [
      {
        code: 'blocked',
        message: t('checkIn.blocked', { reason: card.value.client.status_reason ?? '—' }),
      },
    ]
  if (nextBooking.value)
    return nextBooking.value.denials.filter((d) => !['too_early', 'too_late'].includes(d.code))
  if (!card.value.bookings.length && !card.value.bookable.length)
    return gym.value?.denials.length
      ? gym.value.denials
      : gym.value
        ? []
        : [{ code: 'no_booking', message: t('checkIn.noBookingToday') }]
  return []
})

// Check-in actions
const busy = ref(false)
const success = ref<{ name: string; what: string; override: boolean } | null>(null)
let successTimer: ReturnType<typeof setTimeout> | undefined
function done(record: CheckInRecord) {
  success.value = {
    name: record.client?.name ?? card.value?.client.name ?? '',
    what: record.session
      ? t('checkIn.checkedInTo', {
          session: record.session.title,
          time: format.time(record.session.starts_at),
        })
      : t('checkIn.gymEntry', { service: record.service ?? '' }),
    override: record.override,
  }
  loadRecent()
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    success.value = null
    card.value = null
    q.value = ''
    focusSearch()
  }, 3000)
}
async function run(action: () => Promise<CheckInRecord>) {
  busy.value = true
  try {
    done(await action())
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 5000 })
    await refreshCard()
  } finally {
    busy.value = false
  }
}
const checkInBooking = (bookingId: number, override = false, reason: string | null = null) =>
  run(() =>
    tenantApi.checkIn.booking(bookingId, { location_id: locationId.value, override, reason }),
  )
const enterGym = (override = false, reason: string | null = null) =>
  card.value &&
  run(() =>
    tenantApi.checkIn.openAccess({
      client_id: card.value!.client.id,
      service_id: gym.value?.service.id,
      location_id: locationId.value,
      override,
      reason,
    }),
  )
const bookAndCheckIn = (sessionId: number) =>
  card.value &&
  run(() =>
    tenantApi.checkIn.bookAndCheckIn(sessionId, {
      client_id: card.value!.client.id,
      location_id: locationId.value,
    }),
  )

// Allow entry (override)
const overriding = ref(false)
function allowEntry(reason: string) {
  overriding.value = false
  if (nextBooking.value) checkInBooking(nextBooking.value.id, true, reason)
  else enterGym(true, reason)
}

// Recent check-ins and undo
const recent = ref<CheckInRecord[]>([])
async function loadRecent() {
  recent.value = await tenantApi.checkIn.recent(locationId.value).catch(() => [])
}
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 30000)
const canUndo = (r: CheckInRecord) =>
  !r.undone_at && (new Date(r.undo_until).getTime() > now.value || auth.can('attendance.override'))
const undoing = ref<CheckInRecord | null>(null)
async function undo(r: CheckInRecord, reason: string | null = null) {
  const late = new Date(r.undo_until).getTime() <= now.value
  if (late && !reason) {
    undoing.value = r
    return
  }
  undoing.value = null
  try {
    await tenantApi.checkIn.undo(r.id, reason)
    toast.add({ severity: 'info', summary: t('checkIn.undone'), life: 3000 })
    await Promise.all([loadRecent(), refreshCard()])
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  }
}
const gymCount = computed(
  () => recent.value.filter((r) => r.kind === 'open_access' && !r.undone_at).length,
)

const scanning = ref(false)
function onScanned(code: string) {
  q.value = code
  search(true)
}
const clocking = ref(false)
watch(locationId, () => {
  card.value = null
  loadRecent()
})
onMounted(() => {
  loadRecent()
  focusSearch()
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearTimeout(successTimer)
})
const bookingState = (b: CheckInCard['bookings'][number]) => {
  if (b.check_in) return 'done'
  if (new Date(b.window.opens_at).getTime() > now.value) return 'early'
  if (new Date(b.window.closes_at).getTime() < now.value) return 'late'
  return 'open'
}
</script>

<template>
  <div class="desk">
    <div class="main">
      <div class="bar">
        <IconField class="bar__search">
          <InputIcon class="pi pi-search" />
          <InputText
            ref="input"
            v-model="q"
            :placeholder="t('checkIn.searchPlaceholder')"
            :aria-label="t('checkIn.searchPlaceholder')"
            size="large"
            fluid
            autofocus
            @keydown.enter.prevent="search(true)"
          />
        </IconField>
        <Button
          size="large"
          icon="pi pi-qrcode"
          :label="t('checkIn.scan')"
          severity="secondary"
          @click="scanning = true"
        />
        <Button
          size="large"
          icon="pi pi-sign-in"
          :label="t('checkIn.gymFloor')"
          severity="secondary"
          variant="outlined"
          :badge="gymCount ? String(gymCount) : undefined"
          :disabled="!card || !gym || busy"
          @click="enterGym()"
        />
      </div>

      <!-- Success -->
      <div v-if="success" class="card success" role="status">
        <span class="success__icon"><i class="pi pi-check" aria-hidden="true" /></span>
        <div class="success__name">{{ success.name }}</div>
        <div class="success__what">{{ success.what }}</div>
        <span v-if="success.override" class="success__badge">{{ t('checkIn.override') }}</span>
      </div>

      <!-- Client card -->
      <div v-else-if="card" :class="['card', 'client', { 'client--denied': blocking.length }]">
        <div class="client__head">
          <PersonAvatar :name="card.client.name" :image="card.client.photo_url" size="xl" />
          <div class="client__who">
            <div class="client__name">
              <span>{{ card.client.name }}</span>
              <StatusTag :status="card.client.status" />
            </div>
            <div class="client__mid">{{ card.client.member_id }}</div>
            <div class="client__tags">
              <Tag
                v-if="card.alerts.waivers_missing.length"
                severity="warn"
                icon="pi pi-file-edit"
                :value="t('checkIn.waiverMissing')"
              />
              <Tag
                v-if="card.alerts.health_note"
                severity="danger"
                icon="pi pi-heart"
                :value="t('clientHealth.alert')"
              />
              <Tag
                v-if="card.alerts.balance?.overdue"
                severity="danger"
                icon="pi pi-wallet"
                :value="
                  t('clientProfile.alerts.overdue', {
                    amount: format.money(card.alerts.balance.overdue),
                  })
                "
              />
              <Tag
                v-else-if="card.alerts.balance?.owed"
                severity="warn"
                icon="pi pi-wallet"
                :value="t('checkIn.owes', { amount: format.money(card.alerts.balance.owed) })"
              />
              <Tag
                v-if="card.alerts.expiring"
                severity="warn"
                icon="pi pi-clock"
                :value="
                  t('checkIn.expiring', {
                    name: card.alerts.expiring.name,
                    date: format.date(card.alerts.expiring.ends_on),
                  })
                "
              />
            </div>
          </div>
        </div>

        <div v-if="blocking.length" class="denied" role="alert">
          <i class="pi pi-ban" aria-hidden="true" />
          <div class="denied__text">
            <div v-for="d in blocking" :key="d.code">{{ d.message }}</div>
          </div>
          <Button
            v-if="auth.can('attendance.override') && (nextBooking || gym)"
            :label="t('checkIn.allowEntry')"
            icon="pi pi-unlock"
            severity="contrast"
            @click="overriding = true"
          />
        </div>

        <div v-if="card.bookings.length" class="section">
          <div class="section__title">{{ t('checkIn.todaysBookings') }}</div>
          <div v-for="b in card.bookings" :key="b.id" class="row">
            <span class="row__time num"
              >{{ format.time(b.session.starts_at)
              }}<template v-if="b.session.ends_at"
                >–{{ format.time(b.session.ends_at) }}</template
              ></span
            >
            <span class="row__title">{{ b.session.title }}</span>
            <Tag
              v-if="bookingState(b) === 'done'"
              severity="success"
              icon="pi pi-check"
              :value="t('checkIn.checkedIn')"
            />
            <template v-else-if="bookingState(b) === 'early'">
              <span class="muted">{{
                t('checkIn.opensAt', { time: format.time(b.window.opens_at) })
              }}</span>
              <Button size="large" :label="t('checkIn.checkIn')" severity="success" disabled />
            </template>
            <span v-else-if="bookingState(b) === 'late'" class="muted">{{
              t('checkIn.closed')
            }}</span>
            <Button
              v-else
              size="large"
              icon="pi pi-check"
              :label="t('checkIn.checkIn')"
              severity="success"
              :loading="busy"
              :disabled="blocking.length > 0"
              @click="checkInBooking(b.id)"
            />
          </div>
        </div>

        <div v-if="gym" class="section">
          <div class="section__title">{{ t('checkIn.gymFloor') }}</div>
          <div class="row">
            <span class="row__title">
              {{ gym.service.name }}
              <small v-if="gym.entitlement" class="muted"
                >· {{ gym.entitlement.name
                }}<template v-if="gym.entitlement.credits_left !== null">
                  · {{ t('checkIn.creditsLeft', { n: gym.entitlement.credits_left }) }}</template
                ></small
              >
              <small v-else-if="gym.denials.length" class="bad"
                >· {{ gym.denials[gym.denials.length - 1]!.message }}</small
              >
            </span>
            <Button
              size="large"
              icon="pi pi-sign-in"
              :label="t('checkIn.enter')"
              severity="success"
              :loading="busy"
              :disabled="gym.denials.length > 0"
              @click="enterGym()"
            />
          </div>
        </div>

        <div v-if="card.bookable.length && auth.can('bookings.create')" class="section">
          <div class="section__title">{{ t('checkIn.dropIn') }}</div>
          <div v-for="s in card.bookable" :key="s.id" class="row">
            <span class="row__time num">{{ format.time(s.starts_at) }}</span>
            <span class="row__title">
              {{ s.title }}
              <small v-if="s.spots_left !== null" class="muted"
                >· {{ t('checkIn.spotsLeft', { n: s.spots_left }) }}</small
              >
            </span>
            <Button
              size="large"
              icon="pi pi-plus"
              :label="t('checkIn.bookAndCheckIn')"
              severity="secondary"
              :loading="busy"
              :disabled="card.alerts.blocked"
              @click="bookAndCheckIn(s.id)"
            />
          </div>
        </div>

        <EmptyState
          v-if="!card.bookings.length && !gym && !card.bookable.length && !blocking.length"
          compact
          icon="pi-calendar-times"
          :title="t('checkIn.noBookingToday')"
        />
      </div>

      <!-- Search results -->
      <div v-else-if="q.trim()" class="card results">
        <EmptyState
          v-if="!matches.length && !searching"
          compact
          icon="pi-search"
          :title="t('checkIn.noClient')"
          :body="t('checkIn.noClientHint')"
        />
        <button
          v-for="c in matches"
          :key="c.id"
          type="button"
          class="result"
          :disabled="loadingCard"
          @click="pick(c.id)"
        >
          <PersonAvatar :name="c.name" :image="c.photo_url" size="lg" />
          <span class="result__name">
            <strong>{{ c.name }}</strong>
            <small class="muted">{{ c.member_id }}</small>
          </span>
          <StatusTag :status="c.status" size="sm" />
        </button>
      </div>

      <div v-else class="card ready">
        <EmptyState icon="pi-qrcode" :title="t('checkIn.ready')" :body="t('checkIn.readyHint')" />
      </div>
    </div>

    <aside class="card recent">
      <div class="recent__head">
        <span>{{ t('checkIn.recent') }}</span>
        <Button
          v-if="auth.can('attendance.create')"
          :label="t('staffClock.title')"
          icon="pi pi-clock"
          size="small"
          variant="text"
          @click="clocking = true"
        />
      </div>
      <EmptyState v-if="!recent.length" compact icon="pi-history" :title="t('checkIn.noRecent')" />
      <div v-for="r in recent" :key="r.id" :class="['recent__row', { 'is-undone': r.undone_at }]">
        <PersonAvatar :name="r.client?.name ?? '—'" :image="r.client?.photo_url" size="sm" />
        <span class="recent__who">
          <span>{{ r.client?.name }}</span>
          <small class="muted" dir="ltr"
            >{{ format.time(r.checked_in_at) }} · {{ r.session?.title ?? r.service }}</small
          >
        </span>
        <Tag v-if="r.override" class="tag-sm" severity="warn" :value="t('checkIn.override')" />
        <Tag
          v-if="r.undone_at"
          class="tag-sm"
          severity="secondary"
          :value="t('checkIn.undoneTag')"
        />
        <Button
          v-else-if="canUndo(r)"
          size="small"
          variant="text"
          severity="secondary"
          icon="pi pi-replay"
          :label="t('checkIn.undo')"
          @click="undo(r)"
        />
      </div>
    </aside>

    <OverrideDialog
      v-model:visible="overriding"
      :title="t('checkIn.allowEntry')"
      :description="t('checkIn.allowEntryHint')"
      :confirm-label="t('checkIn.allowEntry')"
      @confirm="allowEntry"
    />
    <OverrideDialog
      :visible="!!undoing"
      :title="t('checkIn.undoLate')"
      :description="t('checkIn.undoLateHint')"
      :confirm-label="t('checkIn.undo')"
      destructive
      @update:visible="(v: boolean) => !v && (undoing = null)"
      @confirm="(reason: string) => undoing && undo(undoing, reason)"
    />
    <QrScanDialog v-model:visible="scanning" @scanned="onScanned" />
    <StaffClockDialog v-model:visible="clocking" :location-id="locationId" />
  </div>
</template>

<style scoped>
.desk {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 2 1 560px;
  min-width: 0;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.bar__search {
  flex: 1 1 280px;
}
.bar__search :deep(input) {
  height: 56px;
  font-size: 18px;
}
.bar :deep(.p-button-lg) {
  height: 56px;
}
.success {
  background: var(--sev-success-solid, #16a34a);
  border-color: transparent;
  color: #fff;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.success__icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.success__icon .pi {
  font-size: 32px;
}
.success__name {
  font: var(--text-display, 600 28px var(--font-sans));
}
.success__what {
  font: var(--text-body-lg, 16px var(--font-sans));
}
.success__badge {
  font: 600 12px var(--font-sans);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}
.client {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.client--denied {
  border-color: var(--sev-danger-solid, #dc2626);
  box-shadow: 0 0 0 1px var(--sev-danger-solid, #dc2626);
}
.client__head {
  display: flex;
  gap: 20px;
  align-items: center;
}
.client__who {
  flex: 1;
  min-width: 0;
}
.client__name {
  display: flex;
  gap: 10px;
  align-items: center;
  font: var(--text-h1, 600 24px var(--font-sans));
  flex-wrap: wrap;
}
.client__mid {
  font: 500 14px var(--font-mono);
  color: var(--text-secondary);
  margin-top: 4px;
}
.client__tags {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.denied {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  background: var(--sev-danger-solid, #dc2626);
  color: #fff;
  flex-wrap: wrap;
}
.denied .pi-ban {
  font-size: 24px;
}
.denied__text {
  flex: 1;
  font: 600 18px/1.4 var(--font-sans);
}
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section__title {
  font: var(--text-h4);
  color: var(--text-secondary);
}
.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  flex-wrap: wrap;
}
.row__time {
  font-weight: 600;
}
.row__title {
  flex: 1;
  font: 500 15px var(--font-sans);
  min-width: 160px;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.bad {
  font: var(--text-small);
  color: var(--sev-danger-fg, var(--red-600));
}
.results {
  display: flex;
  flex-direction: column;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
  background: none;
  cursor: pointer;
  min-height: var(--touch-target, 44px);
  text-align: start;
  color: inherit;
  font: inherit;
}
.result:hover {
  background: var(--surface-hover);
}
.result__name {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.ready {
  padding: 64px 24px;
}
.recent {
  flex: 1 1 280px;
}
.recent__head {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-default);
  font: var(--text-h3, 600 16px var(--font-sans));
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.recent__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
}
.recent__row.is-undone {
  opacity: 0.6;
}
.recent__who {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>
