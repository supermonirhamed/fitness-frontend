<script setup lang="ts">
// The in-app inbox (US-11.20): bookings, waitlist, payments, memberships and academy messages,
// newest first, unread marked; messages about a child say whose. A place that opened on a manual
// waitlist can be claimed from here (US-04.12). Web push can be turned on when the organization
// has it set up.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type InboxItem } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t, te } = useI18n()
const toast = useToast()
const format = useFormat()
const app = useClientApp()
const items = ref<InboxItem[]>([])
const pushKey = ref<string | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const claimed = ref<Set<number>>(new Set())
const icons: Record<string, string> = {
  booking_confirmed: 'pi-check-circle',
  booking_cancelled: 'pi-times-circle',
  booking_rescheduled: 'pi-arrow-right-arrow-left',
  session_cancelled: 'pi-ban',
  session_changed: 'pi-clock',
  coach_changed: 'pi-user',
  waitlist_promoted: 'pi-check-circle',
  spot_opened: 'pi-bolt',
  waitlist_expired: 'pi-hourglass',
  membership_expiring: 'pi-exclamation-triangle',
  membership_bought: 'pi-shopping-bag',
  membership_renewed: 'pi-refresh',
  payment_reminder: 'pi-wallet',
  event_registered: 'pi-star',
  coach_note: 'pi-comment',
  evaluation_published: 'pi-chart-line',
  announcement: 'pi-megaphone',
}

function text(n: InboxItem): string {
  const d = n.data as Record<string, string | number | null>
  const params = {
    ...d,
    when: d.date ? `${showDay(format, String(d.date))} ${d.time ?? ''}`.trim() : '',
    total: typeof d.total === 'number' ? format.money(d.total) : '',
    ends: d.ends_on ? showDay(format, String(d.ends_on)) : '',
  }
  return te(`app.inbox.kinds.${n.kind}`) ? t(`app.inbox.kinds.${n.kind}`, params) : n.kind
}

async function load() {
  state.value = 'loading'
  try {
    const res = await clientApi.inbox.list()
    items.value = res.data
    pushKey.value = res.meta.push_key
    state.value = 'ready'
    if (res.meta.unread) app.unread = await clientApi.inbox.read().catch(() => app.unread)
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function claim(n: InboxItem) {
  try {
    await clientApi.waitlist.claim(Number((n.data as { entry_id: number }).entry_id))
    claimed.value.add(n.id)
    toast.add({ severity: 'success', summary: t('app.inbox.claimed'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'warn',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 5000,
    })
  }
}

// Web push (installed app): the browser subscribes with the organization's key; EP-12 sends.
const canPush =
  typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator
async function enablePush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const key = Uint8Array.from(atob(pushKey.value!.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    )
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
    await clientApi.inbox.subscribe(sub.toJSON())
    toast.add({ severity: 'success', summary: t('app.inbox.pushOn'), life: 3000 })
  } catch {
    toast.add({ severity: 'warn', summary: t('app.inbox.pushFailed'), life: 4000 })
  }
}
</script>

<template>
  <div class="ca-stack">
    <div class="ca-spread">
      <h1 class="ca-title">{{ t('app.nav.inbox') }}</h1>
      <Button
        v-if="pushKey && canPush"
        :label="t('app.inbox.enablePush')"
        icon="pi pi-bell"
        variant="text"
        size="small"
        @click="enablePush"
      />
    </div>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="100px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="!items.length" class="ca-card">
      <EmptyState compact icon="pi-inbox" :title="t('app.inbox.none')" />
    </div>
    <ul v-else class="ca-card ca-list">
      <li v-for="n in items" :key="n.id" class="item" :class="{ unread: !n.read }">
        <i :class="['pi', icons[n.kind] ?? 'pi-info-circle']" aria-hidden="true" />
        <div class="body">
          <span v-if="n.about" class="ca-muted ca-small">{{
            t('app.inbox.about', { name: n.about })
          }}</span>
          <span>{{ text(n) }}</span>
          <span class="ca-muted ca-small">{{ n.at ? format.dateTime(n.at) : '' }}</span>
          <Button
            v-if="n.kind === 'spot_opened' && !claimed.has(n.id)"
            :label="t('app.inbox.claim')"
            size="small"
            class="claim"
            @click="claim(n)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}
.item > i {
  margin-top: 3px;
  color: var(--text-muted);
}
.unread > i {
  color: var(--primary);
}
.unread .body > span:nth-last-of-type(2) {
  font-weight: 600;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.claim {
  align-self: flex-start;
  margin-top: 6px;
}
</style>
