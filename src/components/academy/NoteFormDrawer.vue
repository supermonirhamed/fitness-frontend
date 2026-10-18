<script setup lang="ts">
// A coach's note about a player (US-10.17): which player (from the group, unless given), the
// training it is about if any, a category, who sees it — staff only, or shared with the guardians
// — and the text. Editing keeps the player.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type AcademyNote, type AcademyNoteCategory } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{
  note: AcademyNote | null
  /** The player, when fixed (their enrollment or profile). */
  client?: { id: number; name: string } | null
  /** Players to choose from (a group's roster). */
  players?: { id: number; name: string }[]
  groupId?: number | null
  /** Trainings it may be about (the group's recent ones). */
  sessions?: { id: number; starts_at: string }[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [note: AcademyNote] }>()
const { t } = useI18n()
const format = useFormat()

const clientId = ref<number | null>(null)
const sessionId = ref<number | null>(null)
const category = ref<AcademyNoteCategory>('general')
const visibility = ref<'internal' | 'shared'>('internal')
const body = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const categories = computed(() =>
  (['technical', 'behaviour', 'fitness', 'injury', 'general'] as const).map((c) => ({
    value: c,
    label: t(`academy.notes.categories.${c}`),
  })),
)
const visibilities = computed(() => [
  { value: 'internal', label: t('academy.notes.internal') },
  { value: 'shared', label: t('academy.notes.shared') },
])
const sessionOptions = computed(() =>
  (props.sessions ?? []).map((s) => ({
    id: s.id,
    label: `${format.date(s.starts_at)} · ${format.time(s.starts_at)}`,
  })),
)

watch(visible, (open) => {
  if (!open) return
  clientId.value = props.note?.client.id ?? props.client?.id ?? null
  sessionId.value = props.note?.session?.id ?? null
  category.value = props.note?.category ?? 'general'
  visibility.value = props.note?.visibility ?? 'internal'
  body.value = props.note?.body ?? ''
  error.value = null
})

async function save() {
  saving.value = true
  error.value = null
  try {
    const values = {
      category: category.value,
      visibility: visibility.value,
      body: body.value.trim(),
    }
    const saved = props.note
      ? await tenantApi.academy.notes.update(props.note.id, values)
      : await tenantApi.academy.notes.create({
          ...values,
          client_id: clientId.value!,
          academy_group_id: props.groupId ?? null,
          scheduled_session_id: sessionId.value,
        })
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    error.value =
      Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="note ? t('academy.notes.editTitle') : t('academy.notes.newTitle')"
    :subtitle="note?.client.name ?? client?.name"
    :saving="saving"
    :save-disabled="!clientId || !body.trim()"
    :error="error"
    @save="save"
  >
    <FormField
      v-if="!note && !client"
      :label="t('academy.roster.player')"
      for="note-player"
      required
    >
      <Select
        v-model="clientId"
        input-id="note-player"
        :options="players ?? []"
        option-label="name"
        option-value="id"
        filter
        fluid
      />
    </FormField>
    <FormField
      v-if="!note && sessionOptions.length"
      :label="t('academy.notes.training')"
      for="note-session"
    >
      <Select
        v-model="sessionId"
        input-id="note-session"
        :options="sessionOptions"
        option-label="label"
        option-value="id"
        show-clear
        fluid
      />
    </FormField>
    <FormField :label="t('academy.notes.category')" for="note-category" required>
      <Select
        v-model="category"
        input-id="note-category"
        :options="categories"
        option-label="label"
        option-value="value"
        fluid
      />
    </FormField>
    <FormField
      :label="t('academy.notes.visibility')"
      :help="
        visibility === 'shared' ? t('academy.notes.sharedHint') : t('academy.notes.internalHint')
      "
    >
      <SelectButton
        v-model="visibility"
        :options="visibilities"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
    </FormField>
    <FormField :label="t('academy.notes.text')" for="note-body" required>
      <Textarea id="note-body" v-model="body" rows="6" maxlength="5000" auto-resize fluid />
    </FormField>
    <small v-if="category === 'injury'" class="muted">{{ t('academy.notes.injuryHint') }}</small>
  </FormDrawer>
</template>

<style scoped>
.muted {
  color: var(--text-secondary);
}
</style>
