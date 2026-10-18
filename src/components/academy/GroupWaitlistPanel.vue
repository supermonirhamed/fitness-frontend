<script setup lang="ts">
// A group's waiting list (US-10.11): families in order, the one offered a place with its deadline.
// Staff add children when the group is full, move one up or down with a reason, enroll the family
// that accepted, or record a decline (the place is then offered to the next).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ClientPicker from '@/components/academy/ClientPicker.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type AcademyGroup, type AcademyWaitlistEntry } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ group: AcademyGroup }>()
const emit = defineEmits<{ enroll: [entry: AcademyWaitlistEntry]; changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const canEnroll = computed(() => auth.can('academy.enroll'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const entries = ref<AcademyWaitlistEntry[]>([])
const open = computed(() => entries.value.filter((e) => e.rank !== null))
const closed = computed(() => entries.value.filter((e) => e.rank === null))
async function load() {
  state.value = 'loading'
  try {
    entries.value = await tenantApi.academy.groups.waitlist(props.group.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
defineExpose({ load })

type Action = 'add' | 'move' | 'decline' | 'remove'
const action = ref<Action | null>(null)
const target = ref<AcademyWaitlistEntry | null>(null)
const dialogOpen = computed({
  get: () => action.value !== null,
  set: (v: boolean) => {
    if (!v) action.value = null
  },
})
const client = ref<{ id: number; name: string } | null>(null)
const rank = ref(1)
const note = ref('')
const saving = ref(false)
const formError = ref<string | null>(null)

function start(next: Action, entry: AcademyWaitlistEntry | null = null) {
  action.value = next
  target.value = entry
  client.value = null
  rank.value = entry?.rank ?? 1
  note.value = ''
  formError.value = null
}

async function submit() {
  saving.value = true
  formError.value = null
  try {
    if (action.value === 'add' && client.value) {
      await tenantApi.academy.groups.joinWaitlist(props.group.id, {
        client_id: client.value.id,
        note: note.value.trim() || null,
      })
      toast.add({ severity: 'success', summary: t('academy.waitlist.added'), life: 3000 })
    } else if (action.value === 'move' && target.value) {
      await tenantApi.academy.waitlist.rank(target.value.id, {
        rank: rank.value,
        reason: note.value.trim(),
      })
    } else if ((action.value === 'decline' || action.value === 'remove') && target.value) {
      await tenantApi.academy.waitlist.close(target.value.id, {
        status: action.value === 'decline' ? 'Declined' : 'Removed',
        note: note.value.trim() || null,
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
const titles: Record<Action, string> = {
  add: 'academy.waitlist.addTitle',
  move: 'academy.waitlist.moveTitle',
  decline: 'academy.waitlist.declineTitle',
  remove: 'academy.waitlist.removeTitle',
}
</script>

<template>
  <div class="card">
    <header class="head">
      <div>
        <strong>{{ t('academy.waitlist.count', { n: open.length }) }}</strong>
        <p v-if="!group.waitlist_enabled" class="muted small">
          {{ t('academy.waitlist.disabled') }}
        </p>
      </div>
      <Button
        v-if="canEnroll && group.waitlist_enabled"
        :label="t('academy.waitlist.add')"
        icon="pi pi-plus"
        size="small"
        :disabled="group.free > 0"
        :title="group.free > 0 ? t('academy.waitlist.hasPlaces') : undefined"
        @click="start('add')"
      />
    </header>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="state === 'ready' && !entries.length"
      compact
      icon="pi-clock"
      :title="t('academy.waitlist.none')"
      :body="t('academy.waitlist.noneHint')"
    />
    <ol v-else class="list">
      <li v-for="e in open" :key="e.id" class="entry">
        <span class="rank num">{{ e.rank }}</span>
        <div class="who">
          <strong>{{ e.client?.name }}</strong>
          <span class="muted small">
            <template v-if="e.client?.age != null"
              >{{ t('academy.roster.age', { n: e.client.age }) }} ·
            </template>
            {{ e.payer?.name }}
            ·
            {{
              t('academy.waitlist.joined', { date: e.created_at ? format.date(e.created_at) : '' })
            }}
          </span>
          <span v-if="e.note" class="small">{{ e.note }}</span>
        </div>
        <Tag
          v-if="e.status === 'Offered'"
          severity="warn"
          :value="
            t('academy.waitlist.offeredUntil', {
              date: e.offer_expires_at ? format.dateTime(e.offer_expires_at) : '',
            })
          "
        />
        <div v-if="canEnroll" class="row-actions">
          <Button
            v-if="e.status === 'Offered' || group.free > 0"
            :label="t('academy.waitlist.enroll')"
            size="small"
            @click="emit('enroll', e)"
          />
          <Button
            v-if="e.status === 'Offered'"
            :label="t('academy.waitlist.declined')"
            size="small"
            variant="text"
            severity="secondary"
            @click="start('decline', e)"
          />
          <Button
            icon="pi pi-sort"
            size="small"
            variant="text"
            severity="secondary"
            :aria-label="t('academy.waitlist.moveTitle')"
            @click="start('move', e)"
          />
          <Button
            icon="pi pi-times"
            size="small"
            variant="text"
            severity="secondary"
            :aria-label="t('academy.waitlist.removeTitle')"
            @click="start('remove', e)"
          />
        </div>
      </li>
      <li v-for="e in closed" :key="e.id" class="entry closed">
        <span class="rank" aria-hidden="true">–</span>
        <div class="who">
          <span>{{ e.client?.name }}</span>
          <span class="muted small">{{ e.responded_at ? format.date(e.responded_at) : '' }}</span>
        </div>
        <StatusTag :status="e.status" size="sm" />
      </li>
    </ol>

    <FormDialog
      v-model:visible="dialogOpen"
      :title="action ? t(titles[action]) : ''"
      :subtitle="target?.client?.name ?? group.display_name ?? undefined"
      icon="pi-clock"
      :danger="action === 'remove'"
      :saving="saving"
      :save-disabled="(action === 'add' && !client) || (action === 'move' && !note.trim())"
      :error="formError"
      @save="submit"
    >
      <FormField
        v-if="action === 'add'"
        :label="t('academy.enroll.player')"
        for="wl-client"
        required
      >
        <ClientPicker v-model="client" input-id="wl-client" />
      </FormField>
      <FormField
        v-if="action === 'move'"
        :label="t('academy.waitlist.newRank')"
        for="wl-rank"
        required
      >
        <InputNumber
          v-model="rank"
          input-id="wl-rank"
          :min="1"
          :max="open.length"
          show-buttons
          fluid
        />
      </FormField>
      <FormField
        :label="action === 'move' ? t('academy.waitlist.moveReason') : t('academy.waitlist.note')"
        for="wl-note"
        :required="action === 'move'"
      >
        <InputText id="wl-note" v-model="note" maxlength="500" fluid />
      </FormField>
      <small v-if="action === 'decline'" class="muted">{{
        t('academy.waitlist.declineHint')
      }}</small>
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
.entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
}
.entry.closed {
  color: var(--text-secondary);
}
.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-ground, var(--primary-50));
  font-weight: 700;
}
.who {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 180px;
}
.row-actions {
  display: flex;
  gap: 4px;
}
.num {
  font-variant-numeric: tabular-nums;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
