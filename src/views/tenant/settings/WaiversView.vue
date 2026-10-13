<script setup lang="ts">
// Settings → Waivers (US-05.07, brief 06 §6): templates with their version and who must sign them
// (all clients, specific services, minors). The editor holds the name and who it is required for;
// the text changes by publishing a new version, which can ask existing clients to sign again.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import { tenantApi, type Translated, type WaiverTemplate } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { statusOf, validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const format = useFormat()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const templates = ref<WaiverTemplate[]>([])
const services = ref<{ id: number; name: string }[]>([])
async function load() {
  state.value = 'loading'
  try {
    templates.value = await tenantApi.waivers.list()
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(async () => {
  load()
  services.value = (await tenantApi.services.list().catch(() => [])).map((s) => ({
    id: s.id,
    name: s.display_name ?? '',
  }))
})

const REQUIRED_ICONS = { all: 'pi-users', services: 'pi-th-large', minors: 'pi-user' } as const
const requiredOptions = computed(() =>
  (['all', 'services', 'minors'] as const).map((v) => ({
    value: v,
    label: t(`waivers.requiredFor.${v}`),
    icon: REQUIRED_ICONS[v],
  })),
)

// Editor
const drawerOpen = ref(false)
const editing = ref<WaiverTemplate | null>(null)
const form = ref({
  name: { ar: '', en: '' } as Translated,
  required_for: 'all' as WaiverTemplate['required_for'],
  service_ids: [] as number[],
  content: { ar: '', en: '' } as Translated,
  archived: false,
})
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)
function open(template: WaiverTemplate | null) {
  editing.value = template
  form.value = {
    name: { ar: template?.name.ar ?? '', en: template?.name.en ?? '' },
    required_for: template?.required_for ?? 'all',
    service_ids: template?.services.map((s) => s.id) ?? [],
    content: { ar: '', en: '' },
    archived: template?.status === 'Archived',
  }
  errors.value = {}
  drawerOpen.value = true
}
const err = (field: string) => errors.value[field]?.[0]
async function save() {
  saving.value = true
  errors.value = {}
  try {
    const base = {
      name: form.value.name,
      required_for: form.value.required_for,
      service_ids: form.value.required_for === 'services' ? form.value.service_ids : [],
    }
    if (editing.value)
      await tenantApi.waivers.update(editing.value.id, {
        ...base,
        status: form.value.archived ? 'Archived' : 'Active',
      })
    else await tenantApi.waivers.create({ ...base, content: form.value.content })
    drawerOpen.value = false
    toast.add({ severity: 'success', summary: t('waivers.saved'), life: 3000 })
    load()
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length)
      toast.add({
        severity: 'error',
        summary: apiMessage(e) ?? t('common.genericError'),
        life: 4000,
      })
  } finally {
    saving.value = false
  }
}

