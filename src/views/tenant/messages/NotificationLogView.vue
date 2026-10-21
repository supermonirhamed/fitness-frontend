<script setup lang="ts">
// The notification log (US-12.14): what was sent to whom and whether it arrived, filtered by
// recipient, contact, type, channel, status and dates, or by the booking, session, invoice or
// group message it was about (from the query string, linked from those pages). A row opens the
// message with the provider's answer and timestamps, where a failed or bounced one can be resent.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ClientPicker from '@/components/academy/ClientPicker.vue'
import MessageDetailsDrawer from '@/components/messages/MessageDetailsDrawer.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FilterBar, { type FilterChip } from '@/components/patterns/FilterBar.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import {
  tenantApi,
  type ClientMessage,
  type LoggedMessage,
  type NotificationChannel,
  type NotificationLogFilters,
} from '@/api/tenant'
import { isoDay } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useMessageLabels } from '@/composables/useMessageLabels'
import { useStaffAuth } from '@/stores/staffAuth'

const PER_PAGE = 30
const CHANNELS: NotificationChannel[] = ['email', 'sms', 'push', 'whatsapp']
const STATUSES: ClientMessage['status'][] = [
  'Queued',
  'Sending',
  'Sent',
  'Delivered',
  'Failed',
  'Bounced',
  'Skipped',
]
const RELATED = ['booking_id', 'scheduled_session_id', 'invoice_id', 'broadcast_id'] as const

