<script setup lang="ts">
// Send a message to a group of clients (US-12.13): who (a session's booked clients and/or waiting
// list, all coming sessions of its series, a branch's active clients, a segment, an academy group
// or program — guardians for children), why (operational, or marketing to consenting clients
// only), the channels, the text in Arabic and/or English, and now or later. Before sending it shows
// how many each channel reaches and the SMS segments it uses.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type Broadcast,
  type BroadcastAudienceType,
  type BroadcastInput,
  type BroadcastPreview,
  type NotificationChannel,
} from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { smsCount } from '@/lib/sms'
import { useStaffAuth } from '@/stores/staffAuth'

/** A session (and its series) the message is about, when opened from the session page. */
export interface BroadcastPreset {
  sessionId: number
  seriesId?: number | null
  label: string
}

const props = defineProps<{ preset?: BroadcastPreset | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [broadcast: Broadcast] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const CHANNELS: NotificationChannel[] = ['email', 'sms', 'push', 'whatsapp']
const type = ref<BroadcastAudienceType>('location')
const targetId = ref<number | null>(null)
const waitlist = ref(false)
const purpose = ref<'operational' | 'marketing'>('operational')
const channels = ref<NotificationChannel[]>(['email'])
const language = ref<'ar' | 'en'>('ar')
const content = ref({ ar: { subject: '', body: '' }, en: { subject: '', body: '' } })
const later = ref(false)
const at = ref<Date | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const preview = ref<BroadcastPreview | null>(null)
const previewError = ref<string | null>(null)

const targets = ref<Record<string, { id: number; label: string }[]>>({})
async function loadTargets() {
  const [segments, groups, programs] = await Promise.all([
    auth.can('clients.view') ? tenantApi.segments.list().catch(() => []) : [],
    auth.can('academy.view') ? tenantApi.academy.groups.list().catch(() => []) : [],
    auth.can('academy.view') ? tenantApi.programs.list().catch(() => []) : [],
  ])
  targets.value = {
    location: (auth.user?.switchable_locations ?? []).map((l) => ({ id: l.id, label: l.name })),
    segment: segments.map((s) => ({ id: s.id, label: s.name })),
    academy_group: groups.map((g) => ({ id: g.id, label: g.display_name ?? `#${g.id}` })),
    program: programs.map((p) => ({ id: p.id, label: p.display_name ?? `#${p.id}` })),
  }
}
onMounted(loadTargets)

const typeOptions = computed(() =>
  (props.preset
    ? ['session', ...(props.preset.seriesId ? ['series'] : [])]
    : ['location', 'segment', 'academy_group', 'program']
  ).map((value) => ({ value, label: t(`broadcasts.audiences.${value}`) })),
)
const targetOptions = computed(() => targets.value[type.value] ?? [])
const audienceId = computed(() =>
  type.value === 'session'
    ? props.preset?.sessionId
    : type.value === 'series'
      ? props.preset?.seriesId
      : targetId.value,
)
const purposeOptions = computed(() => [
  { value: 'operational', label: t('broadcasts.operational') },
  ...(auth.can('messages.marketing')
    ? [{ value: 'marketing', label: t('broadcasts.marketing') }]
    : []),
])
const languageOptions = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
]
const sms = computed(() => smsCount(content.value[language.value].body))
const written = computed(() => !!(content.value.ar.body.trim() || content.value.en.body.trim()))

function reset() {
  type.value = props.preset ? 'session' : 'location'
  targetId.value = null
  waitlist.value = false
  purpose.value = 'operational'
  channels.value = ['email']
  content.value = { ar: { subject: '', body: '' }, en: { subject: '', body: '' } }
  later.value = false
  at.value = null
  error.value = null
  preview.value = null
}
watch(visible, (open) => open && reset())
watch(type, () => (targetId.value = null))

function input(): BroadcastInput | null {
  if (!audienceId.value || !channels.value.length) return null
  return {
    audience: { type: type.value, id: audienceId.value, booked: true, waitlist: waitlist.value },
    purpose: purpose.value,
    channels: channels.value,
    content: {
      ...(content.value.ar.body.trim() ? { ar: content.value.ar } : {}),
      ...(content.value.en.body.trim() ? { en: content.value.en } : {}),
    },
    scheduled_at: later.value && at.value ? at.value.toISOString() : null,
  }
}

const refreshPreview = useDebounceFn(async () => {
  const data = input()
  previewError.value = null
  if (!data || !written.value) {
    preview.value = null
    return
  }
  try {
    preview.value = await tenantApi.broadcasts.preview({ ...data, scheduled_at: undefined })
  } catch (e) {
    preview.value = null
    previewError.value = firstMessage(e) ?? t('common.genericError')
  }
}, 400)
watch([type, targetId, waitlist, purpose, channels, content], () => refreshPreview(), {
  deep: true,
})

