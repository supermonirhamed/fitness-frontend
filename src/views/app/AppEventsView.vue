<script setup lang="ts">
// Workshops, camps and events (US-11.12): each with its dates, total price and seats left.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import BookTabs from '@/components/app/BookTabs.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppEvent } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'

const { t } = useI18n()
const format = useFormat()
const events = ref<AppEvent[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const dates = (e: AppEvent) => {
  const first = e.sessions[0]
  const last = e.sessions[e.sessions.length - 1]
  if (!first) return ''
  return first.date === last!.date
    ? showDay(format, first.date)
    : `${showDay(format, first.date)} – ${showDay(format, last!.date)}`
}

async function load() {
  state.value = 'loading'
  try {
    events.value = await clientApi.events.list()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.nav.schedule') }}</h1>
    <BookTabs />
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="80px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="!events.length" class="ca-card">
      <EmptyState compact icon="pi-star" :title="t('app.events.none')" />
    </div>
    <ul v-else class="ca-stack plain">
      <li v-for="e in events" :key="e.id">
        <RouterLink :to="{ name: 'app.event', params: { id: e.id } }" class="ca-card event">
          <div class="ca-spread">
            <strong>{{ e.name }}</strong>
            <Tag
              v-if="e.registered"
              severity="success"
              icon="pi pi-check"
              :value="t('app.events.registered')"
            />
            <Tag v-else-if="!e.open" severity="secondary" :value="e.reason ?? ''" />
          </div>
          <span class="ca-small"
            >{{ dates(e) }} ·
            {{ t('app.events.sessions', { n: e.sessions.length }, e.sessions.length) }}</span
          >
          <span class="ca-muted ca-small">{{ e.location.name }}</span>
          <span class="ca-row ca-small">
            <span>{{ t('app.events.seatsLeft', { n: e.seats_left }, e.seats_left) }}</span>
            <strong v-if="e.price !== null">{{ format.money(e.price) }}</strong>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.plain {
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}
.event {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-primary);
  text-decoration: none;
}
</style>
