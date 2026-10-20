<script setup lang="ts">
// The client app's home (US-11.07): the next booking with the check-in QR once check-in opens,
// memberships and credits, alerts (ending soon, money owed, waivers to sign), "book again", each
// child's next training for parents, and for new clients the intro offers and "Explore classes".
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import MemberQrDialog from '@/components/app/MemberQrDialog.vue'
import QrScanDialog from '@/components/checkin/QrScanDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppBooking, type AppHome } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const format = useFormat()
const app = useClientApp()
const home = ref<AppHome | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const qrOpen = ref(false)
const router = useRouter()
const toast = useToast()
// Scanning the branch's check-in QR opens its check-in page (US-11.23).
const scanning = ref(false)
function onScanned(code: string) {
  const token = /\/app\/check-in\/([A-Za-z0-9]{40})/.exec(code)?.[1]
  if (token) router.push({ name: 'app.checkin', params: { token } })
  else toast.add({ severity: 'warn', summary: t('app.checkIn.notBranchCode'), life: 4000 })
}
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

// Academy offers (US-11.26): a place from the waiting list, or next term.
const answering = ref<string | null>(null)
async function answer(kind: 'w' | 'r', id: number, accept: boolean) {
  answering.value = `${kind}-${id}`
  try {
    if (kind === 'w') await clientApi.academy.answerWaitlistOffer(id, accept)
    else await clientApi.academy.answerReenrollment(id, accept)
    toast.add({
      severity: 'success',
      summary: accept ? t('app.academy.accepted') : t('app.academy.declined'),
      life: 3000,
    })
    await load()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    answering.value = null
  }
}

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
    <div class="ca-spread">
      <h1 class="ca-title">{{ t('app.home.hello', { name: app.firstName }) }}</h1>
      <span class="ca-row">
        <Button
          icon="pi pi-camera"
          variant="text"
          rounded
          :aria-label="t('app.checkIn.scan')"
          v-tooltip.bottom="t('app.checkIn.scan')"
          @click="scanning = true"
        />
        <Button
          icon="pi pi-qrcode"
          variant="outlined"
          rounded
          :aria-label="t('app.qr.title')"
          v-tooltip.bottom="t('app.qr.title')"
          @click="qrOpen = true"
        />
      </span>
    </div>
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
          :key="`w-${w.id}-${w.client_id}`"
          severity="info"
          :closable="false"
          icon="pi pi-file-edit"
          ><span class="ca-spread grow"
            >{{
              w.for
                ? t('app.home.waiverFor', { name: w.name, child: w.for })
                : t('app.home.waiver', { name: w.name })
            }}
            <RouterLink
              :to="{
                name: 'app.waiver',
                params: { id: w.id },
                query: w.for ? { client_id: w.client_id } : {},
              }"
              class="ca-small"
              >{{ t('app.waivers.sign') }}</RouterLink
            ></span
          ></Message
        >
      </section>

      <section
        v-if="home.academy_offers.waitlist.length || home.academy_offers.reenrollment.length"
        class="ca-card"
      >
        <h2 class="ca-subtitle">{{ t('app.academy.offers') }}</h2>
        <ul class="ca-list">
          <li v-for="o in home.academy_offers.waitlist" :key="`w-${o.id}`" class="offer">
            <span
              >{{ t('app.academy.waitlistOffer', { name: o.client.first_name, group: o.group }) }}
              <span class="ca-muted ca-small block">{{
                t('app.academy.until', { date: format.dateTime(o.expires_at) })
              }}</span></span
            >
            <span class="ca-row">
              <Button
                :label="t('app.academy.accept')"
                size="small"
                :loading="answering === `w-${o.id}`"
                @click="answer('w', o.id, true)"
              />
              <Button
                :label="t('app.academy.decline')"
                size="small"
                variant="text"
                severity="secondary"
                @click="answer('w', o.id, false)"
              />
            </span>
          </li>
          <li v-for="o in home.academy_offers.reenrollment" :key="`r-${o.id}`" class="offer">
            <span
              >{{
                t('app.academy.reenrollOffer', {
                  name: o.client.first_name,
                  group: o.group,
                  term: o.term,
                })
              }}
              <span class="ca-muted ca-small block">{{
                t('app.academy.until', { date: day(o.deadline) })
              }}</span></span
            >
            <span class="ca-row">
              <Button
                :label="t('app.academy.accept')"
                size="small"
                :loading="answering === `r-${o.id}`"
                @click="answer('r', o.id, true)"
              />
              <Button
                :label="t('app.academy.decline')"
                size="small"
                variant="text"
                severity="secondary"
                @click="answer('r', o.id, false)"
              />
            </span>
          </li>
        </ul>
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
            <RouterLink :to="{ name: 'app.child', params: { id: c.id } }"
              ><strong>{{ c.first_name }}</strong></RouterLink
            >
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

    <MemberQrDialog v-model:visible="qrOpen" :member-id="home?.client.member_id" />
    <QrScanDialog v-model:visible="scanning" @scanned="onScanned" />
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
.grow {
  flex: 1;
}
.offer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
}
.block {
  display: block;
}
</style>
