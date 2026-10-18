<script setup lang="ts">
// A group's coach notes (US-10.17): every note about its players, filtered by category, and a new
// note for one of them, optionally about a recent training.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Select from 'primevue/select'
import NoteFormDrawer from '@/components/academy/NoteFormDrawer.vue'
import NotesList from '@/components/academy/NotesList.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type AcademyGroupDetails, type AcademyNote } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ group: AcademyGroupDetails }>()
const { t } = useI18n()
const auth = useStaffAuth()
const canWrite = computed(
  () =>
    auth.can('academy.update') || (props.group.coaches ?? []).some((c) => c.id === auth.user?.id),
)

const state = ref<'loading' | 'ready' | 'error'>('loading')
const notes = ref<AcademyNote[]>([])
const category = ref<string | null>(null)
const shown = computed(() =>
  category.value ? notes.value.filter((n) => n.category === category.value) : notes.value,
)
const categories = computed(() =>
  ['technical', 'behaviour', 'fitness', 'injury', 'general'].map((c) => ({
    value: c,
    label: t(`academy.notes.categories.${c}`),
  })),
)
const players = computed(() =>
  props.group.roster
    .filter((e) => e.status === 'Active' || e.status === 'Suspended')
    .map((e) => ({ id: e.client!.id, name: e.client!.name })),
)
async function load() {
  state.value = 'loading'
  try {
    notes.value = await tenantApi.academy.notes.forGroup(props.group.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const formOpen = ref(false)
const editing = ref<AcademyNote | null>(null)
function open(note: AcademyNote | null = null) {
  editing.value = note
  formOpen.value = true
}
async function resolve(note: AcademyNote) {
  await tenantApi.academy.notes.resolve(note.id).catch(() => null)
  load()
}
</script>

<template>
  <div class="card">
    <header class="head">
      <Select
        v-model="category"
        :options="categories"
        option-label="label"
        option-value="value"
        :placeholder="t('academy.notes.allCategories')"
        show-clear
      />
      <Button
        v-if="canWrite && players.length"
        :label="t('academy.notes.add')"
        icon="pi pi-plus"
        size="small"
        @click="open()"
      />
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="state === 'ready' && !shown.length"
      compact
      icon="pi-comment"
      :title="t('academy.notes.none')"
      :body="t('academy.notes.noneHint')"
    />
    <div v-else class="body">
      <NotesList
        :notes="shown"
        show-player
        :can-resolve="canWrite"
        @edit="open"
        @resolve="resolve"
      />
    </div>
    <NoteFormDrawer
      v-model:visible="formOpen"
      :note="editing"
      :players="players"
      :group-id="group.id"
      :sessions="group.recent"
      @saved="load"
    />
  </div>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}
.body {
  padding: 0 16px 8px;
}
</style>
