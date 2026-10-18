<script setup lang="ts">
// The client app's home (US-11.07): the next booking with the check-in QR once check-in opens,
// memberships and credits, alerts (ending soon, money owed, waivers to sign), "book again", each
// child's next training for parents, and for new clients the intro offers and "Explore classes".
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppBooking, type AppHome } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const format = useFormat()
const app = useClientApp()
const home = ref<AppHome | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const qrOpen = ref(false)
const day = (ymd: string) => showDay(format, ymd)
const isNew = computed(
  () => !!home.value && !home.value.next_booking && !home.value.entitlements.length,
)
const hasAlerts = computed(
  () =>
    !!home.value &&
    (home.value.alerts.expiring.length > 0 ||
      !!home.value.alerts.balance ||
      home.value.alerts.waivers.length > 0),
)
const when = (b: AppBooking) => `${day(b.session.date)} · ${b.session.time}`

async function load() {
  state.value = 'loading'
  try {
    home.value = await clientApi.home()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.home.hello', { name: app.firstName }) }}</h1>
    <template v-if="state === 'loading'">
      <div class="ca-card"><Skeleton height="96px" /></div>
      <div class="ca-card"><Skeleton height="64px" /></div>
    </template>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="home">
      <section v-if="home.next_booking" class="ca-card next">
        <p class="ca-muted ca-small">{{ t('app.home.next') }}</p>
        <div class="ca-spread">
          <div>
            <h2 class="ca-subtitle">{{ home.next_booking.session.service }}</h2>
            <p class="ca-small">{{ when(home.next_booking) }}</p>
            <p class="ca-muted ca-small">
              {{
                [home.next_booking.session.location, home.next_booking.session.coach]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </p>
          </div>
          <Button
            v-if="home.next_booking.check_in_open"
            icon="pi pi-qrcode"
            :label="t('app.home.checkIn')"
            @click="qrOpen = true"
          />
        </div>
        <div class="ca-row actions">
          <RouterLink
            :to="{ name: 'app.session', params: { id: home.next_booking.session.id } }"
            class="ca-small"
            >{{ t('app.home.details') }}</RouterLink
          >
          <a :href="clientApi.calendarUrl(home.next_booking.id)" class="ca-small">{{
            t('app.session.addToCalendar')
          }}</a>
        </div>
      </section>

      <section v-if="hasAlerts" class="ca-stack alerts">
        <Message
          v-for="e in home.alerts.expiring"
          :key="`exp-${e.id}`"
          severity="warn"
          :closable="false"
          icon="pi pi-clock"
          >{{ t('app.home.expiring', { name: e.name, date: day(e.ends_on) }) }}</Message
        >
        <Message
          v-if="home.alerts.balance"
          severity="error"
          :closable="false"
          icon="pi pi-wallet"
          >{{ t('app.home.owed', { amount: format.money(home.alerts.balance.owed) }) }}</Message
        >
        <Message
          v-for="w in home.alerts.waivers"
          :key="`w-${w.id}`"
          severity="info"
          :closable="false"
          icon="pi pi-file-edit"
          >{{ t('app.home.waiver', { name: w.name }) }}</Message
        >
      </section>

      <section v-if="home.entitlements.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.home.memberships') }}</h2>
        <ul class="ca-list">
          <li v-for="e in home.entitlements" :key="e.id" class="entitlement">
            <div class="ca-spread">
              <strong>{{ e.name }}</strong>
              <Tag
                :severity="e.status === 'Active' ? 'success' : 'secondary'"
                :value="t(`app.status.${e.status}`, e.status)"
              />
            </div>
            <template v-if="e.credits_total">
              <ProgressBar
                :value="Math.round(((e.credits_left ?? 0) / e.credits_total) * 100)"
                :show-value="false"
                class="bar"
              />
              <span class="ca-small">{{
                t('app.home.credits', { left: e.credits_left, total: e.credits_total })
              }}</span>
            </template>
            <span v-if="e.ends_on" class="ca-muted ca-small">{{
              t('app.home.validUntil', { date: day(e.ends_on) })
            }}</span>
            <span v-if="e.shared_by" class="ca-muted ca-small">{{
              t('app.home.sharedBy', { name: e.shared_by })
            }}</span>
          </li>
        </ul>
      </section>

      <section v-if="home.children.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.home.children') }}</h2>
        <ul class="ca-list">
          <li v-for="c in home.children" :key="c.id" class="child">
            <strong>{{ c.first_name }}</strong>
            <span v-if="c.next_booking" class="ca-small"
              >{{ c.next_booking.session.service }} · {{ when(c.next_booking) }}</span
            >
            <span v-else class="ca-muted ca-small">{{ t('app.home.noTraining') }}</span>
          </li>
        </ul>
      </section>

      <section v-if="home.book_again.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.home.bookAgain') }}</h2>
        <div class="chips">
          <RouterLink
            v-for="s in home.book_again"
            :key="s.service_id"
            :to="{ name: 'app.schedule', query: { service_id: s.service_id } }"
            class="chip"
            ><i class="pi pi-replay" aria-hidden="true" />{{ s.name }}</RouterLink
          >
        </div>
      </section>

      <section v-if="isNew" class="ca-card">
        <EmptyState
          icon="pi-sparkles"
          :title="t('app.home.welcome')"
          :body="t('app.home.welcomeBody')"
        >
          <RouterLink :to="{ name: 'app.schedule' }" custom v-slot="{ navigate }">
            <Button :label="t('app.home.explore')" icon="pi pi-calendar" @click="navigate" />
          </RouterLink>
        </EmptyState>
        <ul v-if="home.offers.length" class="ca-list offers">
          <li v-for="o in home.offers" :key="o.id" class="ca-spread">
            <span><Tag severity="success" :value="t('app.home.offer')" /> {{ o.name }}</span>
            <span class="ca-row">
              <strong v-if="o.price !== null" class="ca-num">{{
                o.price === 0 ? t('app.price.free') : format.money(o.price)
              }}</strong>
              <RouterLink :to="{ name: 'app.checkout', params: { id: o.id } }" class="ca-small">{{
                t('app.shop.buy')
              }}</RouterLink>
            </span>
          </li>
        </ul>
      </section>
      <RouterLink v-else :to="{ name: 'app.schedule' }" custom v-slot="{ navigate }">
        <Button
          :label="t('app.home.explore')"
          icon="pi pi-calendar"
          variant="outlined"
          fluid
          @click="navigate"
        />
      </RouterLink>
    </template>

    <Dialog
      v-model:visible="qrOpen"
      modal
      :header="t('app.home.checkIn')"
      :style="{ width: 'min(92vw, 360px)' }"
    >
      <div class="qr">
        <img :src="clientApi.qrUrl()" :alt="t('app.home.qrAlt')" />
        <p class="ca-muted ca-small">{{ t('app.home.qrHint') }}</p>
        <p class="ca-num">{{ home?.client.member_id }}</p>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.next {
  border-inline-start: 4px solid var(--primary);
}
.actions {
  margin-top: 8px;
  gap: 16px;
}
.alerts {
  gap: 8px;
}
.entitlement,
.child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
}
.bar {
  height: 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.875rem;
}
.offers li {
  padding: 10px 0;
}
.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.qr img {
  width: 240px;
  height: 240px;
}
</style>
