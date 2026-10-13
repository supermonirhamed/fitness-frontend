<script setup lang="ts">
// Internal notes (US-05.11, brief 06 §3): pinned notes on top, each with author, date and a
// visibility badge (all staff / managers / only me). Never shown to the client. The author edits
// (earlier text kept, "edited" opens the history); the author or a manager deletes.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type ClientNote } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ clientId: number }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const notes = ref<ClientNote[]>([])
async function load() {
  state.value = 'loading'
  try {
    notes.value = await tenantApi.clients.notes(props.clientId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.clientId, load, { immediate: true })

const visibilityOptions = computed(() =>
  (['all', 'managers', 'me'] as const).map((v) => ({
    value: v,
    label: t(`notes.visibility.${v}`),
  })),
)
const SEVERITY = { all: 'secondary', managers: 'info', me: 'contrast' } as const
const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })

// Compose / edit
const draft = ref({ body: '', visibility: 'all' as ClientNote['visibility'], pinned: false })
const editing = ref<ClientNote | null>(null)
const saving = ref(false)
function startEdit(note: ClientNote) {
  editing.value = note
  draft.value = { body: note.body, visibility: note.visibility, pinned: note.pinned }
}
function cancelEdit() {
  editing.value = null
  draft.value = { body: '', visibility: 'all', pinned: false }
}
async function save() {
  if (!draft.value.body.trim()) return
  saving.value = true
  try {
    const input = { ...draft.value, body: draft.value.body.trim() }
    if (editing.value) await tenantApi.clients.updateNote(editing.value.id, input)
    else await tenantApi.clients.addNote(props.clientId, input)
    cancelEdit()
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}
async function togglePin(note: ClientNote) {
  try {
    await tenantApi.clients.updateNote(note.id, {
      body: note.body,
      visibility: note.visibility,
      pinned: !note.pinned,
    })
    await load()
  } catch (e) {
    fail(e)
  }
}
async function remove(note: ClientNote) {
  try {
    await tenantApi.clients.deleteNote(note.id)
    await load()
  } catch (e) {
    fail(e)
  }
}

const historyOpen = ref(false)
const history = ref<Awaited<ReturnType<typeof tenantApi.clients.noteHistory>>>([])
async function showHistory(note: ClientNote) {
  history.value = await tenantApi.clients.noteHistory(note.id).catch(() => [])
  historyOpen.value = true
}
</script>

<template>
  <div class="stack">
    <div class="card compose">
      <Textarea
        v-model="draft.body"
        rows="3"
        auto-resize
        maxlength="5000"
        :placeholder="t('notes.placeholder')"
        :aria-label="t('notes.placeholder')"
      />
      <div class="compose__bar">
        <Select
          v-model="draft.visibility"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          :aria-label="t('notes.visibilityLabel')"
        />
        <label class="pin"><ToggleSwitch v-model="draft.pinned" /> {{ t('notes.pin') }}</label>
        <span class="grow" />
        <Button
          v-if="editing"
          :label="t('common.cancel')"
          variant="text"
          severity="secondary"
          @click="cancelEdit"
        />
        <Button
          :label="editing ? t('common.save') : t('notes.add')"
          :loading="saving"
          :disabled="!draft.body.trim()"
          @click="save"
        />
      </div>
      <small class="muted"
        ><i class="pi pi-lock" aria-hidden="true" /> {{ t('notes.private') }}</small
      >
    </div>

    <div v-if="state === 'loading'" class="card pad"><Skeleton height="60px" /></div>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('notes.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!notes.length"
      class="card"
      compact
      icon="pi-comment"
      :title="t('notes.empty')"
    />
    <ul v-else class="list">
      <li v-for="n in notes" :key="n.id" :class="['card', 'note', { pinned: n.pinned }]">
        <div class="note__head">
          <i v-if="n.pinned" class="pi pi-thumbtack pinned-icon" :aria-label="t('notes.pinned')" />
          <strong>{{ n.author }}</strong>
          <small class="muted">{{ n.created_at ? format.dateTime(n.created_at) : '' }}</small>
          <button v-if="n.edited" type="button" class="link" @click="showHistory(n)">
            {{ t('notes.edited') }}
          </button>
          <span class="grow" />
          <Tag
            class="tag-sm"
            :severity="SEVERITY[n.visibility]"
            :value="t(`notes.visibility.${n.visibility}`)"
          />
        </div>
        <p class="note__body">{{ n.body }}</p>
        <div v-if="n.can_edit || n.can_delete" class="note__actions">
          <Button
            size="small"
            variant="text"
            :icon="n.pinned ? 'pi pi-times' : 'pi pi-thumbtack'"
            :label="n.pinned ? t('notes.unpin') : t('notes.pin')"
            @click="togglePin(n)"
          />
          <Button
            v-if="n.can_edit"
            size="small"
            variant="text"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            @click="startEdit(n)"
          />
          <Button
            v-if="n.can_delete"
            size="small"
            variant="text"
            severity="danger"
            icon="pi pi-trash"
            :label="t('notes.delete')"
            @click="remove(n)"
          />
        </div>
      </li>
    </ul>
  </div>

  <Dialog
    v-model:visible="historyOpen"
    modal
    :header="t('notes.history')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <ol class="history">
      <li v-for="(h, i) in history" :key="i">
        <small class="muted">{{
          t('notes.before', { name: h.edited_by, date: format.dateTime(h.edited_at) })
        }}</small>
        <p>{{ h.body }}</p>
      </li>
    </ol>
  </Dialog>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.compose {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.compose__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.pin {
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
}
.grow {
  flex: 1;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.note {
  padding: 12px 16px;
}
.note.pinned {
  border-color: var(--primary);
}
.note__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pinned-icon {
  color: var(--primary);
}
.note__body {
  margin: 8px 0 0;
  white-space: pre-wrap;
}
.note__actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--text-link);
  cursor: pointer;
  font: var(--text-small);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.history p {
  margin: 4px 0 0;
  white-space: pre-wrap;
}
</style>
