<script setup lang="ts">
// One entry of the notification log (US-12.14), in a side sheet: the rendered message, channel,
// status with the provider's answer and every timestamp, what it was about, and earlier resends.
// A failed or bounced message (or one skipped for a bad contact) can be sent again to the same or
// a corrected contact, which can also be saved on the client.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type LoggedMessage, type LoggedMessageDetails } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { firstMessage } from '@/lib/apiErrors'
import { useMessageLabels } from '@/composables/useMessageLabels'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ messageId: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ resent: [message: LoggedMessage] }>()
const { t, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const labels = useMessageLabels()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const message = ref<LoggedMessageDetails | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const target = ref<'same' | 'other'>('same')
const contact = ref('')
const updateClient = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

async function load() {
  if (!props.messageId) return
  state.value = 'loading'
  error.value = null
  try {
    message.value = await tenantApi.notificationLog.get(props.messageId)
    target.value = message.value.to ? 'same' : 'other'
    contact.value = ''
    updateClient.value = false
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(
  () => [visible.value, props.messageId],
  () => {
    if (visible.value) load()
  },
  { immediate: true },
)

const canCorrect = computed(
  () => message.value?.channel !== 'push' && auth.can('clients.contact_view'),
)
const timestamps = computed(() => {
  const m = message.value
  if (!m) return []
  return (
    [
      ['created', m.created_at],
      ['waiting', m.status === 'Queued' ? m.send_after : null],
      ['sent', m.sent_at],
      ['delivered', m.delivered_at],
      ['complained', m.complained_at],
      ['updated', m.updated_at],
    ] as const
  ).filter(([, at]) => !!at) as [string, string][]
})

async function resend() {
  if (!message.value) return
  saving.value = true
  error.value = null
  try {
    const copy = await tenantApi.notificationLog.resend(message.value.id, {
      to: target.value === 'other' ? contact.value.trim() : null,
      update_client: target.value === 'other' && updateClient.value,
    })
    toast.add({ severity: 'success', summary: t('notificationLog.resent'), life: 3000 })
    emit('resent', copy)
    await load()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :dismissable="!saving"
    class="form-drawer drawer-lg"
  >
    <template #header>
      <div class="titles">
        <span class="p-drawer-title">{{
          message ? labels.typeName(message.type) : t('notificationLog.message')
        }}</span>
        <span v-if="message" class="muted small">
          {{ t(`notificationSettings.channels.${message.channel}`) }} ·
          {{ message.created_at ? format.dateTime(message.created_at) : '' }}
        </span>
      </div>
    </template>

    <Skeleton v-if="state === 'loading'" height="240px" />
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="message" class="body">
      <div class="status-row">
        <Tag :severity="labels.severity(message.status)" :value="labels.status(message.status)" />
        <span v-if="message.skip_reason" class="muted">{{
          labels.reason(message.skip_reason)
        }}</span>
        <Tag
          v-if="message.resent_from_id"
          severity="secondary"
          :value="t('notificationLog.resendOf', { id: message.resent_from_id })"
        />
      </div>
      <Message v-if="message.error" severity="warn" :closable="false">
        <strong>{{ t('notificationLog.providerResponse') }}:</strong> {{ message.error }}
      </Message>

      <dl class="facts">
        <dt>{{ t('notificationLog.recipient') }}</dt>
        <dd>
          <RouterLink
            v-if="message.recipient"
            :to="{ name: 'tenant.client', params: { id: message.recipient.id } }"
            >{{ message.recipient.name }}</RouterLink
          >
          <span v-else>—</span>
          <span v-if="message.about" class="muted">
            ({{ t('clientMessages.about', { name: message.about.name }) }})</span
          >
        </dd>
        <template v-if="message.to">
          <dt>{{ t('notificationLog.to') }}</dt>
          <dd dir="ltr" class="mono">{{ message.to }}</dd>
        </template>
        <template v-if="message.location">
          <dt>{{ t('notificationLog.branch') }}</dt>
          <dd>{{ message.location }}</dd>
        </template>
        <template v-if="message.session">
          <dt>{{ t('notificationLog.session') }}</dt>
          <dd>
            <RouterLink :to="{ name: 'tenant.session', params: { id: message.session.id } }"
              >{{ message.session.name ?? '#' + message.session.id }}
              <template v-if="message.session.starts_at"
                >· {{ format.dateTime(message.session.starts_at) }}</template
              ></RouterLink
            >
          </dd>
        </template>
        <template v-if="message.invoice">
          <dt>{{ t('notificationLog.invoice') }}</dt>
          <dd>
            <RouterLink
              v-if="auth.can('payments.view')"
              :to="{ name: 'tenant.invoice', params: { id: message.invoice.id } }"
              class="mono"
              >{{ message.invoice.number }}</RouterLink
            >
            <span v-else class="mono">{{ message.invoice.number }}</span>
          </dd>
        </template>
        <template v-if="message.provider">
          <dt>{{ t('notificationLog.provider') }}</dt>
          <dd>
            {{ message.provider }}
            <span v-if="message.provider_message_id" class="muted mono">
              · {{ message.provider_message_id }}</span
            >
            <span v-if="message.segments" class="muted">
              · {{ t('notificationLog.segments', message.segments) }}</span
            >
          </dd>
        </template>
        <template v-if="message.attempts > 1">
          <dt>{{ t('notificationLog.attempts') }}</dt>
          <dd class="num">{{ message.attempts }}</dd>
        </template>
        <template v-for="[key, at] in timestamps" :key="key">
          <dt>{{ t(`notificationLog.times.${key}`) }}</dt>
          <dd class="num">{{ format.dateTime(at) }}</dd>
        </template>
        <template v-if="message.resent_by">
          <dt>{{ t('notificationLog.resentBy') }}</dt>
          <dd>{{ message.resent_by }}</dd>
        </template>
      </dl>

      <section class="content">
        <h4>{{ t('notificationLog.content') }}</h4>
        <p v-if="message.body_purged" class="muted">{{ t('notificationLog.purged') }}</p>
        <template v-else>
          <strong v-if="message.subject">{{ message.subject }}</strong>
          <p class="pre" :dir="message.locale === 'ar' ? 'rtl' : 'ltr'">
            {{ message.body ?? '—' }}
          </p>
        </template>
      </section>

      <section v-if="message.resends.length" class="content">
        <h4>{{ t('notificationLog.resends') }}</h4>
        <ul class="resends">
          <li v-for="r in message.resends" :key="r.id">
            <span class="num">{{ r.created_at ? format.dateTime(r.created_at) : '' }}</span>
            <span v-if="r.to" dir="ltr" class="mono muted">{{ r.to }}</span>
            <Tag :severity="labels.severity(r.status)" :value="labels.status(r.status)" />
          </li>
        </ul>
      </section>

      <section v-if="message.can_resend" class="content resend">
        <h4>{{ t('notificationLog.resendTitle') }}</h4>
        <label v-if="message.to || message.channel === 'push'" class="choice">
          <RadioButton v-model="target" value="same" input-id="target-same" />
          <span
            >{{ t('notificationLog.sameContact') }}
            <span v-if="message.to" dir="ltr" class="mono muted">{{ message.to }}</span></span
          >
        </label>
        <template v-if="canCorrect">
          <label class="choice">
            <RadioButton v-model="target" value="other" input-id="target-other" />
            <span>{{
              message.channel === 'email'
                ? t('notificationLog.otherEmail')
                : t('notificationLog.otherMobile')
            }}</span>
          </label>
          <template v-if="target === 'other'">
            <InputText
              v-model="contact"
              :type="message.channel === 'email' ? 'email' : 'tel'"
              dir="ltr"
              :placeholder="
                message.channel === 'email'
                  ? (message.client_contact?.email ?? 'name@example.com')
                  : (message.client_contact?.mobile ?? '+9665XXXXXXXX')
              "
              :aria-label="t('notificationLog.newContact')"
              fluid
            />
            <label v-if="auth.can('clients.update') && message.recipient" class="choice">
              <Checkbox v-model="updateClient" binary input-id="update-client" />
              <span>{{ t('notificationLog.updateClient') }}</span>
            </label>
          </template>
        </template>
        <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      </section>
    </div>

    <template #footer>
      <span class="spacer" />
      <Button
        :label="t('common.close')"
        severity="secondary"
        variant="text"
        :disabled="saving"
        @click="visible = false"
      />
      <Button
        v-if="message?.can_resend && auth.can('messages.send')"
        :label="t('notificationLog.resend')"
        icon="pi pi-refresh"
        :loading="saving"
        :disabled="target === 'other' && !contact.trim()"
        @click="resend"
      />
    </template>
  </Drawer>
</template>

<style scoped>
.titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}
.facts dt {
  color: var(--text-muted);
  font: var(--text-small);
  padding-top: 2px;
}
.facts dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
}
.content h4 {
  margin: 0;
  font: 600 14px var(--font-sans);
}
.pre {
  margin: 0;
  white-space: pre-wrap;
}
.resends {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.resends li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.choice {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.mono {
  font-family: var(--font-mono);
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.spacer {
  flex: 1;
}
</style>