const { t, tm } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useStaffAuth()
const format = useFormat()
const labels = useMessageLabels()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const rows = ref<LoggedMessage[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const client = ref<{ id: number; name: string } | null>(null)
const type = ref<string | null>(null)
const channel = ref<NotificationChannel | null>(null)
const status = ref<ClientMessage['status'] | null>(null)
const dates = ref<(Date | null)[] | null>(null)
const related = ref<Partial<Record<(typeof RELATED)[number], number>>>({})
const openId = ref<number | null>(null)
const open = ref(false)
const canSeeContacts = computed(() => auth.can('clients.contact_view'))

function fromQuery() {
  const q = route.query
  related.value = Object.fromEntries(
    RELATED.filter((k) => Number(q[k]) > 0).map((k) => [k, Number(q[k])]),
  )
  if (Number(q.client_id) > 0)
    client.value = { id: Number(q.client_id), name: String(q.client_name ?? `#${q.client_id}`) }
  if (typeof q.status === 'string' && (STATUSES as string[]).includes(q.status))
    status.value = q.status as ClientMessage['status']
}
fromQuery()

const typeOptions = computed(() =>
  Object.keys(tm('notificationSettings.typeNames') as Record<string, unknown>)
    .map((key) => ({ value: key, label: labels.typeName(key) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)
const channelOptions = computed(() =>
  CHANNELS.map((c) => ({ value: c, label: t(`notificationSettings.channels.${c}`) })),
)
const statusOptions = computed(() => STATUSES.map((s) => ({ value: s, label: labels.status(s) })))

const filters = computed<NotificationLogFilters>(() => ({
  client_id: client.value?.id,
  to: search.value.trim() || undefined,
  type: type.value ?? undefined,
  channel: channel.value ?? undefined,
  status: status.value ?? undefined,
  from: dates.value?.[0] ? isoDay(dates.value[0]) : undefined,
  until: dates.value?.[1]
    ? isoDay(dates.value[1])
    : dates.value?.[0]
      ? isoDay(dates.value[0])
      : undefined,
  ...related.value,
}))
const chips = computed<FilterChip[]>(() =>
  Object.entries(related.value).map(([key, id]) => ({
    key,
    label: t(`notificationLog.related.${key}`, { id }),
  })),
)
function removeChip(key: string) {
  const rest = { ...related.value }
  delete rest[key as (typeof RELATED)[number]]
  related.value = rest
  router.replace({ query: { ...route.query, [key]: undefined } })
}
function clearAll() {
  related.value = {}
  client.value = null
  type.value = null
  channel.value = null
  status.value = null
  dates.value = null
  search.value = ''
  router.replace({ query: {} })
}
const filtered = computed(() =>
  Object.values(filters.value).some((v) => v !== undefined && v !== null && v !== ''),
)

let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const result = await tenantApi.notificationLog.list({ ...filters.value, page: page.value })
    if (mine !== seq) return
    rows.value = result.data
    total.value = result.meta.total
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
watch(
  filters,
  () => {
    page.value = 1
    clearTimeout(timer)
    timer = setTimeout(load, 250)
  },
  { deep: true },
)
onMounted(load)
function onPage(e: DataTablePageEvent) {
  page.value = e.page + 1
  load()
}
function openRow(m: LoggedMessage) {
  openId.value = m.id
  open.value = true
}
const range = computed(() =>
  t('clients.range', {
    from: total.value ? (page.value - 1) * PER_PAGE + 1 : 0,
    to: Math.min(page.value * PER_PAGE, total.value),
    total: total.value,
  }),
)
</script>

<template>
  <div class="page">
    <PageHeader :title="t('notificationLog.title')" :subtitle="t('notificationLog.subtitle')" />

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <FilterBar
        v-model:search="search"
        :placeholder="t('notificationLog.searchContact')"
        :chips="chips"
        :class="{ 'no-search': !canSeeContacts }"
        @remove="removeChip"
        @clear="clearAll"
      >
        <div class="client-filter">
          <ClientPicker v-model="client" />
        </div>
        <Select
          v-model="type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('notificationLog.anyType')"
          show-clear
          filter
          class="filter"
        />
        <Select
          v-model="channel"
          :options="channelOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('notificationLog.anyChannel')"
          show-clear
          class="filter"
        />
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('notificationLog.anyStatus')"
          show-clear
          class="filter"
        />
        <DatePicker
          v-model="dates"
          selection-mode="range"
          :manual-input="false"
          show-icon
          icon-display="input"
          :placeholder="t('notificationLog.dates')"
          :aria-label="t('notificationLog.dates')"
          class="filter"
        />
      </FilterBar>

      <ErrorState v-if="state === 'error'" class="card" @retry="load" />
      <DataTable
        v-else
        :value="rows"
        data-key="id"
        lazy
        paginator
        :rows="PER_PAGE"
        :total-records="total"
        :first="(page - 1) * PER_PAGE"
        :loading="state === 'loading'"
        paginator-template="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        :current-page-report-template="range"
        :row-class="() => 'row-click'"
        @page="onPage"
        @row-click="openRow($event.data)"
      >
        <template #empty>
          <EmptyState
            compact
            :icon="filtered ? 'pi-search' : 'pi-inbox'"
            :title="filtered ? t('notificationLog.noMatch') : t('notificationLog.empty')"
          />
        </template>
        <Column :header="t('notificationLog.when')">
          <template #body="{ data }">
            <span class="num">{{ data.created_at ? format.date(data.created_at) : '' }}</span>
            <div class="muted">{{ data.created_at ? format.time(data.created_at) : '' }}</div>
          </template>
        </Column>
        <Column :header="t('notificationLog.recipient')">
          <template #body="{ data }">
            {{ data.recipient?.name ?? '—' }}
            <div v-if="data.about" class="muted">
              {{ t('clientMessages.about', { name: data.about.name }) }}
            </div>
            <div v-if="data.to" class="muted mono" dir="ltr">{{ data.to }}</div>
          </template>
        </Column>
        <Column :header="t('notificationLog.type')">
          <template #body="{ data }">
            {{ labels.typeName(data.type) }}
            <div v-if="data.invoice" class="muted mono">{{ data.invoice.number }}</div>
            <div v-if="data.resent_from_id" class="muted">
              {{ t('notificationLog.resendOf', { id: data.resent_from_id }) }}
            </div>
          </template>
        </Column>
        <Column :header="t('notificationLog.channel')">
          <template #body="{ data }">
            <Tag
              class="tag-sm"
              severity="secondary"
              :value="t(`notificationSettings.channels.${data.channel}`)"
            />
          </template>
        </Column>
        <Column :header="t('notificationLog.status')">
          <template #body="{ data }">
            <Tag
              class="tag-sm"
              :severity="labels.severity(data.status)"
              :value="labels.status(data.status)"
            />
            <div v-if="data.skip_reason" class="muted">{{ labels.reason(data.skip_reason) }}</div>
            <div v-else-if="data.error" class="muted ellipsis">{{ data.error }}</div>
          </template>
        </Column>
        <Column header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <i
              v-if="data.can_resend"
              class="pi pi-refresh muted"
              :title="t('notificationLog.canResend')"
              :aria-label="t('notificationLog.canResend')"
            />
          </template>
        </Column>
      </DataTable>
    </template>

    <MessageDetailsDrawer v-model:visible="open" :message-id="openId" @resent="load" />
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
  border-radius: var(--radius-card);
}
.filter {
  min-width: 160px;
}
.client-filter {
  min-width: 220px;
}
.no-search :deep(.filter-bar__search) {
  display: none;
}
.mono {
  font-family: var(--font-mono);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.ellipsis {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.row-end) {
  text-align: end;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
