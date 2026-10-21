<script setup lang="ts">
// The client's messages tab (EP-12): their marketing consent per channel and WhatsApp opt-in,
// with when and how each was given (US-12.12, US-12.05; staff with clients.update record it),
// and every message sent to them or about them — a child's go to the guardians — with its channel,
// status and, when skipped, why (US-12.09).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import MessageDetailsDrawer from '@/components/messages/MessageDetailsDrawer.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import {
  tenantApi,
  type ClientConsents,
  type ClientMessage,
  type NotificationChannel,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { firstMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const { t, te } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const CHANNELS: NotificationChannel[] = ['email', 'sms', 'push', 'whatsapp']

const consents = ref<ClientConsents | null>(null)
const saving = ref(false)
const showHistory = ref(false)
const messages = ref<ClientMessage[]>([])
const total = ref(0)
const page = ref(1)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const expanded = ref<number | null>(null)
const detailsOpen = ref(false)
const canSeeMessages = computed(() => auth.can('messages.view'))
const STATUS: Record<
  ClientMessage['status'],
  'success' | 'info' | 'warn' | 'danger' | 'secondary'
> = {
  Queued: 'info',
  Sending: 'info',
  Sent: 'success',
  Delivered: 'success',
  Failed: 'danger',
  Bounced: 'danger',
  Skipped: 'secondary',
}

async function loadConsents() {
  consents.value = await tenantApi.clientMessages.consents(props.clientId).catch(() => null)
}
async function loadMessages() {
  if (!canSeeMessages.value) return
  state.value = 'loading'
  try {
    const res = await tenantApi.clientMessages.list(props.clientId, { page: page.value })
    messages.value = res.data
    total.value = res.meta.total
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(() => {
  loadConsents()
  loadMessages()
})

async function setConsent(input: {
  marketing?: Partial<Record<NotificationChannel, boolean>>
  whatsapp?: boolean
}) {
  saving.value = true
  try {
    consents.value = await tenantApi.clientMessages.updateConsents(props.clientId, input)
    toast.add({ severity: 'success', summary: t('clientMessages.consentSaved'), life: 2500 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    saving.value = false
  }
}

function typeName(key: string): string {
  return te(`notificationSettings.typeNames.${key}`)
    ? t(`notificationSettings.typeNames.${key}`)
    : key
}
function reason(key: string | null): string {
  if (!key) return ''
  return te(`clientMessages.reasons.${key}`) ? t(`clientMessages.reasons.${key}`) : key
}
function source(key: string | null): string {
  if (!key) return '—'
  return te(`clientMessages.sources.${key}`) ? t(`clientMessages.sources.${key}`) : key
}
</script>

<template>
  <div class="stack">
    <section class="card pad">
      <h3 class="card__title">{{ t('clientMessages.consent') }}</h3>
      <p class="muted small">{{ t('clientMessages.consentHelp') }}</p>
      <Skeleton v-if="!consents" height="80px" />
      <template v-else>
        <ul class="consents">
          <li v-for="c in CHANNELS" :key="c">
            <span>{{
              t('clientMessages.marketingBy', { channel: t(`notificationSettings.channels.${c}`) })
            }}</span>
            <span class="muted small">
              {{ consents.marketing[c].at ? format.date(consents.marketing[c].at!) : '' }}
              {{ consents.marketing[c].source ? `· ${source(consents.marketing[c].source)}` : '' }}
            </span>
            <ToggleSwitch
              :model-value="consents.marketing[c].granted"
              :disabled="saving || !auth.can('clients.update')"
              :aria-label="
                t('clientMessages.marketingBy', {
                  channel: t(`notificationSettings.channels.${c}`),
                })
              "
              @update:model-value="(v: boolean) => setConsent({ marketing: { [c]: v } })"
            />
          </li>
          <li>
            <span>{{ t('clientMessages.whatsappOptIn') }}</span>
            <span class="muted small">{{
              consents.whatsapp ? format.date(consents.whatsapp) : t('clientMessages.notOptedIn')
            }}</span>
            <ToggleSwitch
              :model-value="!!consents.whatsapp"
              :disabled="saving || !auth.can('clients.update')"
              :aria-label="t('clientMessages.whatsappOptIn')"
              @update:model-value="(v: boolean) => setConsent({ whatsapp: v })"
            />
          </li>
        </ul>
        <Button
          v-if="consents.history.length"
          :label="showHistory ? t('clientMessages.hideHistory') : t('clientMessages.showHistory')"
          variant="text"
          size="small"
          @click="showHistory = !showHistory"
        />
        <ul v-if="showHistory" class="history">
          <li v-for="(h, i) in consents.history" :key="i" class="muted small">
            {{ h.at ? format.dateTime(h.at) : '' }} ·
            {{
              h.purpose === 'whatsapp'
                ? t('clientMessages.whatsappOptIn')
                : t('clientMessages.marketingBy', {
                    channel: t(`notificationSettings.channels.${h.channel}`),
                  })
            }}
            · {{ h.granted ? t('clientMessages.granted') : t('clientMessages.withdrawn') }} ·
            {{ source(h.source) }}{{ h.by ? ` (${h.by})` : '' }}
          </li>
        </ul>
      </template>
    </section>

    <section v-if="canSeeMessages" class="card pad">
      <h3 class="card__title">{{ t('clientMessages.title') }}</h3>
      <Skeleton v-if="state === 'loading'" height="80px" />
      <ErrorState v-else-if="state === 'error'" @retry="loadMessages" />
      <p v-else-if="!messages.length" class="muted">{{ t('clientMessages.none') }}</p>
      <ul v-else class="messages">
        <li v-for="m in messages" :key="m.id">
          <button
            type="button"
            class="row"
            :aria-expanded="expanded === m.id"
            @click="expanded = expanded === m.id ? null : m.id"
          >
            <span class="when num">{{ m.created_at ? format.dateTime(m.created_at) : '' }}</span>
            <span class="what">
              {{ typeName(m.type) }}
              <span v-if="m.recipient" class="muted small">→ {{ m.recipient }}</span>
              <span v-if="m.about" class="muted small"
                >({{ t('clientMessages.about', { name: m.about }) }})</span
              >
            </span>
            <Tag severity="secondary" :value="t(`notificationSettings.channels.${m.channel}`)" />
            <Tag :severity="STATUS[m.status]" :value="t(`clientMessages.statuses.${m.status}`)" />
            <span v-if="m.skip_reason" class="muted small">{{ reason(m.skip_reason) }}</span>
          </button>
          <div v-if="expanded === m.id" class="detail">
            <span v-if="m.to" class="muted small" dir="ltr">{{ m.to }}</span>
            <strong v-if="m.subject">{{ m.subject }}</strong>
            <p class="pre">{{ m.body }}</p>
            <span v-if="m.error" class="error small">{{ m.error }}</span>
            <span v-if="m.send_after && m.status === 'Queued'" class="muted small">{{
              t('clientMessages.waiting', { at: format.dateTime(m.send_after) })
            }}</span>
            <Button
              :label="
                ['Failed', 'Bounced', 'Skipped'].includes(m.status) && auth.can('messages.send')
                  ? t('clientMessages.detailsResend')
                  : t('clientMessages.details')
              "
              icon="pi pi-external-link"
              variant="text"
              size="small"
              class="details-btn"
              @click="detailsOpen = true"
            />
          </div>
        </li>
      </ul>
      <Paginator
        v-if="total > 30"
        :rows="30"
        :total-records="total"
        :first="(page - 1) * 30"
        @page="(e) => ((page = e.page + 1), loadMessages())"
      />
      <MessageDetailsDrawer
        v-model:visible="detailsOpen"
        :message-id="expanded"
        @resent="loadMessages"
      />
    </section>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}
.pad {
  padding: 16px;
}
.card__title {
  margin: 0 0 6px;
  font: 600 15px var(--font-sans);
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.error {
  color: var(--danger, #b91c1c);
}
.consents,
.history,
.messages {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.consents li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.history li {
  padding: 4px 0;
}
.messages li {
  border-bottom: 1px solid var(--border-subtle);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
  padding: 10px 0;
  border: 0;
  background: transparent;
  text-align: start;
  color: inherit;
  cursor: pointer;
}
.what {
  flex: 1;
  min-width: 160px;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 0 12px;
}
.pre {
  margin: 0;
  white-space: pre-wrap;
}
.details-btn {
  align-self: flex-start;
}
</style>
