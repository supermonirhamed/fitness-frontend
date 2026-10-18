<script setup lang="ts">
// Trial trainings of a group (US-10.15): booked at the desk into one upcoming training, free or at
// the program's price; afterwards the coach notes how it went with a suggested level or group, and
// the family can be sent an "Enroll now" message.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ClientPicker from '@/components/academy/ClientPicker.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyGroup,
  type AcademyGroupDetails,
  type AcademyTrial,
  type ProgramLevel,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ group: AcademyGroupDetails }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canBook = computed(() => auth.can('academy.enroll'))
const canNote = computed(
  () =>
    auth.can('academy.update') || (props.group.coaches ?? []).some((c) => c.id === auth.user?.id),
)
const open = computed(() => props.group.trial_rules.enabled && props.group.accepts_trials)

const state = ref<'loading' | 'ready' | 'error'>('loading')
const trials = ref<AcademyTrial[]>([])
async function load() {
  state.value = 'loading'
  try {
    trials.value = await tenantApi.academy.groups.trials(props.group.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const action = ref<'book' | 'note' | null>(null)
const dialogOpen = computed({
  get: () => action.value !== null,
  set: (v: boolean) => {
    if (!v) action.value = null
  },
})
const target = ref<AcademyTrial | null>(null)
const client = ref<{ id: number; name: string } | null>(null)
const sessionId = ref<number | null>(null)
const note = ref('')
const levelId = ref<number | null>(null)
const groupId = ref<number | null>(null)
const followUp = ref(true)
const levels = ref<ProgramLevel[]>([])
const groups = ref<AcademyGroup[]>([])
const saving = ref(false)
const formError = ref<string | null>(null)
const sessionOptions = computed(() =>
  props.group.upcoming
    .filter((s) => s.status !== 'Cancelled')
    .map((s) => ({
      id: s.id,
      label: `${format.date(s.starts_at)} · ${format.time(s.starts_at)} (${s.booked}/${s.capacity ?? '∞'})`,
    })),
)

async function start(next: 'book' | 'note', trial: AcademyTrial | null = null) {
  action.value = next
  target.value = trial
  client.value = null
  sessionId.value = null
  note.value = trial?.coach_note ?? ''
  levelId.value = trial?.suggested_level?.id ?? null
  groupId.value = trial?.suggested_group?.id ?? null
  followUp.value = !trial?.follow_up_sent_at
  formError.value = null
  if (next === 'note') {
    if (!levels.value.length)
      levels.value = await tenantApi.academy.levels.list(props.group.program_id).catch(() => [])
    if (!groups.value.length)
      groups.value = await tenantApi.academy.groups
        .list({ program_id: props.group.program_id })
        .catch(() => [])
  }
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    if (action.value === 'book' && client.value && sessionId.value) {
      await tenantApi.academy.groups.bookTrial(props.group.id, {
        client_id: client.value.id,
        session_id: sessionId.value,
      })
      toast.add({ severity: 'success', summary: t('academy.trials.booked'), life: 3000 })
    } else if (action.value === 'note' && target.value) {
      await tenantApi.academy.trials.note(target.value.id, {
        coach_note: note.value.trim() || null,
        suggested_level_id: levelId.value,
        suggested_group_id: groupId.value,
        send_follow_up: followUp.value,
      })
      toast.add({
        severity: 'success',
        summary: followUp.value ? t('academy.trials.followUpSent') : t('academy.trials.noted'),
        life: 3000,
      })
    }
    action.value = null
    await load()
    emit('changed')
  } catch (e) {
    formError.value =
      Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card">
    <header class="head">
      <div>
        <strong>{{ t('academy.trials.title') }}</strong>
        <p class="muted small">
          {{
            !group.trial_rules.enabled
              ? t('academy.trials.disabledProgram')
              : !group.accepts_trials
                ? t('academy.trials.disabledGroup')
                : group.trial_rules.price > 0
                  ? t('academy.trials.paid', {
                      price: format.money(group.trial_rules.price),
                      n: group.trial_rules.max_per_child,
                    })
                  : t('academy.trials.free', { n: group.trial_rules.max_per_child })
          }}
        </p>
      </div>
      <Button
        v-if="canBook && open"
        :label="t('academy.trials.book')"
        icon="pi pi-plus"
        size="small"
        :disabled="!sessionOptions.length"
        @click="start('book')"
      />
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="state === 'ready' && !trials.length"
      compact
      icon="pi-star"
      :title="t('academy.trials.none')"
    />
    <ul v-else class="list">
      <li v-for="tr in trials" :key="tr.id" class="item">
        <div class="who">
          <strong>{{ tr.client?.name }}</strong>
          <span class="muted small">
            {{
              tr.session
                ? `${format.date(tr.session.starts_at)} · ${format.time(tr.session.starts_at)}`
                : ''
            }}
            <template v-if="tr.invoice">
              · <span dir="ltr">{{ tr.invoice.number }}</span></template
            >
          </span>
          <span v-if="tr.coach_note" class="small">“{{ tr.coach_note }}” — {{ tr.noted_by }}</span>
          <span v-if="tr.suggested_group || tr.suggested_level" class="small">
            {{ t('academy.trials.suggested') }}:
            {{ tr.suggested_group?.display_name ?? tr.suggested_level?.display_name }}
          </span>
        </div>
        <StatusTag v-if="tr.booking_status" :status="tr.booking_status" size="sm" />
        <Tag
          v-if="tr.follow_up_sent_at"
          severity="success"
          :value="t('academy.trials.followedUp')"
        />
        <Button
          v-if="canNote"
          :label="tr.noted_at ? t('common.edit') : t('academy.trials.addNote')"
          size="small"
          variant="text"
          @click="start('note', tr)"
        />
      </li>
    </ul>

    <FormDialog
      v-model:visible="dialogOpen"
      :title="action === 'book' ? t('academy.trials.book') : t('academy.trials.noteTitle')"
      :subtitle="target?.client?.name ?? group.display_name ?? undefined"
      icon="pi-star"
      :saving="saving"
      :save-disabled="action === 'book' && (!client || !sessionId)"
      :error="formError"
      @save="submit"
    >
      <template v-if="action === 'book'">
        <FormField :label="t('academy.enroll.player')" for="trial-client" required>
          <ClientPicker v-model="client" input-id="trial-client" />
        </FormField>
        <FormField :label="t('academy.trials.training')" for="trial-session" required>
          <Select
            v-model="sessionId"
            input-id="trial-session"
            :options="sessionOptions"
            option-label="label"
            option-value="id"
            fluid
          />
        </FormField>
        <small class="muted">{{ t('academy.trials.hint') }}</small>
      </template>
      <template v-else>
        <FormField :label="t('academy.trials.note')" for="trial-note">
          <Textarea id="trial-note" v-model="note" rows="3" maxlength="2000" auto-resize fluid />
        </FormField>
        <div class="row">
          <FormField :label="t('academy.transfer.toLevel')" for="trial-level">
            <Select
              v-model="levelId"
              input-id="trial-level"
              :options="levels"
              option-label="display_name"
              option-value="id"
              show-clear
              fluid
            />
          </FormField>
          <FormField :label="t('academy.transfer.toGroup')" for="trial-group">
            <Select
              v-model="groupId"
              input-id="trial-group"
              :options="groups"
              option-label="display_name"
              option-value="id"
              show-clear
              filter
              fluid
            />
          </FormField>
        </div>
        <label class="radio">
          <Checkbox v-model="followUp" binary />
          <span>{{ t('academy.trials.sendFollowUp') }}</span>
        </label>
      </template>
    </FormDialog>
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
.head p {
  margin: 2px 0 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 16px 8px;
}
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
}
.who {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 200px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.radio {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
