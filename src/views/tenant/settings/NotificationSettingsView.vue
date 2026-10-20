<script setup lang="ts">
// Settings → Notifications (EP-12): emails go out under the organization's name and reply to the
// branch (US-12.02); SMS use the organization's sender ID where the provider allows it, with a
// counter showing how a text is split and billed (US-12.03); and each notification type with its
// channels (made editable by US-12.07).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type NotificationSettings } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { smsCount } from '@/lib/sms'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const settings = ref<NotificationSettings | null>(null)
const senderId = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const dirty = computed(() => senderId.value.trim() !== (settings.value?.sms_sender_id ?? ''))
const sample = ref('')
const count = computed(() => smsCount(sample.value))
const areas = computed(() => {
  const groups = new Map<string, NotificationSettings['types']>()
  for (const type of settings.value?.types ?? [])
    groups.set(type.area, [...(groups.get(type.area) ?? []), type])
  return [...groups.entries()]
})

function apply(data: NotificationSettings) {
  settings.value = data
  senderId.value = data.sms_sender_id ?? ''
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

async function save() {
  saving.value = true
  error.value = null
  try {
    apply(
      await tenantApi.notificationSettings.update({ sms_sender_id: senderId.value.trim() || null }),
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
  <form v-else-if="settings" class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
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
          v-model="senderId"
          maxlength="11"
          dir="ltr"
          :placeholder="settings.sms.platform_sender"
          :disabled="!canEdit || !settings.sms.sender_id_allowed"
          :invalid="!!error"
        />
      </SettingRow>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
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
    </SettingsCard>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('notificationSettings.types') }}
      </div>
      <p class="muted small">{{ t('notificationSettings.typesHelp') }}</p>
      <template v-for="[area, types] in areas" :key="area">
        <h4 class="area">{{ t(`notificationSettings.areas.${area}`) }}</h4>
        <ul class="types">
          <li v-for="type in types" :key="type.key">
            <span>{{ t(`notificationSettings.typeNames.${type.key}`) }}</span>
            <span class="channels">
              <Tag
                v-if="!type.enabled"
                severity="secondary"
                :value="t('notificationSettings.off')"
              />
              <template v-else>
                <Tag
                  v-for="c in type.channels"
                  :key="c"
                  severity="info"
                  :value="t(`notificationSettings.channels.${c}`)"
                />
              </template>
            </span>
          </li>
        </ul>
      </template>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="senderId = settings.sms_sender_id ?? ''"
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
.area {
  margin: 12px 0 4px;
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
  padding: 8px 0;
  border-bottom: 1px solid var(--border-default);
}
.channels {
  display: flex;
  gap: 6px;
}
</style>
