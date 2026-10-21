<script setup lang="ts">
// Settings → Notifications (EP-12): emails go out under the organization's name and reply to the
// branch (US-12.02); SMS use the organization's sender ID where the provider allows it, with a
// counter showing how a text is split and billed (US-12.03); WhatsApp Business maps each type to
// an approved template (US-12.05); booking reminder times and the expiry notice (US-12.08), quiet
// hours and combining repeated messages (US-12.11); and every notification type, on or off with
// its channels, for the organization or one branch (US-12.07). Mandatory types stay on.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import {
  tenantApi,
  type NotificationCatalogType,
  type NotificationChannel,
  type NotificationSettings,
  type NotificationSettingsInput,
  type NotificationTypeChoice,
} from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { smsCount } from '@/lib/sms'
import { useStaffAuth } from '@/stores/staffAuth'

type Form = Required<NotificationSettingsInput>

const CHANNELS: NotificationChannel[] = ['email', 'sms', 'push', 'whatsapp']
const REMINDER_HOURS = [1, 2, 3, 4, 6, 12, 24, 48, 72]

const { t, te } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const settings = ref<NotificationSettings | null>(null)
const form = ref<Form | null>(null)
const saved = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== saved.value)
const sample = ref('')
const count = computed(() => smsCount(sample.value))
/** Whose setting the list edits: the organization's, or one branch's override. */
const scope = ref<'org' | number>('org')
const scopeOptions = computed(() => [
  { value: 'org', label: t('notificationSettings.scopeOrg') },
  ...(settings.value?.locations ?? []).map((l) => ({ value: l.id, label: l.name })),
])
const areas = computed(() => {
  const groups = new Map<string, NotificationCatalogType[]>()
  for (const type of settings.value?.catalog ?? [])
    groups.set(type.area, [...(groups.get(type.area) ?? []), type])
  return [...groups.entries()]
})
const reminderOptions = computed(() =>
  REMINDER_HOURS.map((h) => ({ value: h, label: t('notificationSettings.hoursBefore', { n: h }) })),
)

