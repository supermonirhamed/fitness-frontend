<script setup lang="ts">
// A coach's profile (US-11.24): photo, bio, specialties, certifications, their next classes and
// "Book with this trainer" for the appointment services they deliver.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type AppCoachProfile } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'

const { t } = useI18n()
const route = useRoute()
const format = useFormat()
const coach = ref<AppCoachProfile | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  state.value = 'loading'
  try {
    coach.value = await clientApi.coaches.get(Number(route.params.id))
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
</script>

<template>
  <div class="ca-stack">
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="200px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="coach">
      <section class="ca-card head">
        <img v-if="coach.photo_url" :src="coach.photo_url" alt="" class="photo" />
        <span v-else class="photo photo--initial" aria-hidden="true">{{
          coach.name.charAt(0)
        }}</span>
        <h1 class="ca-title">{{ coach.name }}</h1>
        <div v-if="coach.specialties.length" class="tags">
          <Tag v-for="s in coach.specialties" :key="s" severity="secondary" :value="s" />
        </div>
      </section>
      <section v-if="coach.bio || coach.certifications.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.coaches.about') }}</h2>
        <p v-if="coach.bio" class="bio">{{ coach.bio }}</p>
        <ul v-if="coach.certifications.length" class="certs">
          <li v-for="c in coach.certifications" :key="c">
            <i class="pi pi-verified" aria-hidden="true" /> {{ c }}
          </li>
        </ul>
      </section>
      <section v-if="coach.appointments.length" class="ca-card ca-stack">
        <h2 class="ca-subtitle">{{ t('app.coaches.bookWith') }}</h2>
        <RouterLink
          v-for="a in coach.appointments"
          :key="a.id"
          :to="{ name: 'app.appointments', query: { service_id: a.id, coach_id: coach.id } }"
          custom
          v-slot="{ navigate }"
        >
          <Button
            :label="a.name ?? ''"
            icon="pi pi-calendar-plus"
            variant="outlined"
            fluid
            @click="navigate"
          />
        </RouterLink>
      </section>
      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.coaches.upcoming') }}</h2>
        <EmptyState
          v-if="!coach.sessions.length"
          compact
          icon="pi-calendar"
          :title="t('app.coaches.noSessions')"
        />
        <ul v-else class="ca-list">
          <li v-for="s in coach.sessions" :key="s.id">
            <RouterLink
              :to="{ name: 'app.session', params: { id: s.id } }"
              class="ca-spread session"
            >
              <span>
                <strong>{{ s.service }}</strong>
                <span class="ca-muted ca-small block"
                  >{{ showDay(format, s.date) }} · {{ s.time }} · {{ s.location }}</span
                >
              </span>
              <i class="pi pi-angle-right pi-dir" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.photo {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  object-fit: cover;
}
.photo--initial {
  display: grid;
  place-items: center;
  background: var(--primary-100, #ede9fe);
  color: var(--primary-700, #6d28d9);
  font-size: 2.5rem;
  font-weight: 600;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.bio {
  white-space: pre-wrap;
  line-height: 1.6;
  margin: 0 0 8px;
}
.certs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.875rem;
}
.session {
  padding: 10px 0;
  color: var(--text-primary);
  text-decoration: none;
}
.block {
  display: block;
}
</style>
