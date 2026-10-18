<script setup lang="ts">
// An event's details and registration (US-11.12): every session and its time, the total price,
// seats left; one registration covers all its sessions. Payment follows US-11.13: without a
// gateway the invoice is paid at the desk.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import { clientApi, type AppEvent } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'

const { t, locale } = useI18n()
const route = useRoute()
const format = useFormat()
const event = ref<AppEvent | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const confirming = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const justRegistered = ref(false)
const description = computed(() => {
  const d = event.value?.description
  return d ? (locale.value === 'ar' ? d.ar || d.en : d.en || d.ar) : null
})

async function load() {
  state.value = 'loading'
  try {
    event.value = await clientApi.events.get(Number(route.params.id))
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function register() {
  busy.value = true
  error.value = null
  try {
    event.value = (await clientApi.events.register(event.value!.id)).event
    justRegistered.value = true
    confirming.value = false
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
    confirming.value = false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.events' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.book.events') }}</RouterLink
    >
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="140px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="event">
      <div class="ca-card head">
        <h1 class="ca-title">{{ event.name }}</h1>
        <p class="ca-muted">{{ event.location.name }}</p>
        <p class="ca-row">
          <strong v-if="event.price !== null">{{ format.money(event.price) }}</strong>
          <span class="ca-small">{{
            t('app.events.seatsLeft', { n: event.seats_left }, event.seats_left)
          }}</span>
        </p>
      </div>
      <Message v-if="justRegistered" severity="success" :closable="false">{{
        event.price
          ? t('app.events.doneToPay', { amount: format.money(event.price) })
          : t('app.events.done')
      }}</Message>
      <Message v-if="error" severity="warn" :closable="false">{{ error }}</Message>
      <Button
        v-if="event.registered"
        :label="t('app.events.registered')"
        icon="pi pi-check"
        disabled
        size="large"
        fluid
      />
      <Button
        v-else
        :label="event.open ? t('app.events.register') : (event.reason ?? '')"
        :disabled="!event.open"
        size="large"
        fluid
        @click="confirming = true"
      />
      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.events.schedule') }}</h2>
        <ul class="ca-list">
          <li v-for="s in event.sessions" :key="s.id" class="ca-spread line">
            <span>{{ showDay(format, s.date) }}</span>
            <span class="ca-num">{{ s.time }} – {{ s.ends }}</span>
          </li>
        </ul>
      </section>
      <section v-if="description" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.session.about') }}</h2>
        <p class="pre">{{ description }}</p>
      </section>
    </template>
    <FormDialog
      v-model:visible="confirming"
      :title="t('app.events.confirmTitle')"
      :subtitle="event?.name ?? ''"
      :save-label="t('app.events.register')"
      :saving="busy"
      @save="register"
    >
      <p class="ca-small">{{ t('app.events.confirmBody', { n: event?.sessions.length ?? 0 }) }}</p>
      <p v-if="event?.price" class="ca-small">
        {{ t('app.events.payAtDesk', { amount: format.money(event.price) }) }}
      </p>
    </FormDialog>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.head p {
  margin: 4px 0 0;
}
.line {
  padding: 8px 0;
}
.pre {
  white-space: pre-line;
}
</style>
