<script setup lang="ts">
// The client's timeline (US-05.06, brief 06 §3): everything that happened with them, newest first,
// each with who did it and when, filterable by type. Purchases, memberships, notes and messages
// join as EP-06/07, US-05.11 and EP-12 arrive.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type TimelineEvent, type TimelineType } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ clientId: number }>()
const { t, te } = useI18n()
const format = useFormat()

const TYPES: TimelineType[] = [
  'bookings',
  'cancellations',
  'attendance',
  'waitlist',
  'payments',
  'memberships',
  'profile',
  'notes',
]
const ICONS: Record<string, string> = {
  bookings: 'pi-calendar-plus',
  cancellations: 'pi-times-circle',
  attendance: 'pi-check-square',
  waitlist: 'pi-list',
  payments: 'pi-wallet',
  profile: 'pi-user-edit',
  notes: 'pi-comment',
  memberships: 'pi-id-card',
  other: 'pi-circle',
}
const type = ref<TimelineType | 'all'>('all')
const state = ref<'loading' | 'ready' | 'error'>('loading')
const events = ref<TimelineEvent[]>([])
const page = ref(1)
const lastPage = ref(1)

async function load(more = false) {
  if (!more) {
    page.value = 1
    state.value = 'loading'
  }
  try {
    const result = await tenantApi.clients.timeline(props.clientId, {
      type: type.value === 'all' ? undefined : type.value,
      page: page.value,
    })
    events.value = more ? [...events.value, ...result.data] : result.data
    lastPage.value = result.meta.last_page
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch([() => props.clientId, type], () => load(), { immediate: true })
function loadMore() {
  page.value++
  load(true)
}

const typeOptions = computed(() => [
  { value: 'all', label: t('timeline.all') },
  ...TYPES.map((v) => ({ value: v, label: t(`timeline.types.${v}`) })),
])

const title = (e: TimelineEvent) => {
  const key = `timeline.actions.${e.action.replace(/\./g, '_')}`
  return te(key) ? t(key) : e.action
}
/** One line of what it was about: the session, the amount, the reason… */
function detail(e: TimelineEvent): string {
  const v = e.values
  const parts: string[] = []
  if (typeof v.from === 'string' && typeof v.to === 'string') parts.push(`${v.from} → ${v.to}`)
  else if (typeof v.plan === 'string') parts.push(v.plan)
  if (typeof v.session === 'string') parts.push(v.session)
  if (typeof v.starts_at === 'string') parts.push(format.dateTime(v.starts_at))
  if (typeof v.amount === 'number') parts.push(format.money(v.amount))
  if (typeof v.receipt_number === 'string') parts.push(v.receipt_number)
  if (Array.isArray(v.changed) && v.changed.length)
    parts.push(
      (v.changed as string[])
        .map((f) => (te(`timeline.fields.${f}`) ? t(`timeline.fields.${f}`) : f))
        .join(', '),
    )
  if (typeof v.reason === 'string') parts.push(v.reason)
  if (typeof v.waive_reason === 'string') parts.push(v.waive_reason)
  return parts.join(' · ')
}
</script>

<template>
  <div class="card timeline-card">
    <div class="bar">
      <SelectButton
        v-model="type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('timeline.filter')"
      />
    </div>
    <div v-if="state === 'loading'" class="pad">
      <Skeleton v-for="n in 4" :key="n" height="40px" class="sk" />
    </div>
    <ErrorState v-else-if="state === 'error'" :title="t('timeline.loadError')" @retry="load()" />
    <EmptyState v-else-if="!events.length" compact icon="pi-history" :title="t('timeline.empty')" />
    <ol v-else class="events">
      <li v-for="e in events" :key="e.id" class="event">
        <span :class="['event__dot', `event__dot--${e.type}`]" aria-hidden="true"
          ><i :class="['pi', ICONS[e.type] ?? ICONS.other]"
        /></span>
        <div class="event__body">
          <div class="event__title">{{ title(e) }}</div>
          <div v-if="detail(e)" class="event__detail">{{ detail(e) }}</div>
          <small class="muted"
            >{{ e.at ? format.dateTime(e.at) : ''
            }}<template v-if="e.user"> · {{ e.user }}</template></small
          >
        </div>
      </li>
    </ol>
    <div v-if="state === 'ready' && page < lastPage" class="pad more">
      <Button :label="t('timeline.more')" variant="text" @click="loadMore" />
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}
.pad {
  padding: 16px;
}
.sk {
  margin-bottom: 8px;
}
.events {
  list-style: none;
  margin: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.event {
  display: flex;
  gap: 12px;
}
.event__dot {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-size: 12px;
}
.event__dot--cancellations {
  color: var(--sev-danger-solid);
}
.event__dot--payments,
.event__dot--attendance {
  color: var(--sev-success-solid);
}
.event__dot--memberships {
  color: var(--primary-600);
}
.event__dot--waitlist {
  color: var(--sev-warn-solid);
}
.event__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.event__title {
  font: 500 14px var(--font-sans);
}
.event__detail {
  font: var(--text-body);
  color: var(--text-secondary);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.more {
  text-align: center;
}
</style>
