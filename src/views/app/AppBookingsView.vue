<script setup lang="ts">
// My bookings (US-11.15–11.17): upcoming (with waitlist places) and past; for parents, a switch
// to each child. Upcoming ones can be cancelled — the outcome under the policy is said first —
// moved to another session of the same class, or added to a calendar. Waitlist places show their
// position and can be left.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import MemberQrDialog from '@/components/app/MemberQrDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  clientApi,
  type CancelTerms,
  type MyBooking,
  type MyWaitlistEntry,
  type SessionBrief,
} from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const app = useClientApp()
const scope = ref<'upcoming' | 'past'>('upcoming')
const who = ref<number | null>(null)
const children = ref<{ id: number; first_name: string }[]>([])
const bookings = ref<MyBooking[]>([])
const waitlist = ref<MyWaitlistEntry[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const qrOpen = ref(false)
const day = (ymd: string) => showDay(format, ymd)
const people = computed(() => [
  { value: null, label: t('app.bookings.me') },
  ...children.value.map((c) => ({ value: c.id, label: c.first_name })),
])

async function load() {
  state.value = 'loading'
  try {
    const res = await clientApi.bookings.list(scope.value, who.value)
    bookings.value = res.bookings
    waitlist.value = res.waitlist
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  if (app.account?.is_guardian)
    children.value = (await clientApi.home().catch(() => null))?.children ?? []
  load()
})
watch([scope, who], load)

// Cancelling (US-11.16): the outcome first.
const cancelling = ref<MyBooking | null>(null)
const terms = ref<CancelTerms | null>(null)
const busy = ref(false)
async function askCancel(b: MyBooking) {
  cancelling.value = b
  terms.value = await clientApi.bookings.cancelTerms(b.id).catch(() => null)
}
const outcome = computed(() => {
  const x = terms.value
  if (!x) return ''
  if (x.outcome === 'fee' && x.fee)
    return t('app.bookings.outcome.fee', { fee: format.money(x.fee) })
  return t(`app.bookings.outcome.${x.outcome}`)
})
async function cancel() {
  if (!cancelling.value) return
  busy.value = true
  try {
    await clientApi.bookings.cancel(cancelling.value.id)
    toast.add({ severity: 'success', summary: t('app.bookings.cancelled'), life: 3000 })
    cancelling.value = null
    load()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

// Moving to another session of the same class.
const moving = ref<MyBooking | null>(null)
const options = ref<SessionBrief[] | null>(null)
async function askMove(b: MyBooking) {
  moving.value = b
  options.value = null
  options.value = await clientApi.bookings.rescheduleOptions(b.id).catch(() => [])
}
async function move(target: SessionBrief) {
  if (!moving.value) return
  busy.value = true
  try {
    await clientApi.bookings.reschedule(moving.value.id, target.id)
    toast.add({
      severity: 'success',
      summary: t('app.bookings.moved', { date: `${day(target.date)} ${target.time}` }),
      life: 3000,
    })
    moving.value = null
    load()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}

async function leave(w: MyWaitlistEntry) {
  await clientApi.waitlist.leave(w.id).catch(() => null)
  load()
}
const google = (b: MyBooking) =>
  clientApi.googleCalendarUrl({
    title: b.session.service,
    starts_at: b.session.starts_at,
    location: b.session.location,
  })
const sourceLabel = (b: MyBooking) =>
  b.credits_used
    ? t('app.bookings.credits', { n: b.credits_used })
    : t(`app.bookings.sources.${b.entitlement_source}`, b.entitlement_source)
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.bookings.title') }}</h1>
    <SelectButton
      v-model="scope"
      :options="[
        { value: 'upcoming', label: t('app.bookings.upcoming') },
        { value: 'past', label: t('app.bookings.past') },
      ]"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      fluid
    />
    <SelectButton
      v-if="children.length"
      v-model="who"
      :options="people"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      :aria-label="t('app.bookings.forWhom')"
    />

    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="64px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else>
      <section v-if="waitlist.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.bookings.waitlist') }}</h2>
        <ul class="ca-list">
          <li v-for="w in waitlist" :key="w.id" class="ca-spread item">
            <div>
              <strong>{{ w.session.service }}</strong>
              <div class="ca-muted ca-small">
                {{ day(w.session.date) }} · {{ w.session.time }} · {{ w.session.location }}
              </div>
            </div>
            <div class="ca-row">
              <Tag severity="info" :value="t('app.schedule.waitlisted', { n: w.position })" />
              <Button
                :label="t('app.bookings.leave')"
                variant="text"
                size="small"
                severity="secondary"
                @click="leave(w)"
              />
            </div>
          </li>
        </ul>
      </section>

      <div v-if="!bookings.length" class="ca-card">
        <EmptyState
          compact
          icon="pi-calendar"
          :title="
            scope === 'upcoming' ? t('app.bookings.noneUpcoming') : t('app.bookings.nonePast')
          "
        >
          <RouterLink v-if="scope === 'upcoming'" :to="{ name: 'app.schedule' }">{{
            t('app.home.explore')
          }}</RouterLink>
        </EmptyState>
      </div>
      <ul v-else class="ca-stack plain">
        <li v-for="b in bookings" :key="b.id" class="ca-card booking">
          <div class="ca-spread">
            <div>
              <strong>{{ b.session.service }}</strong>
              <div class="ca-small">{{ day(b.session.date) }} · {{ b.session.time }}</div>
              <div class="ca-muted ca-small">
                {{
                  [b.session.location, b.session.facility, b.session.coach]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </div>
            </div>
            <StatusTag :status="b.status" size="sm" />
          </div>
          <div class="ca-muted ca-small">{{ sourceLabel(b) }}</div>
          <Message v-if="b.status === 'CancelledByBusiness'" severity="warn" :closable="false">
            {{ t('app.bookings.businessCancelled', { reason: b.cancel_reason ?? '—' }) }}
          </Message>
          <Message v-else-if="b.penalty" severity="secondary" :closable="false">
            {{
              b.penalty === 'fixed_fee' && b.penalty_fee
                ? t('app.bookings.outcome.fee', { fee: format.money(b.penalty_fee) })
                : t('app.bookings.outcome.credit_used')
            }}
          </Message>
          <div v-if="scope === 'upcoming'" class="ca-row actions">
            <Button
              v-if="b.can_change"
              :label="t('app.bookings.cancel')"
              severity="danger"
              variant="text"
              size="small"
              @click="askCancel(b)"
            />
            <Button
              v-if="b.can_change"
              :label="t('app.bookings.reschedule')"
              variant="text"
              size="small"
              @click="askMove(b)"
            />
            <Button
              v-if="who === null && b.status === 'Confirmed'"
              icon="pi pi-qrcode"
              :label="t('app.qr.title')"
              variant="text"
              size="small"
              @click="qrOpen = true"
            />
            <a :href="clientApi.calendarUrl(b.id)" class="ca-small">{{
              t('app.session.addToCalendar')
            }}</a>
            <a :href="google(b)" target="_blank" rel="noopener" class="ca-small">Google</a>
          </div>
        </li>
      </ul>
    </template>

    <MemberQrDialog v-model:visible="qrOpen" />
    <FormDialog
      :visible="!!cancelling"
      :title="t('app.bookings.cancelTitle')"
      :subtitle="
        cancelling
          ? `${cancelling.session.service} · ${day(cancelling.session.date)} ${cancelling.session.time}`
          : ''
      "
      :save-label="t('app.bookings.confirmCancel')"
      :saving="busy"
      danger
      @update:visible="(v: boolean) => !v && (cancelling = null)"
      @save="cancel"
    >
      <Skeleton v-if="!terms" height="40px" />
      <Message v-else :severity="terms.late ? 'warn' : 'success'" :closable="false">{{
        outcome
      }}</Message>
    </FormDialog>

    <Drawer
      :visible="!!moving"
      position="bottom"
      :header="t('app.bookings.rescheduleTitle')"
      class="move"
      @update:visible="(v: boolean) => !v && (moving = null)"
    >
      <Skeleton v-if="options === null" height="80px" />
      <EmptyState
        v-else-if="!options.length"
        compact
        icon="pi-calendar"
        :title="t('app.bookings.noOptions')"
      />
      <ul v-else class="ca-list">
        <li v-for="o in options" :key="o.id" class="ca-spread item">
          <span>
            <strong>{{ day(o.date) }} · {{ o.time }}</strong>
            <span class="ca-muted ca-small">
              {{ [o.location, o.coach].filter(Boolean).join(' · ') }}</span
            >
          </span>
          <Button
            :label="t('app.bookings.moveHere')"
            size="small"
            :loading="busy"
            @click="move(o)"
          />
        </li>
      </ul>
    </Drawer>
  </div>
</template>

<style scoped>
.plain {
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}
.booking {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  padding: 10px 0;
}
.actions {
  flex-wrap: wrap;
  gap: 4px 12px;
}
.move {
  max-height: 80dvh;
}
</style>
