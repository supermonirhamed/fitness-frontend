<script setup lang="ts">
// A class's details and booking it (US-11.09/10): description, coach, branch with a map link,
// duration, level, cancellation policy and places left. The main button follows the booking
// engine's answer — book (with a membership or package, free, or paid at the desk), join the
// waitlist, see what to buy, or the reasons it can't be booked, in plain words. One confirmation
// books; the confirmation screen adds it to the calendar.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { AxiosError } from 'axios'
import Button from 'primevue/button'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ForWhom from '@/components/app/ForWhom.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import { clientApi, type AppSessionDetails, type BookingResult } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'

const { t, locale } = useI18n()
const route = useRoute()
const format = useFormat()
const id = Number(route.params.id)
const session = ref<AppSessionDetails | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const confirmOpen = ref(false)
const choice = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const booked = ref<BookingResult | null>(null)
// Booking for a child (US-11.25): eligibility and payment are the child's.
const forWhom = ref<number | null>(route.query.client_id ? Number(route.query.client_id) : null)
const waitlisted = ref<number | null>(null)

const action = computed(() => session.value?.eligibility.action ?? 'unavailable')
const description = computed(() => {
  const d = session.value?.description
  return d ? (locale.value === 'ar' ? d.ar || d.en : d.en || d.ar) : null
})
/** What can pay: each membership or package, then free or at the desk. */
const payOptions = computed(() => {
  const e = session.value?.eligibility
  if (!e) return []
  const own = e.options.map((o) => ({
    key: `${o.source}:${o.id}`,
    label: o.name,
    hint:
      o.source === 'package' && o.credits_left !== null
        ? t('app.session.creditsLeft', { n: o.credits_left, cost: e.credit_cost ?? 1 })
        : o.ends_on
          ? t('app.home.validUntil', { date: showDay(format, o.ends_on) })
          : null,
  }))
  const other = (['academy', 'complimentary', 'pay_at_desk'] as const)
    .filter((s) => e.entitlements.includes(s))
    .map((s) => ({
      key: `${s}:`,
      label: t(`app.session.sources.${s}`),
      hint:
        s === 'pay_at_desk' && session.value?.price?.amount
          ? format.money(session.value.price.amount)
          : null,
    }))
  return [...own, ...other]
})
const mainLabel = computed(
  () =>
    ({
      booked: t('app.session.booked'),
      waitlisted: t('app.session.waitlisted'),
      book_with_entitlement:
        session.value?.eligibility.options[0]?.source === 'package'
          ? t('app.session.bookWithCredit', { n: session.value?.eligibility.credit_cost ?? 1 })
          : t('app.session.book'),
      book: t('app.session.book'),
      book_pay_at_desk: t('app.session.bookPayAtDesk'),
      join_waitlist: t('app.session.joinWaitlist'),
      buy: t('app.session.buyAndBook'),
      unavailable: t('app.session.unavailable'),
    })[action.value],
)
const policyLine = computed(() => {
  const p = session.value?.policy
  if (!p) return ''
  const penalty =
    p.late_cancel_penalty === 'consume_credit'
      ? t('app.session.policy.credit')
      : p.late_cancel_penalty === 'fixed_fee' && p.late_cancel_fee
        ? t('app.session.policy.fee', { fee: format.money(p.late_cancel_fee) })
        : t('app.session.policy.none')
  return t('app.session.policy.window', { hours: p.cancellation_window_hours }) + ' ' + penalty
})