// Publish a new version
const publishOpen = ref(false)
const publishing = ref<WaiverTemplate | null>(null)
const newContent = ref<Translated>({ ar: '', en: '' })
const resign = ref(false)
function openPublish(template: WaiverTemplate) {
  publishing.value = template
  newContent.value = { ar: template.content?.ar ?? '', en: template.content?.en ?? '' }
  resign.value = false
  errors.value = {}
  publishOpen.value = true
}
async function publish() {
  if (!publishing.value) return
  saving.value = true
  errors.value = {}
  try {
    await tenantApi.waivers.publish(publishing.value.id, newContent.value, resign.value)
    publishOpen.value = false
    toast.add({ severity: 'success', summary: t('waivers.published'), life: 3000 })
    load()
  } catch (e) {
    errors.value = validationErrors(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="stack">
    <div class="bar">
      <Message severity="info" :closable="false" class="grow">{{ t('waivers.intro') }}</Message>
      <Button v-if="canEdit" icon="pi pi-plus" :label="t('waivers.new')" @click="open(null)" />
    </div>

    <div v-if="state === 'loading'" class="card pad">
      <Skeleton v-for="n in 3" :key="n" height="48px" class="sk" />
    </div>
    <NoPermission v-else-if="state === 'forbidden'" class="card" />
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('waivers.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!templates.length"
      class="card"
      icon="pi-file-edit"
      :title="t('waivers.empty')"
      :body="t('waivers.emptyHint')"
    />
    <ul v-else class="card list">
      <li
        v-for="w in templates"
        :key="w.id"
        :class="['item', { archived: w.status === 'Archived' }]"
      >
        <div class="item__text">
          <span class="item__name">{{ w.display_name }}</span>
          <small class="muted">
            {{ t(`waivers.requiredFor.${w.required_for}`) }}
            <template v-if="w.required_for === 'services'"
              >· {{ w.services.map((s) => s.name).join(', ') }}</template
            >
            · {{ t('waivers.version', { n: w.version }) }}
            <template v-if="w.published_at">· {{ format.date(w.published_at) }}</template>
          </small>
        </div>
        <Tag
          v-if="w.status === 'Archived'"
          class="tag-sm"
          severity="secondary"
          :value="t('waivers.archived')"
        />
        <template v-if="canEdit">
          <Button
            size="small"
            variant="text"
            icon="pi pi-send"
            :label="t('waivers.newVersion')"
            @click="openPublish(w)"
          />
          <Button
            size="small"
            variant="text"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            @click="open(w)"
          />
        </template>
      </li>
    </ul>
  </div>

  <FormDialog
    v-model:visible="drawerOpen"
    :title="editing ? t('waivers.editTitle') : t('waivers.new')"
    :subtitle="editing ? editing.display_name : t('waivers.newHint')"
    icon="pi-file-edit"
    :size="editing ? 'md' : 'lg'"
    :saving="saving"
    @save="save"
  >
    <TranslatedField
      id="waiver-name"
      v-model="form.name"
      :label="t('waivers.name')"
      required
      :maxlength="120"
      :errors="{ any: err('name') ?? err('name.en') ?? err('name.ar') }"
    />
    <div class="field">
      <span id="waiver-for" class="field__label">{{ t('waivers.requiredForLabel') }}</span>
      <div class="choices" role="radiogroup" aria-labelledby="waiver-for">
        <button
          v-for="o in requiredOptions"
          :key="o.value"
          type="button"
          role="radio"
          :aria-checked="form.required_for === o.value"
          :class="['choice', { 'choice--on': form.required_for === o.value }]"
          @click="form.required_for = o.value"
        >
          <i :class="['pi', o.icon]" aria-hidden="true" />
          <span>{{ o.label }}</span>
        </button>
      </div>
    </div>
    <FormField
      v-if="form.required_for === 'services'"
      :label="t('waivers.services')"
      for="waiver-services"
      required
      :error="err('service_ids')"
    >
      <MultiSelect
        v-model="form.service_ids"
        input-id="waiver-services"
        :options="services"
        option-label="name"
        option-value="id"
        filter
        display="chip"
        fluid
        :placeholder="t('waivers.pickServices')"
        :invalid="!!err('service_ids')"
      />
    </FormField>
    <TranslatedField
      v-if="!editing"
      id="waiver-content"
      v-model="form.content"
      :label="t('waivers.text')"
      required
      multiline
      :maxlength="20000"
      :errors="{ any: err('content') ?? err('content.en') ?? err('content.ar') }"
    />
    <template v-else>
      <Message severity="secondary" :closable="false" icon="pi pi-info-circle" size="small">{{
        t('waivers.textByVersion')
      }}</Message>
      <div class="toggle">
        <ToggleSwitch v-model="form.archived" input-id="waiver-archived" />
        <label for="waiver-archived">{{ t('waivers.archive') }}</label>
      </div>
    </template>
  </FormDialog>

  <FormDialog
    v-model:visible="publishOpen"
    :title="t('waivers.newVersionOf', { name: publishing?.display_name })"
    :subtitle="publishing ? t('waivers.currentVersion', { n: publishing.version }) : ''"
    icon="pi-send"
    size="lg"
    :saving="saving"
    :save-label="t('waivers.publish')"
    @save="publish"
  >
    <TranslatedField
      id="waiver-new-content"
      v-model="newContent"
      :label="t('waivers.text')"
      required
      multiline
      :maxlength="20000"
      :errors="{ any: err('content') ?? err('content.en') ?? err('content.ar') }"
    />
    <div :class="['resign', { 'resign--on': resign }]">
      <div class="toggle">
        <ToggleSwitch v-model="resign" input-id="waiver-resign" />
        <label for="waiver-resign">{{ t('waivers.requireResign') }}</label>
      </div>
      <small class="muted">{{ resign ? t('waivers.resignOn') : t('waivers.resignOff') }}</small>
    </div>
  </FormDialog>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bar {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.grow {
  flex: 1;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.sk {
  margin-bottom: 8px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.item.archived {
  opacity: 0.6;
}
.item__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.item__name {
  font: 500 14px var(--font-sans);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font: var(--text-small);
  font-weight: 500;
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.choice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  font: 500 14px var(--font-sans);
  cursor: pointer;
  text-align: start;
}
.choice:hover {
  border-color: var(--border-strong);
}
.choice:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.choice--on {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 1px var(--primary-500);
  background: var(--primary-50);
}
.choice .pi {
  color: var(--primary-600);
}
.resign {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
}
.resign--on {
  border-color: var(--sev-warn-solid);
  background: var(--sev-warn-bg);
}
@media (max-width: 640px) {
  .choices {
    grid-template-columns: minmax(0, 1fr);
  }
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
