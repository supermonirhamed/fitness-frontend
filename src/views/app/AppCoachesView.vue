<script setup lang="ts">
// Our coaches (US-11.24): the staff the organization shows in the app, with their specialties.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import BookTabs from '@/components/app/BookTabs.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppCoach } from '@/api/clientApp'

const { t } = useI18n()
const coaches = ref<AppCoach[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  state.value = 'loading'
  try {
    coaches.value = await clientApi.coaches.list()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <BookTabs />
    <h1 class="ca-title">{{ t('app.coaches.title') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="120px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <EmptyState v-else-if="!coaches.length" icon="pi-users" :title="t('app.coaches.none')" />
    <ul v-else class="grid">
      <li v-for="c in coaches" :key="c.id">
        <RouterLink :to="{ name: 'app.coach', params: { id: c.id } }" class="ca-card coach">
          <img v-if="c.photo_url" :src="c.photo_url" alt="" class="photo" />
          <span v-else class="photo photo--initial" aria-hidden="true">{{ c.name.charAt(0) }}</span>
          <strong>{{ c.name }}</strong>
          <span class="ca-muted ca-small">{{ c.specialties.slice(0, 3).join(' · ') }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.coach {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: var(--text-primary);
  text-decoration: none;
  height: 100%;
}
.photo {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}
.photo--initial {
  display: grid;
  place-items: center;
  background: var(--primary-100, #ede9fe);
  color: var(--primary-700, #6d28d9);
  font-size: 1.5rem;
  font-weight: 600;
}
</style>
