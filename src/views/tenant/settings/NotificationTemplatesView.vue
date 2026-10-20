<script setup lang="ts">
// Settings → Message templates (US-12.06): the text of each notification per channel (email
// subject and body, SMS, push title and body) in Arabic and English. Variables are inserted from
// the type's list and unknown ones are refused; the preview fills them with sample data, a test
// goes to the signed-in user, and each text can go back to its default. A type with no text in a
// language is flagged: the other language is sent (US-12.10).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import {
  tenantApi,
  type NotificationTemplateType,
  type RenderedTemplate,
  type TemplateChannel,
  type TemplateDraft,
} from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { smsCount } from '@/lib/sms'
import { useStaffAuth } from '@/stores/staffAuth'

type Locale = 'ar' | 'en'

const { t, te } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const types = ref<NotificationTemplateType[]>([])
const areas = computed(() => {
  const groups = new Map<string, NotificationTemplateType[]>()
  for (const type of types.value) groups.set(type.area, [...(groups.get(type.area) ?? []), type])
  return [...groups.entries()]
})

async function load() {
  state.value = 'loading'
  try {
    types.value = await tenantApi.notificationTemplates.list()
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

function typeName(key: string): string {
  return te(`notificationSettings.typeNames.${key}`)
    ? t(`notificationSettings.typeNames.${key}`)
    : key
}
function customized(type: NotificationTemplateType): boolean {
  return Object.values(type.parts).some((byLocale) => Object.values(byLocale).some((p) => p.custom))
}

// The editor.
const open = ref(false)
const editing = ref<NotificationTemplateType | null>(null)
const channel = ref<TemplateChannel>('email')
const locale = ref<Locale>('ar')
const draft = ref<Record<TemplateChannel, Record<Locale, { subject: string; body: string }>>>()
const original = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const preview = ref<Record<Locale, RenderedTemplate> | null>(null)
const channelOptions = computed(() =>
  (['email', 'sms', 'push'] as TemplateChannel[]).map((c) => ({
    value: c,
    label: t(`notificationSettings.channels.${c}`),
  })),
)
const localeOptions = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
]
const part = computed(() => draft.value?.[channel.value][locale.value])
const hasSubject = computed(() => channel.value !== 'sms')
const unknown = computed(() => {
  if (!editing.value || !part.value) return []
  const allowed = new Set(editing.value.variables)
  const found = `${part.value.subject} ${part.value.body}`.match(/\{([^{}\s]*)\}/g) ?? []
  return [...new Set(found.map((v) => v.slice(1, -1)).filter((v) => !allowed.has(v)))]
})
const sms = computed(() => smsCount(part.value?.body ?? ''))
const changed = computed(() => {
  if (!draft.value) return []
  const before = JSON.parse(original.value)
  const list: { channel: TemplateChannel; locale: Locale }[] = []
  for (const c of ['email', 'sms', 'push'] as TemplateChannel[])
    for (const l of ['ar', 'en'] as Locale[])
      if (JSON.stringify(draft.value[c][l]) !== JSON.stringify(before[c][l]))
        list.push({ channel: c, locale: l })
  return list
})
const currentPart = computed(() => editing.value?.parts[channel.value][locale.value])

function edit(type: NotificationTemplateType) {
  editing.value = type
  const fill = (c: TemplateChannel) => ({
    ar: { subject: type.parts[c].ar.subject ?? '', body: type.parts[c].ar.body ?? '' },
    en: { subject: type.parts[c].en.subject ?? '', body: type.parts[c].en.body ?? '' },
  })
  draft.value = { email: fill('email'), sms: fill('sms'), push: fill('push') }
  original.value = JSON.stringify(draft.value)
  channel.value = 'email'
  error.value = null
  preview.value = null
  open.value = true
  refreshPreview()
}

function draftPayload(): TemplateDraft {
  const out: TemplateDraft = {}
  for (const { channel: c, locale: l } of changed.value) {
    const p = draft.value![c][l]
    if (!p.body.trim()) continue
    out[c] = { ...out[c], [l]: { subject: p.subject || null, body: p.body } }
  }
  return out
}

const refreshPreview = useDebounceFn(async () => {
  if (!editing.value || unknown.value.length) return
  try {
    preview.value = await tenantApi.notificationTemplates.preview(editing.value.key, draftPayload())
  } catch {
    preview.value = null
  }
}, 400)
watch(draft, () => refreshPreview(), { deep: true })

const bodyField = ref<{ $el: HTMLTextAreaElement } | null>(null)
function insert(variable: string) {
  if (!part.value) return
  const el = bodyField.value?.$el
  const text = `{${variable}}`
  if (el && typeof el.selectionStart === 'number') {
    const at = el.selectionStart
    part.value.body = part.value.body.slice(0, at) + text + part.value.body.slice(el.selectionEnd)
  } else part.value.body += text
}

async function save() {
  if (!editing.value || !draft.value) return
  saving.value = true
  error.value = null
  try {
    for (const { channel: c, locale: l } of changed.value) {
      const p = draft.value[c][l]
      if (!p.body.trim()) continue
      types.value = await tenantApi.notificationTemplates.update(editing.value.key, {
        channel: c,
        locale: l,
        subject: c === 'sms' ? null : p.subject || null,
        body: p.body,
      })
    }
    open.value = false
    toast.add({ severity: 'success', summary: t('notificationTemplates.saved'), life: 3000 })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}

async function reset() {
  if (!editing.value) return
  try {
    types.value = await tenantApi.notificationTemplates.reset(
      editing.value.key,
      channel.value,
      locale.value,
    )
    const fresh = types.value.find((x) => x.key === editing.value!.key)
    if (fresh && draft.value) {
      const p = fresh.parts[channel.value][locale.value]
      draft.value[channel.value][locale.value] = { subject: p.subject ?? '', body: p.body ?? '' }
      const before = JSON.parse(original.value)
      before[channel.value][locale.value] = draft.value[channel.value][locale.value]
      original.value = JSON.stringify(before)
      editing.value = fresh
    }
    toast.add({ severity: 'success', summary: t('notificationTemplates.resetDone'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  }
}

const testing = ref(false)
async function sendTest() {
  if (!editing.value) return
  testing.value = true
  try {
    await tenantApi.notificationTemplates.test(
      editing.value.key,
      channel.value,
      locale.value,
      draftPayload(),
    )
    toast.add({ severity: 'success', summary: t('notificationTemplates.testSent'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'warn',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 5000,
    })
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'"><Skeleton height="48px" /></SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('notificationTemplates.loadError')" @retry="load" />
  </SettingsCard>
  <SettingsCard v-else>
    <p class="muted small">{{ t('notificationTemplates.help') }}</p>
    <template v-for="[area, list] in areas" :key="area">
      <h4 class="area">{{ t(`notificationSettings.areas.${area}`) }}</h4>
      <ul class="types">
        <li v-for="type in list" :key="type.key">
          <span class="name">
            {{ typeName(type.key) }}
            <Tag
              v-if="customized(type)"
              severity="info"
              :value="t('notificationTemplates.customized')"
            />
            <Tag
              v-for="l in type.missing"
              :key="l"
              severity="warn"
              icon="pi pi-exclamation-triangle"
              :value="
                t('notificationTemplates.missing', {
                  language: t(`notificationTemplates.languages.${l}`),
                })
              "
            />
          </span>
          <Button
            :label="canEdit ? t('common.edit') : t('notificationTemplates.view')"
            :icon="canEdit ? 'pi pi-pencil' : 'pi pi-eye'"
            variant="text"
            size="small"
            @click="edit(type)"
          />
        </li>
      </ul>
    </template>
  </SettingsCard>

  <FormDrawer
    v-model:visible="open"
    size="lg"
    :title="editing ? typeName(editing.key) : ''"
    :subtitle="t('notificationTemplates.drawerSubtitle')"
    :saving="saving"
    :save-disabled="!canEdit || !changed.length || unknown.length > 0"
    :error="error"
    @save="save"
  >
    <template v-if="editing && part">
      <div class="switches">
        <SelectButton
          v-model="channel"
          :options="channelOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('notificationTemplates.channel')"
        />
        <SelectButton
          v-model="locale"
          :options="localeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :aria-label="t('notificationTemplates.language')"
        />
      </div>
      <Message v-if="channel === 'push'" severity="secondary" :closable="false">{{
        t('notificationTemplates.pushHelp')
      }}</Message>
      <FormField
        v-if="hasSubject"
        :label="
          channel === 'email'
            ? t('notificationTemplates.subject')
            : t('notificationTemplates.title')
        "
        for="tpl-subject"
      >
        <InputText
          id="tpl-subject"
          v-model="part.subject"
          :dir="locale === 'ar' ? 'rtl' : 'ltr'"
          :disabled="!canEdit"
          maxlength="255"
        />
      </FormField>
      <FormField
        :label="
          channel === 'email' ? t('notificationTemplates.body') : t('notificationTemplates.text')
        "
        for="tpl-body"
        :error="
          unknown.length
            ? t('notificationTemplates.unknown', { names: unknown.map((v) => `{${v}}`).join(', ') })
            : undefined
        "
      >
        <Textarea
          id="tpl-body"
          ref="bodyField"
          v-model="part.body"
          :rows="channel === 'email' ? 8 : 4"
          auto-resize
          :dir="locale === 'ar' ? 'rtl' : 'ltr'"
          :disabled="!canEdit"
          :invalid="unknown.length > 0"
        />
        <span v-if="channel === 'sms'" class="muted small">{{
          t('notificationSettings.count', {
            characters: sms.characters,
            segments: sms.segments,
            encoding: sms.encoding,
          })
        }}</span>
      </FormField>
      <div class="variables">
        <span class="muted small">{{ t('notificationTemplates.variables') }}</span>
        <div class="chips">
          <Button
            v-for="v in editing.variables"
            :key="v"
            :label="`{${v}}`"
            size="small"
            severity="secondary"
            variant="outlined"
            :disabled="!canEdit"
            dir="ltr"
            @click="insert(v)"
          />
        </div>
      </div>
      <p v-if="currentPart?.custom" class="muted small">
        {{
          t('notificationTemplates.customBy', {
            name: currentPart.updated_by ?? '—',
          })
        }}
      </p>

      <section class="preview" :aria-label="t('notificationTemplates.preview')">
        <h4>{{ t('notificationTemplates.preview') }}</h4>
        <div v-if="!preview" class="muted small">{{ t('common.loading') }}</div>
        <div v-else class="previews">
          <article v-for="l in ['ar', 'en'] as const" :key="l" :dir="l === 'ar' ? 'rtl' : 'ltr'">
            <span class="muted small">{{ t(`notificationTemplates.languages.${l}`) }}</span>
            <template v-if="channel === 'email'">
              <strong>{{ preview[l].subject }}</strong>
              <p class="pre">{{ preview[l].body }}</p>
            </template>
            <p v-else-if="channel === 'sms'" class="pre">{{ preview[l].sms }}</p>
            <template v-else>
              <strong>{{ preview[l].push_title }}</strong>
              <p class="pre">{{ preview[l].push_body }}</p>
            </template>
          </article>
        </div>
      </section>
    </template>
    <template #footer-start>
      <Button
        v-if="canEdit && currentPart?.custom"
        :label="t('notificationTemplates.reset')"
        icon="pi pi-undo"
        severity="secondary"
        variant="text"
        @click="reset"
      />
      <Button
        v-if="canEdit && channel !== 'push'"
        :label="t('notificationTemplates.test')"
        icon="pi pi-send"
        severity="secondary"
        variant="text"
        :loading="testing"
        :disabled="unknown.length > 0"
        @click="sendTest"
      />
    </template>
  </FormDrawer>
</template>

<style scoped>
.muted {
  color: var(--text-muted);
}
.small {
  font: var(--text-small);
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
  padding: 6px 0;
  border-bottom: 1px solid var(--border-default);
}
.name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.switches {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
}
.variables {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.preview h4 {
  margin: 8px 0;
  font: var(--text-small);
  font-weight: 600;
}
.previews {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.previews article {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-subtle, var(--surface-hover));
}
.pre {
  margin: 0;
  white-space: pre-wrap;
}
</style>