async function load() {
  state.value = 'loading'
  try {
    session.value = await clientApi.session(id, forWhom.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(forWhom, () => {
  booked.value = null
  waitlisted.value = null
  error.value = null
  load()
})

function main() {
  error.value = null
  if (action.value === 'join_waitlist') return joinWaitlist()
  choice.value = payOptions.value[0]?.key ?? null
  confirmOpen.value = true
}

async function book() {
  busy.value = true
  error.value = null
  try {
    const [source, entitlementId] = (choice.value ?? '').split(':')
    booked.value = await clientApi.book(id, {
      entitlement_source: source || null,
      entitlement_id: entitlementId ? Number(entitlementId) : null,
      client_id: forWhom.value,
    })
    confirmOpen.value = false
  } catch (e) {
    confirmOpen.value = false
    // The last place went meanwhile: say so and offer the waitlist (US-11.10).
    const eligibility = e instanceof AxiosError ? e.response?.data?.eligibility : null
    error.value = firstMessage(e) ?? t('common.genericError')
    await load()
    if (eligibility?.can_waitlist) error.value = t('app.session.justFilled')
  } finally {
    busy.value = false
  }
}

async function joinWaitlist() {
  busy.value = true
  try {
    waitlisted.value = (await clientApi.joinWaitlist(id, forWhom.value)).position
    await load()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.schedule' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.nav.schedule') }}</RouterLink
    >
    <template v-if="state === 'loading'">
      <div class="ca-card"><Skeleton height="140px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />

    <!-- Booked: the confirmation screen (US-11.10). -->
    <div v-else-if="booked" class="ca-card done">
      <span class="done__icon"><i class="pi pi-check" aria-hidden="true" /></span>
      <h1 class="ca-title">{{ t('app.session.confirmed') }}</h1>
      <p>{{ booked.session.service }}</p>
      <p class="ca-muted">
        {{ showDay(format, booked.session.date) }} · {{ booked.session.time }} ·
        {{ booked.session.location }}
      </p>
      <Message
        v-if="booked.entitlement_source === 'pay_at_desk'"
        severity="info"
        :closable="false"
        >{{
          booked.payment.due
            ? t('app.session.payAtDeskAmount', { amount: format.money(booked.payment.due) })
            : t('app.session.payAtDesk')
        }}</Message
      >
      <a :href="clientApi.calendarUrl(booked.id)" class="p-button p-button-outlined calendar">
        <i class="pi pi-calendar-plus" aria-hidden="true" /> {{ t('app.session.addToCalendar') }}
      </a>
      <RouterLink :to="{ name: 'app.home' }">{{ t('app.session.backHome') }}</RouterLink>
    </div>

    <template v-else-if="session">
      <div class="ca-card head">
        <span class="stripe" :style="{ background: session.service.color ?? 'var(--primary)' }" />
        <p class="ca-muted ca-small">{{ session.service.category }}</p>
        <h1 class="ca-title">{{ session.service.name }}</h1>
        <p class="when">
          <i class="pi pi-clock" aria-hidden="true" />
          {{ showDay(format, session.date) }} · {{ session.time }} ·
          {{ t('app.schedule.minutes', { n: session.duration }) }}
        </p>
        <p v-if="session.coach">
          <i class="pi pi-user" aria-hidden="true" />
          <RouterLink :to="{ name: 'app.coach', params: { id: session.coach.id } }">{{
            session.coach.name
          }}</RouterLink>
        </p>
        <p>
          <i class="pi pi-map-marker" aria-hidden="true" />
          {{ [session.location.name, session.facility].filter(Boolean).join(' · ') }}
          <a
            v-if="session.location.map_url"
            :href="session.location.map_url"
            target="_blank"
            rel="noopener"
            class="ca-small"
            >{{ t('app.session.map') }}</a
          >
        </p>
        <div class="ca-row tags">
          <Tag
            v-if="session.service.skill_level !== 'All'"
            severity="secondary"
            :value="t(`app.levels.${session.service.skill_level}`)"
          />
          <Tag
            v-if="session.spots_left !== null"
            :severity="
              session.spots_left === 0
                ? 'danger'
                : session.state === 'almost'
                  ? 'warn'
                  : 'secondary'
            "
            :value="
              session.spots_left === 0
                ? t('app.schedule.full')
                : t('app.schedule.spotsLeft', { n: session.spots_left }, session.spots_left)
            "
          />
          <Tag
            v-if="session.price?.kind === 'included'"
            severity="success"
            :value="t('app.price.included')"
          />
          <Tag
            v-else-if="session.price?.kind === 'drop_in'"
            severity="secondary"
            :value="format.money(session.price.amount ?? 0)"
          />
        </div>
      </div>

      <Message v-if="error" severity="warn" :closable="false">{{ error }}</Message>
      <Message
        v-if="waitlisted !== null || action === 'waitlisted'"
        severity="info"
        :closable="false"
        >{{
          t('app.session.onWaitlist', { n: waitlisted ?? session.mine?.position ?? '—' })
        }}</Message
      >
      <Message
        v-for="r in action === 'unavailable' || action === 'buy' ? session.eligibility.reasons : []"
        :key="r.code"
        severity="secondary"
        :closable="false"
        icon="pi pi-info-circle"
        ><span class="ca-spread"
          >{{ r.message }}
          <RouterLink
            v-if="r.code === 'waiver_missing'"
            :to="{ name: 'app.waivers', query: { redirect: route.fullPath } }"
            class="ca-small"
            >{{ t('app.waivers.signNow') }}</RouterLink
          ></span
        ></Message
      >

      <ForWhom v-model="forWhom" />
      <div class="cta">
        <Button
          v-if="action !== 'buy'"
          :label="mainLabel"
          :icon="
            action === 'booked'
              ? 'pi pi-check'
              : action === 'join_waitlist'
                ? 'pi pi-users'
                : 'pi pi-calendar-plus'
          "
          :disabled="['booked', 'waitlisted', 'unavailable'].includes(action)"
          :loading="busy"
          size="large"
          fluid
          @click="main"
        />
        <a
          v-if="action === 'booked' && session.mine?.booking_id"
          :href="clientApi.calendarUrl(session.mine.booking_id)"
          class="ca-small center"
          >{{ t('app.session.addToCalendar') }}</a
        >
        <p v-if="action === 'join_waitlist'" class="ca-muted ca-small">
          {{
            session.policy.waitlist_mode === 'automatic'
              ? t('app.session.waitlistAuto')
              : t('app.session.waitlistManual')
          }}
        </p>
      </div>

      <section v-if="action === 'buy' && session.products.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.session.coveredBy') }}</h2>
        <ul class="ca-list">
          <li v-for="p in session.products" :key="p.id" class="ca-spread product">
            <span
              ><Tag v-if="p.intro_offer" severity="success" :value="t('app.home.offer')" />
              {{ p.name }}</span
            >
            <span class="ca-row">
              <strong v-if="p.price !== null" class="ca-num">{{
                p.price === 0 ? t('app.price.free') : format.money(p.price)
              }}</strong>
              <RouterLink :to="{ name: 'app.checkout', params: { id: p.id } }" class="ca-small">{{
                t('app.shop.buy')
              }}</RouterLink>
            </span>
          </li>
        </ul>
        <p class="ca-muted ca-small">{{ t('app.session.buyThenBook') }}</p>
      </section>

      <section v-if="description || session.equipment_notes" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.session.about') }}</h2>
        <p v-if="description" class="pre">{{ description }}</p>
        <p v-if="session.equipment_notes" class="ca-muted ca-small pre">
          <i class="pi pi-briefcase" aria-hidden="true" /> {{ session.equipment_notes }}
        </p>
      </section>
      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.session.cancellation') }}</h2>
        <p class="ca-small">{{ policyLine }}</p>
      </section>
    </template>

    <FormDialog
      v-model:visible="confirmOpen"
      :title="t('app.session.confirmTitle')"
      :subtitle="
        session ? `${session.service.name} · ${showDay(format, session.date)} ${session.time}` : ''
      "
      :save-label="t('app.session.confirm')"
      :saving="busy"
      @save="book"
    >
      <p v-if="payOptions.length > 1" class="ca-small">{{ t('app.session.payWith') }}</p>
      <div v-for="o in payOptions" :key="o.key" class="ca-row option">
        <RadioButton
          v-if="payOptions.length > 1"
          v-model="choice"
          :value="o.key"
          :input-id="`pay-${o.key}`"
        />
        <label :for="`pay-${o.key}`">
          <strong>{{ o.label }}</strong>
          <span v-if="o.hint" class="ca-muted ca-small"> · {{ o.hint }}</span>
        </label>
      </div>
      <p class="ca-muted ca-small">{{ policyLine }}</p>
    </FormDialog>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.head {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head p {
  margin: 0;
}
.head i {
  color: var(--text-muted);
  margin-inline-end: 6px;
}
.stripe {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}
.tags {
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.cta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.center {
  text-align: center;
}
.product {
  padding: 10px 0;
}
.pre {
  white-space: pre-line;
}
.option {
  padding: 6px 0;
}
.done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.done p {
  margin: 0;
}
.done__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
  font-size: 24px;
}
.calendar {
  text-decoration: none;
  gap: 8px;
}
</style>
