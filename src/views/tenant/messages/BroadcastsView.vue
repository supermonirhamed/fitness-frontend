<script setup lang="ts">
// Messages (US-12.13): the messages staff sent to groups of clients, newest first, with whom they
// reached on each channel; scheduled ones can be cancelled until they go out. Coaches see their own.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import BroadcastDrawer from '@/components/messages/BroadcastDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { tenantApi, type Broadcast } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { firstMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'

const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const items = ref<Broadcast[]>([])
const total = ref(0)
const page = ref(1)
const drawer = ref(false)
const severities: Record<Broadcast['status'], 'info' | 'success' | 'secondary' | 'warn'> = {
  Scheduled: 'info',
  Sending: 'warn',
  Sent: 'success',
  Cancelled: 'secondary',
}

async function load() {
  state.value = 'loading'
  try {
    const res = await tenantApi.broadcasts.list(page.value)
    items.value = res.data
    total.value = res.meta.total
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function subject(b: Broadcast): string {
  const c = b.content.ar ?? b.content.en
  return c?.subject || (c?.body ?? '').slice(0, 80)
}
function reached(b: Broadcast): string {
  return Object.entries(b.counts ?? {})
    .map(([c, n]) => `${t(`notificationSettings.channels.${c}`)} ${n?.queued ?? 0}`)
    .join(' · ')
}
async function cancel(b: Broadcast) {
  try {
    const updated = await tenantApi.broadcasts.cancel(b.id)
    items.value = items.value.map((x) => (x.id === b.id ? updated : x))
    toast.add({ severity: 'success', summary: t('broadcasts.cancelled'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'warn',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('broadcasts.title')" :subtitle="t('broadcasts.subtitle')">
      <template #actions>
        <Button :label="t('broadcasts.new')" icon="pi pi-send" @click="drawer = true" />
      </template>
    </PageHeader>
    <div v-if="state === 'loading'" class="card"><Skeleton height="120px" /></div>
    <div v-else-if="state === 'forbidden'" class="card"><NoPermission /></div>
    <ErrorState v-else-if="state === 'error'" :title="t('broadcasts.loadError')" @retry="load" />
    <div v-else-if="!items.length" class="card">
      <EmptyState icon="pi-send" :title="t('broadcasts.none')" :body="t('broadcasts.noneHelp')" />
    </div>
    <div v-else class="card">
      <ul class="list">
        <li v-for="b in items" :key="b.id">
          <div class="main">
            <strong>{{ subject(b) }}</strong>
            <span class="muted small">
              {{ t(`broadcasts.audiences.${b.audience.type}`) }} ·
              {{ b.channels.map((c) => t(`notificationSettings.channels.${c}`)).join(', ') }} ·
              {{ b.author ?? '—' }}
            </span>
            <span class="muted small">
              <template v-if="b.status === 'Sent'"
                >{{ t('broadcasts.sentAt', { at: format.dateTime(b.sent_at!) }) }} ·
                {{ t('broadcasts.recipients', { n: b.recipients }) }}
                <template v-if="reached(b)"> · {{ reached(b) }}</template></template
              >
              <template v-else-if="b.status === 'Scheduled'">{{
                t('broadcasts.scheduledFor', { at: format.dateTime(b.scheduled_at!) })
              }}</template>
            </span>
          </div>
          <div class="side">
            <Tag
              v-if="b.purpose === 'marketing'"
              severity="secondary"
              :value="t('broadcasts.marketing')"
            />
            <Tag :severity="severities[b.status]" :value="t(`broadcasts.statuses.${b.status}`)" />
            <Button
              v-if="b.status === 'Scheduled'"
              :label="t('common.cancel')"
              severity="secondary"
              variant="text"
              size="small"
              @click="cancel(b)"
            />
          </div>
        </li>
      </ul>
      <Paginator
        v-if="total > 25"
        :rows="25"
        :total-records="total"
        :first="(page - 1) * 25"
        @page="(e) => ((page = e.page + 1), load())"
      />
    </div>
    <BroadcastDrawer v-model:visible="drawer" @sent="load" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 8px 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.list li:last-child {
  border-bottom: 0;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.side {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
</style>