function snapshot(data: NotificationSettings): Form {
  return JSON.parse(
    JSON.stringify({
      sms_sender_id: data.sms_sender_id ?? '',
      types: Array.isArray(data.types) ? {} : data.types,
      location_types: Array.isArray(data.location_types) ? {} : data.location_types,
      reminder_hours: data.reminder_hours,
      expiry_notice_days: data.expiry_notice_days,
      quiet_hours: data.quiet_hours,
      combine_minutes: data.combine_minutes,
      log_retention_months: data.log_retention_months,
      whatsapp: {
        enabled: data.whatsapp.enabled,
        templates: Array.isArray(data.whatsapp.templates) ? {} : data.whatsapp.templates,
      },
    }),
  )
}
function apply(data: NotificationSettings) {
  settings.value = data
  form.value = snapshot(data)
  saved.value = JSON.stringify(form.value)
}
async function load() {
  state.value = 'loading'
  try {
    apply(await tenantApi.notificationSettings.get())
    sample.value = t('notificationSettings.sampleText')
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function orgChoice(type: NotificationCatalogType): Required<NotificationTypeChoice> {
  const own = form.value?.types[type.key] ?? {}
  return {
    enabled: type.mandatory || (own.enabled ?? true),
    channels: own.channels ?? type.default_channels,
  }
}
function branchOverride(type: NotificationCatalogType): NotificationTypeChoice | null {
  if (scope.value === 'org') return null
  return form.value?.location_types[String(scope.value)]?.[type.key] ?? null
}
/** What applies in the scope being edited. */
function effective(type: NotificationCatalogType): Required<NotificationTypeChoice> {
  const org = orgChoice(type)
  const own = branchOverride(type)
  return {
    enabled: type.mandatory || (own?.enabled ?? org.enabled),
    channels: own?.channels ?? org.channels,
  }
}
function change(type: NotificationCatalogType, patch: NotificationTypeChoice) {
  if (!form.value) return
  if (scope.value === 'org') {
    form.value.types = {
      ...form.value.types,
      [type.key]: { ...form.value.types[type.key], ...patch },
    }
    return
  }
  const id = String(scope.value)
  const current = effective(type)
  form.value.location_types = {
    ...form.value.location_types,
    [id]: {
      ...form.value.location_types[id],
      [type.key]: { ...current, ...form.value.location_types[id]?.[type.key], ...patch },
    },
  }
}
function toggleChannel(type: NotificationCatalogType, channel: NotificationChannel, on: boolean) {
  const channels = effective(type).channels.filter((c) => c !== channel)
  change(type, {
    channels: on ? CHANNELS.filter((c) => c === channel || channels.includes(c)) : channels,
  })
}
function resetBranch(type: NotificationCatalogType) {
  if (!form.value || scope.value === 'org') return
  const id = String(scope.value)
  const { [type.key]: _removed, ...rest } = form.value.location_types[id] ?? {}
  void _removed
  form.value.location_types = { ...form.value.location_types, [id]: rest }
}
function channelAvailable(channel: NotificationChannel): boolean {
  if (channel === 'push') return !!settings.value?.push_available
  if (channel === 'whatsapp') return !!form.value?.whatsapp.enabled
  return true
}
const whatsappTypes = computed(
  () =>
    settings.value?.catalog.filter(
      (type) => !type.direct && orgChoice(type).channels.includes('whatsapp'),
    ) ?? [],
)
function whatsappTemplate(key: string) {
  if (!form.value) return { name: '', params: [] as string[] }
  form.value.whatsapp.templates[key] ??= { name: '', params: [] }
  return form.value.whatsapp.templates[key]
}
function typeName(key: string): string {
  return te(`notificationSettings.typeNames.${key}`)
    ? t(`notificationSettings.typeNames.${key}`)
    : key
}

async function save() {
  if (!form.value) return
  saving.value = true
  error.value = null
  try {
    apply(
      await tenantApi.notificationSettings.update({
        ...form.value,
        sms_sender_id: form.value.sms_sender_id?.trim() || null,
      }),
    )
    toast.add({ severity: 'success', summary: t('notificationSettings.saved'), life: 3000 })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'"><Skeleton height="48px" /></SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('notificationSettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else-if="settings && form" class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.email') }}
      </div>
      <SettingRow
        :label="t('notificationSettings.fromLabel')"
        :help="t('notificationSettings.fromHelp')"
      >
        <span>{{ settings.email.from_name }}</span>
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.replyLabel')"
        :help="t('notificationSettings.replyHelp')"
      >
        <span dir="ltr">{{ settings.email.reply_to ?? '—' }}</span>
      </SettingRow>

      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.sms') }}
      </div>
      <SettingRow
        :label="t('notificationSettings.senderLabel')"
        :help="
          settings.sms.sender_id_allowed
            ? t('notificationSettings.senderHelp', { platform: settings.sms.platform_sender })
            : t('notificationSettings.senderNotAllowed', { platform: settings.sms.platform_sender })
        "
        label-for="sms-sender"
      >
        <InputText
          id="sms-sender"
          v-model="form.sms_sender_id"
          maxlength="11"
          dir="ltr"
          :placeholder="settings.sms.platform_sender"
          :disabled="!canEdit || !settings.sms.sender_id_allowed"
        />
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.smsUsageLabel')"
        :help="
          settings.sms_usage.limit === null
            ? t('notificationSettings.smsUsageNoLimit')
            : settings.sms_usage.hard
              ? t('notificationSettings.smsUsageHard')
              : t('notificationSettings.smsUsageSoft')
        "
      >
        <div class="usage">
          <span class="num">{{
            settings.sms_usage.limit === null
              ? t('notificationSettings.smsUsed', { used: settings.sms_usage.used })
              : t('notificationSettings.smsUsedOf', {
                  used: settings.sms_usage.used,
                  limit: settings.sms_usage.limit,
                })
          }}</span>
          <ProgressBar
            v-if="settings.sms_usage.limit !== null"
            :value="Math.min(100, settings.sms_usage.percent ?? 0)"
            :show-value="false"
            :class="[
              'usage__bar',
              {
                'usage__bar--warn': (settings.sms_usage.percent ?? 0) >= 80,
                'usage__bar--full': settings.sms_usage.reached,
              },
            ]"
            :aria-label="t('notificationSettings.smsUsageLabel')"
          />
          <span v-if="settings.sms_usage.skipped" class="muted small">{{
            t('notificationSettings.smsSkipped', settings.sms_usage.skipped)
          }}</span>
          <span v-if="settings.sms_usage.history.length > 1" class="muted small">
            {{
              settings.sms_usage.history
                .slice(1)
                .map((h) => `${h.month}: ${h.segments}`)
                .join(' · ')
            }}
          </span>
        </div>
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.counterLabel')"
        :help="t('notificationSettings.counterHelp')"
        label-for="sms-sample"
      >
        <div class="counter">
          <Textarea id="sms-sample" v-model="sample" rows="3" auto-resize />
          <span class="muted small">
            {{
              t('notificationSettings.count', {
                characters: count.characters,
                segments: count.segments,
                encoding: count.encoding,
              })
            }}
          </span>
        </div>
      </SettingRow>

      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.push') }}
      </div>
      <SettingRow
        :label="t('notificationSettings.pushLabel')"
        :help="t('notificationSettings.pushHelp')"
      >
        <Tag
          :severity="settings.push_available ? 'success' : 'secondary'"
          :value="
            settings.push_available
              ? t('notificationSettings.pushReady')
              : t('notificationSettings.pushNotSetUp')
          "
        />
      </SettingRow>

      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.whatsapp') }}
      </div>
      <SettingRow
        :label="t('notificationSettings.whatsappLabel')"
        :help="t('notificationSettings.whatsappHelp')"
        label-for="wa-enabled"
      >
        <ToggleSwitch v-model="form.whatsapp.enabled" input-id="wa-enabled" :disabled="!canEdit" />
      </SettingRow>
      <template v-if="form.whatsapp.enabled">
        <p v-if="!whatsappTypes.length" class="muted small">
          {{ t('notificationSettings.whatsappNone') }}
        </p>
        <SettingRow
          v-for="type in whatsappTypes"
          :key="type.key"
          :label="typeName(type.key)"
          :help="t('notificationSettings.whatsappTemplateHelp')"
          :label-for="`wa-${type.key}`"
        >
          <div class="wa-template">
            <InputText
              :id="`wa-${type.key}`"
              v-model="whatsappTemplate(type.key).name"
              dir="ltr"
              :placeholder="t('notificationSettings.whatsappTemplateName')"
              :disabled="!canEdit"
            />
            <MultiSelect
              v-model="whatsappTemplate(type.key).params"
              :options="type.variables"
              :placeholder="t('notificationSettings.whatsappParams')"
              :disabled="!canEdit"
              display="chip"
              :aria-label="t('notificationSettings.whatsappParams')"
            />
          </div>
        </SettingRow>
      </template>
    </SettingsCard>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.timing') }}
      </div>
      <SettingRow
        :label="t('notificationSettings.remindersLabel')"
        :help="t('notificationSettings.remindersHelp')"
        label-for="reminder-hours"
      >
        <MultiSelect
          v-model="form.reminder_hours"
          input-id="reminder-hours"
          :options="reminderOptions"
          option-label="label"
          option-value="value"
          :selection-limit="3"
          display="chip"
          :placeholder="t('notificationSettings.noReminders')"
          :disabled="!canEdit"
        />
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.expiryLabel')"
        :help="t('notificationSettings.expiryHelp')"
        label-for="expiry-days"
      >
        <InputNumber
          v-model="form.expiry_notice_days"
          input-id="expiry-days"
          :min="0"
          :max="60"
          :allow-empty="false"
          :suffix="` ${t('notificationSettings.days')}`"
          show-buttons
          :disabled="!canEdit"
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.quietLabel')"
        :help="t('notificationSettings.quietHelp')"
        label-for="quiet-enabled"
      >
        <div class="quiet">
          <ToggleSwitch
            v-model="form.quiet_hours.enabled"
            input-id="quiet-enabled"
            :disabled="!canEdit"
          />
          <template v-if="form.quiet_hours.enabled">
            <TimeField
              v-model="form.quiet_hours.start"
              :disabled="!canEdit"
              :aria-label="t('notificationSettings.quietFrom')"
            />
            <span class="muted">–</span>
            <TimeField
              v-model="form.quiet_hours.end"
              :disabled="!canEdit"
              :aria-label="t('notificationSettings.quietTo')"
            />
          </template>
        </div>
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.combineLabel')"
        :help="t('notificationSettings.combineHelp')"
        label-for="combine"
      >
        <InputNumber
          v-model="form.combine_minutes"
          input-id="combine"
          :min="0"
          :max="30"
          :allow-empty="false"
          :suffix="` ${t('notificationSettings.minutes')}`"
          show-buttons
          :disabled="!canEdit"
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('notificationSettings.retentionLabel')"
        :help="t('notificationSettings.retentionHelp')"
        label-for="retention"
      >
        <InputNumber
          v-model="form.log_retention_months"
          input-id="retention"
          :min="1"
          :max="60"
          :allow-empty="false"
          :suffix="` ${t('notificationSettings.months')}`"
          show-buttons
          :disabled="!canEdit"
          class="number"
        />
      </SettingRow>
    </SettingsCard>

    <SettingsCard>
      <div class="types-head">
        <div>
          <div class="settings-group" role="heading" aria-level="3">
            {{ t('notificationSettings.types') }}
          </div>
          <p class="muted small">{{ t('notificationSettings.typesHelp') }}</p>
        </div>
        <Select
          v-model="scope"
          :options="scopeOptions"
          option-label="label"
          option-value="value"
          :aria-label="t('notificationSettings.scope')"
          class="scope"
        />
      </div>
      <Message v-if="scope !== 'org'" severity="info" :closable="false">{{
        t('notificationSettings.branchHelp')
      }}</Message>
      <template v-for="[area, types] in areas" :key="area">
        <h4 class="area">{{ t(`notificationSettings.areas.${area}`) }}</h4>
        <ul class="types">
          <li v-for="type in types" :key="type.key">
            <div class="type-name">
              <span>{{ typeName(type.key) }}</span>
              <span class="muted small">
                <template v-if="type.direct">{{ t('notificationSettings.direct') }}</template>
                <template v-else-if="type.timing === 'reminder_hours'">{{
                  form.reminder_hours.length
                    ? t('notificationSettings.timingReminders', {
                        hours: form.reminder_hours.join(' · '),
                      })
                    : t('notificationSettings.noReminders')
                }}</template>
                <template v-else-if="type.timing === 'expiry_days'">{{
                  t('notificationSettings.timingExpiry', { days: form.expiry_notice_days })
                }}</template>
              </span>
            </div>
            <div class="type-controls">
              <Tag
                v-if="type.mandatory"
                severity="secondary"
                :value="t('notificationSettings.alwaysOn')"
              />
              <template v-if="!type.direct">
                <Tag
                  v-if="branchOverride(type)"
                  severity="info"
                  :value="t('notificationSettings.branchSetting')"
                />
                <Button
                  v-if="branchOverride(type) && canEdit"
                  :label="t('notificationSettings.useOrg')"
                  variant="text"
                  size="small"
                  @click="resetBranch(type)"
                />
                <span class="channels">
                  <label
                    v-for="c in CHANNELS"
                    :key="c"
                    class="channel"
                    :class="{ unavailable: !channelAvailable(c) }"
                  >
                    <Checkbox
                      binary
                      :model-value="effective(type).channels.includes(c)"
                      :disabled="!canEdit || !effective(type).enabled || !channelAvailable(c)"
                      @update:model-value="(v: boolean) => toggleChannel(type, c, v)"
                    />
                    {{ t(`notificationSettings.channels.${c}`) }}
                  </label>
                </span>
                <ToggleSwitch
                  :model-value="effective(type).enabled"
                  :disabled="!canEdit || type.mandatory"
                  :aria-label="typeName(type.key)"
                  @update:model-value="(v: boolean) => change(type, { enabled: v })"
                />
              </template>
            </div>
          </li>
        </ul>
      </template>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="form = JSON.parse(saved)"
      @save="save"
    />
  </form>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.counter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 280px;
}
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
}
.number {
  max-width: 180px;
}
.quiet {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.quiet :deep(.p-datepicker) {
  width: 110px;
}
.wa-template {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.types-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.scope {
  min-width: 220px;
}
.area {
  margin: 16px 0 4px;
  font: var(--text-small);
  font-weight: 600;
  color: var(--text-muted);
}
.types {
  list-style: none;
  margin: 0;
  padding: 0;
}
.types li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-default);
  flex-wrap: wrap;
}
.type-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.type-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.channels {
  display: flex;
  gap: 12px;
}
.channel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
}
.channel.unavailable {
  color: var(--text-muted);
}
.usage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}
.usage__bar {
  height: 8px;
}
.usage__bar--warn :deep(.p-progressbar-value) {
  background: var(--sev-warn-solid);
}
.usage__bar--full :deep(.p-progressbar-value) {
  background: var(--sev-danger-solid, var(--red-600));
}
</style>