function toggleChannel(channel: NotificationChannel, on: boolean) {
  channels.value = on
    ? CHANNELS.filter((c) => c === channel || channels.value.includes(c))
    : channels.value.filter((c) => c !== channel)
}

async function send() {
  const data = input()
  if (!data) return
  saving.value = true
  error.value = null
  try {
    const sent = await tenantApi.broadcasts.create(data)
    toast.add({
      severity: 'success',
      summary: sent.status === 'Scheduled' ? t('broadcasts.scheduled') : t('broadcasts.sent'),
      life: 3000,
    })
    emit('sent', sent)
    visible.value = false
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    size="lg"
    :title="t('broadcasts.new')"
    :subtitle="preset?.label"
    :save-label="later ? t('broadcasts.schedule') : t('broadcasts.sendNow')"
    :saving="saving"
    :save-disabled="!input() || !written || (later && !at) || preview?.recipients === 0"
    :error="error"
    @save="send"
  >
    <FormField :label="t('broadcasts.audience')" for="bc-type" required>
      <Select
        v-model="type"
        input-id="bc-type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
      />
    </FormField>
    <FormField
      v-if="!['session', 'series'].includes(type)"
      :label="t(`broadcasts.audiences.${type}`)"
      for="bc-target"
      required
    >
      <Select
        v-model="targetId"
        input-id="bc-target"
        :options="targetOptions"
        option-label="label"
        option-value="id"
        filter
        :placeholder="t('broadcasts.choose')"
      />
    </FormField>
    <label v-else class="inline">
      <Checkbox v-model="waitlist" binary />{{ t('broadcasts.includeWaitlist') }}
    </label>

    <FormField :label="t('broadcasts.purpose')" :help="t(`broadcasts.purposeHelp.${purpose}`)">
      <SelectButton
        v-model="purpose"
        :options="purposeOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
    </FormField>

    <FormField :label="t('broadcasts.channels')">
      <span class="channels">
        <label v-for="c in CHANNELS" :key="c" class="inline">
          <Checkbox
            binary
            :model-value="channels.includes(c)"
            @update:model-value="(v: boolean) => toggleChannel(c, v)"
          />{{ t(`notificationSettings.channels.${c}`) }}
        </label>
      </span>
    </FormField>

    <div class="language">
      <SelectButton
        v-model="language"
        :options="languageOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('notificationTemplates.language')"
      />
      <span class="muted small">{{ t('broadcasts.languageHelp') }}</span>
    </div>
    <FormField :label="t('notificationTemplates.subject')" for="bc-subject">
      <InputText
        id="bc-subject"
        v-model="content[language].subject"
        maxlength="150"
        :dir="language === 'ar' ? 'rtl' : 'ltr'"
      />
    </FormField>
    <FormField :label="t('notificationTemplates.body')" for="bc-body" required>
      <Textarea
        id="bc-body"
        v-model="content[language].body"
        rows="6"
        auto-resize
        maxlength="2000"
        :dir="language === 'ar' ? 'rtl' : 'ltr'"
      />
      <span v-if="channels.includes('sms')" class="muted small">{{
        t('notificationSettings.count', {
          characters: sms.characters,
          segments: sms.segments,
          encoding: sms.encoding,
        })
      }}</span>
    </FormField>

    <label class="inline"> <ToggleSwitch v-model="later" />{{ t('broadcasts.later') }} </label>
    <FormField v-if="later" :label="t('broadcasts.when')" for="bc-at" required>
      <DatePicker
        v-model="at"
        input-id="bc-at"
        show-time
        hour-format="24"
        :min-date="new Date()"
        show-icon
      />
    </FormField>

    <Message v-if="previewError" severity="warn" :closable="false">{{ previewError }}</Message>
    <section v-else-if="preview" class="reach" :aria-label="t('broadcasts.reach')">
      <strong>{{ t('broadcasts.recipients', { n: preview.recipients }) }}</strong>
      <ul>
        <li v-for="(r, c) in preview.channels" :key="c">
          {{ t(`notificationSettings.channels.${c}`) }}:
          {{ t('broadcasts.reachLine', { reach: r?.reach ?? 0, skipped: r?.skipped ?? 0 }) }}
        </li>
      </ul>
      <span v-if="channels.includes('sms')" class="muted small">{{
        t('broadcasts.segments', { n: preview.sms_segments })
      }}</span>
    </section>
  </FormDrawer>
</template>

<style scoped>
.inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.channels {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.language {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.reach {
  padding: 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.reach ul {
  margin: 6px 0;
  padding-inline-start: 18px;
}
</style>
