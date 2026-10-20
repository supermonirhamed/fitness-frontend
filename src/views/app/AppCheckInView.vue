<script setup lang="ts">
// Checking in with the branch's QR code (US-11.23): scanning it (with the app or the phone's
// camera) opens this page with today's bookings there, mine and my children's; one tap checks in
// within the check-in window. Refusals say why, as at the desk.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { clientApi, type BranchCheckIn } from '@/api/clientApp'
import { firstMessage } from '@/lib/apiErrors'

const { t } = useI18n()
const route = useRoute()
const token = String(route.params.token)
const branch = ref<BranchCheckIn | null>(null)
const state = ref<'loading' | 'ready' | 'error' | 'invalid'>('loading')
const busy = ref<number | null>(null)
const error = ref<string | null>(null)
const done = ref<string | null>(null)

async function load() {
  state.value = 'loading'
  try {
    branch.value = await clientApi.checkIn.branch(token)
    state.value = 'ready'
  } catch (e) {
    state.value =
      (e as { response?: { status?: number } }).response?.status === 404 ? 'invalid' : 'error'
  }
}
onMounted(load)

async function checkIn(b: BranchCheckIn['bookings'][number]) {
  busy.value = b.id
  error.value = null
  try {
    branch.value = await clientApi.checkIn.checkIn(token, b.id)
    done.value = b.client.self
      ? t('app.checkIn.done', { service: b.session.service })
      : t('app.checkIn.doneFor', { name: b.client.first_name, service: b.session.service })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.checkIn.title') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="120px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <EmptyState
      v-else-if="state === 'invalid'"
      icon="pi-qrcode"
      :title="t('app.checkIn.invalid')"
      :body="t('app.checkIn.invalidHint')"
    />
    <template v-else-if="branch">
      <p class="ca-muted">
        <i class="pi pi-map-marker" aria-hidden="true" /> {{ branch.location.name }}
      </p>
      <Message v-if="done" severity="success" :closable="false" icon="pi pi-check-circle">{{
        done
      }}</Message>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <EmptyState
        v-if="!branch.bookings.length"
        icon="pi-calendar"
        :title="t('app.checkIn.none')"
        :body="t('app.checkIn.noneHint')"
      >
        <RouterLink :to="{ name: 'app.schedule' }" custom v-slot="{ navigate }">
          <Button :label="t('app.home.explore')" icon="pi pi-calendar" @click="navigate" />
        </RouterLink>
      </EmptyState>
      <ul v-else class="ca-card ca-list">
        <li v-for="b in branch.bookings" :key="b.id" class="booking">
          <div class="ca-spread">
            <div>
              <strong>{{ b.session.service }}</strong>
              <p class="ca-muted ca-small">
                {{
                  [b.session.time, b.session.facility, b.client.self ? null : b.client.first_name]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </p>
            </div>
            <Tag v-if="b.checked_in" severity="success" :value="t('app.checkIn.checkedIn')" />
            <Button
              v-else
              :label="t('app.checkIn.action')"
              icon="pi pi-sign-in"
              :disabled="!b.can_check_in"
              :loading="busy === b.id"
              @click="checkIn(b)"
            />
          </div>
          <p v-for="d in b.checked_in ? [] : b.denials" :key="d.code" class="ca-muted ca-small">
            <i class="pi pi-info-circle" aria-hidden="true" /> {{ d.message }}
          </p>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.booking {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
}
</style>
