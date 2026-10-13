<script setup lang="ts">
// Client profile header (US-05.01), as the design's ClientProfile: photo, name, status, member ID,
// mobile and home branch, and the check-in QR (EP-08). The tabs (bookings, family, waivers, notes,
// timeline) arrive with US-05.05 and the stories after it.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import ClientHealthCard from '@/components/clients/ClientHealthCard.vue'
import { tenantApi, type Client } from '@/api/tenant'
import { statusOf } from '@/lib/http'

const route = useRoute()
const { t } = useI18n()
const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const client = ref<Client | null>(null)

async function load() {
  state.value = 'loading'
  try {
    client.value = await tenantApi.clients.get(Number(route.params.id))
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
watch(() => route.params.id, load)
const qrUrl = computed(() => (client.value ? `/api/clients/${client.value.id}/qr` : null))
</script>

<template>
  <div class="page">
    <nav class="crumbs" :aria-label="t('shell.breadcrumb')">
      <RouterLink :to="{ name: 'tenant.clients' }">{{ t('clients.title') }}</RouterLink>
      <i class="pi pi-chevron-right pi-dir" aria-hidden="true" />
      <span aria-current="page">{{ client?.name }}</span>
    </nav>

    <div v-if="state === 'loading'" class="card head"><Skeleton height="80px" /></div>
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-search"
      :title="t('clients.missing')"
      :body="t('clients.missingHint')"
    />
    <ErrorState
      v-else-if="state === 'error' || !client"
      class="card"
      :title="t('clients.loadError')"
      @retry="load"
    />
    <template v-else>
      <div class="card head">
        <PersonAvatar :name="client.name" :image="client.photo_url" size="xl" />
        <div class="head__text">
          <div class="head__title">
            <h1>{{ client.name }}</h1>
            <StatusTag :status="client.status" />
          </div>
          <div class="head__meta">
            <span class="mono">{{ client.member_id }}</span>
            <span v-if="client.mobile" dir="ltr">{{ client.mobile }}</span>
            <span v-if="client.email" dir="ltr">{{ client.email }}</span>
            <span v-if="client.home_location"
              ><i class="pi pi-map-marker" aria-hidden="true" />{{
                client.home_location.name
              }}</span
            >
            <span v-if="client.age !== null">{{ t('clients.age', { n: client.age }) }}</span>
          </div>
          <div v-if="client.has_health_notes" class="head__alerts">
            <Tag
              severity="danger"
              icon="pi pi-heart"
              class="tag-sm"
              :value="t('clientHealth.alert')"
            />
          </div>
        </div>
      </div>
      <div class="grid">
        <ClientHealthCard :client-id="client.id" @changed="load" />
        <div class="card qr">
          <div class="qr__title">{{ t('clients.checkInCode') }}</div>
          <img v-if="qrUrl" :src="qrUrl" :alt="t('clients.checkInCode')" width="160" height="160" />
          <div class="qr__id mono">{{ client.member_id }}</div>
          <small class="qr__hint">{{ t('clients.checkInHint') }}</small>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.crumbs a {
  color: var(--text-link);
  text-decoration: none;
}
.crumbs i {
  font-size: 10px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.head {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  padding: 20px;
}
.head__text {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head__title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.head__title h1 {
  margin: 0;
  font: var(--text-h1);
}
.head__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.head__alerts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.head__meta i {
  font-size: 12px;
  margin-inline-end: 4px;
}
.mono {
  font-family: var(--font-mono);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.qr {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qr__title {
  font: var(--text-h4);
  align-self: flex-start;
}
.qr__id {
  font: 600 14px var(--font-mono);
}
.qr__hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
