<script setup lang="ts">
// A player's enrollment in a group: who pays, dates, fee terms, pauses, invoices and upcoming
// trainings, with the desk's actions — pause (US-10.13), withdraw with a reason (US-10.13),
// transfer to another group (US-10.12), a coach's recommendation to move (US-10.12), and reporting
// an absence before a training (US-10.16).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import NoteFormDrawer from '@/components/academy/NoteFormDrawer.vue'
import NotesList from '@/components/academy/NotesList.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyEnrollmentDetails,
  type AcademyGroup,
  type AcademyNote,
  type AcademyRecommendation,
  type ProgramLevel,
} from '@/api/tenant'
import { addDays, fromYmd, showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ enrollmentId: number | null; group: AcademyGroup }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [] }>()
const { t, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const canEnroll = computed(() => auth.can('academy.enroll'))
const isCoach = computed(() => props.group.coaches?.some((c) => c.id === auth.user?.id) ?? false)

const state = ref<'loading' | 'ready' | 'error'>('loading')
const e = ref<AcademyEnrollmentDetails | null>(null)
const current = computed(() => !!e.value && ['Active', 'Suspended'].includes(e.value.status))
const day = (ymd: string | null) => (ymd ? showDay(format, ymd) : '—')

// The player's coach notes in this group (US-10.17).
const notes = ref<AcademyNote[]>([])
const noteOpen = ref(false)
const noteEditing = ref<AcademyNote | null>(null)
async function loadNotes() {
  if (!e.value?.client) return
  notes.value = (await tenantApi.academy.notes.forClient(e.value.client.id).catch(() => [])).filter(
    (n) => !n.group || n.group.id === props.group.id,
  )
}
function openNote(note: AcademyNote | null) {
  noteEditing.value = note
  noteOpen.value = true
}
async function resolveNote(note: AcademyNote) {
  await tenantApi.academy.notes.resolve(note.id).catch(() => null)
  loadNotes()
}

async function load() {
  if (!props.enrollmentId) return
  state.value = 'loading'
  try {
    e.value = await tenantApi.academy.enrollments.get(props.enrollmentId)
    state.value = 'ready'
    loadNotes()
  } catch {
    state.value = 'error'
  }
}
watch([visible, () => props.enrollmentId], ([open]) => {
  if (open) load()
})

// One dialog for the actions.
type Action = 'pause' | 'withdraw' | 'transfer' | 'recommend' | 'excuse'
const action = ref<Action | null>(null)
const dialogOpen = computed({
  get: () => action.value !== null,
  set: (v: boolean) => {
    if (!v) action.value = null
  },
})
const saving = ref(false)
const formError = ref<string | null>(null)
const from = ref<Date | null>(null)
const until = ref<Date | null>(null)
const reason = ref<string | null>(null)
const note = ref('')
const groups = ref<AcademyGroup[]>([])
const levels = ref<ProgramLevel[]>([])
const targetGroup = ref<number | null>(null)
const targetLevel = ref<number | null>(null)
const confirmAge = ref(false)
const overrideCapacity = ref(false)
const recommendation = ref<AcademyRecommendation | null>(null)
const excuseFor = ref<AcademyEnrollmentDetails['upcoming'][number] | null>(null)

const endReasons = computed(() =>
  ['schedule', 'cost', 'moved', 'not_enjoying', 'injury', 'other_activity', 'coach', 'other'].map(
    (r) => ({ value: r, label: t(`academy.withdraw.reasons.${r}`) }),
  ),
)
const otherGroups = computed(() =>
  groups.value.filter((g) => g.id !== props.group.id && g.status !== 'Archived'),
)
const titles: Record<Action, string> = {
  pause: 'academy.pause.title',
  withdraw: 'academy.withdraw.title',
  transfer: 'academy.transfer.title',
  recommend: 'academy.transfer.recommendTitle',
  excuse: 'academy.absence.title',
}

async function open(next: Action, rec: AcademyRecommendation | null = null) {
  formError.value = null
  from.value = null
  until.value = null
  reason.value = null
  note.value = ''
  targetGroup.value = rec?.to_group?.id ?? null
  targetLevel.value = null
  confirmAge.value = false
  overrideCapacity.value = false
  recommendation.value = rec
  action.value = next
  if ((next === 'transfer' || next === 'recommend') && !groups.value.length) {
    groups.value = await tenantApi.academy.groups
      .list({ program_id: props.group.program_id })
      .catch(() => [])
  }
  if (next === 'recommend' && !levels.value.length) {
    levels.value = await tenantApi.academy.levels.list(props.group.program_id).catch(() => [])
  }
  if (next === 'pause') {
    from.value = new Date()
    until.value = fromYmd(addDays(isoDay(new Date()), (e.value?.pause_rules.min_days ?? 7) - 1))
  }
}

async function submit() {
  if (!e.value || !action.value) return
  saving.value = true
  formError.value = null
  try {
    if (action.value === 'pause') {
      await tenantApi.academy.enrollments.pause(e.value.id, {
        starts_on: isoDay(from.value!),
        ends_on: isoDay(until.value!),
        reason: note.value.trim() || null,
      })
      toast.add({ severity: 'success', summary: t('academy.pause.done'), life: 3000 })
    } else if (action.value === 'withdraw') {
      const result = await tenantApi.academy.enrollments.withdraw(e.value.id, {
        from: from.value ? isoDay(from.value) : null,
        reason: reason.value!,
        note: note.value.trim() || null,
      })
      toast.add({
        severity: 'success',
        summary: t('academy.withdraw.done', { n: result.cancelled }),
        detail: result.refund.credited
          ? t('academy.withdraw.credited', { amount: format.money(result.refund.credited) })
          : result.refund.policy === 'manual'
            ? t('academy.withdraw.manual')
            : undefined,
        life: 6000,
      })
    } else if (action.value === 'transfer') {
      const result = await tenantApi.academy.enrollments.transfer(e.value.id, {
        group_id: targetGroup.value!,
        effective_on: from.value ? isoDay(from.value) : null,
        override: overrideCapacity.value ? ['capacity'] : [],
        reason: note.value.trim() || null,
        confirm_age: confirmAge.value,
        recommendation_id: recommendation.value?.id ?? null,
      })
      toast.add({
        severity: 'success',
        summary: t('academy.transfer.done', { n: result.booked }),
        detail: result.fee.charged
          ? t('academy.transfer.charged', { amount: format.money(result.fee.charged) })
          : result.fee.credited
            ? t('academy.transfer.credited', { amount: format.money(result.fee.credited) })
            : undefined,
        life: 6000,
      })
    } else if (action.value === 'recommend') {
      await tenantApi.academy.enrollments.recommend(e.value.id, {
        to_group_id: targetGroup.value,
        to_level_id: targetLevel.value,
        note: note.value.trim() || null,
      })
      toast.add({ severity: 'success', summary: t('academy.transfer.recommended'), life: 3000 })
    } else if (action.value === 'excuse' && excuseFor.value) {
      await tenantApi.roster.excuse(excuseFor.value.session_id, excuseFor.value.booking_id, {
        excused: !excuseFor.value.excused,
        reason: note.value.trim() || null,
      })
    }
    action.value = null
    emit('changed')
    load()
  } catch (err) {
    const fields = validationErrors(err)
    formError.value = Object.values(fields)[0]?.[0] ?? apiMessage(err) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}

async function endPause(pauseId: number) {
  try {
    await tenantApi.academy.enrollments.endPause(pauseId)
    toast.add({ severity: 'success', summary: t('academy.pause.ended'), life: 3000 })
    emit('changed')
    load()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: apiMessage(err) ?? t('common.genericError'),
      life: 4000,
    })
  }
}

async function reject(rec: AcademyRecommendation) {
  try {
    await tenantApi.academy.recommendations.reject(rec.id)
    load()
    emit('changed')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: apiMessage(err) ?? t('common.genericError'),
      life: 4000,
    })
  }
}

function excuse(item: AcademyEnrollmentDetails['upcoming'][number]) {
  excuseFor.value = item
  open('excuse')
}

const saveDisabled = computed(() => {
  switch (action.value) {
    case 'pause':
      return !from.value || !until.value
    case 'withdraw':
      return !reason.value
    case 'transfer':
      return !targetGroup.value
    case 'recommend':
      return !targetGroup.value && !targetLevel.value
    default:
      return false
  }
})
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    class="drawer-lg"
    :header="e?.client?.name ?? t('academy.roster.player')"
  >
    <div v-if="state === 'loading'" class="stack" aria-busy="true">
      <Skeleton height="24px" width="60%" /><Skeleton height="80px" />
    </div>
    <ErrorState v-else-if="state === 'error' || !e" compact @retry="load" />
    <div v-else class="stack">
      <div class="head">
        <StatusTag :status="e.display_status" />
        <span class="muted">{{
          e.client?.age != null ? t('academy.roster.age', { n: e.client.age }) : ''
        }}</span>
        <RouterLink v-if="e.client" :to="{ name: 'tenant.client', params: { id: e.client.id } }">
          {{ t('academy.roster.profile') }}
        </RouterLink>
      </div>
      <dl class="facts">
        <dt>{{ t('academy.enroll.payer') }}</dt>
        <dd>
          <RouterLink v-if="e.payer" :to="{ name: 'tenant.client', params: { id: e.payer.id } }">{{
            e.payer.name
          }}</RouterLink>
          <span v-else>{{ e.client?.name }}</span>
        </dd>
        <dt>{{ t('academy.roster.dates') }}</dt>
        <dd>
          {{ day(e.starts_on) }} –
          {{
            e.ended_on ? day(e.ended_on) : e.ends_on ? day(e.ends_on) : t('academy.roster.ongoing')
          }}
        </dd>
        <dt>{{ t('academy.roster.fee') }}</dt>
        <dd>
          {{ t(`academySettings.models.${e.fee?.model ?? 'none'}`) }}
          <span v-if="e.fee && e.fee.model !== 'none'" class="num"
            >· {{ format.money(e.fee.amount) }}</span
          >
          <span v-if="e.next_bill_on" class="muted">
            · {{ t('academy.roster.nextBill', { date: day(e.next_bill_on) }) }}</span
          >
        </dd>
        <template v-if="e.end_reason">
          <dt>{{ t('academy.roster.endReason') }}</dt>
          <dd>
            {{
              e.end_reason === 'transfer'
                ? t('academy.transfer.title')
                : t(`academy.withdraw.reasons.${e.end_reason}`)
            }}<span v-if="e.end_note"> · {{ e.end_note }}</span>
          </dd>
        </template>
        <template v-if="e.overrides">
          <dt>{{ t('academy.roster.overrides') }}</dt>
          <dd>
            {{ e.overrides.checks.map((c) => t(`academy.enroll.checks.${c}`)).join('، ') }} ·
            {{ e.overrides.reason }}
          </dd>
        </template>
      </dl>

      <div v-if="current && (canEnroll || isCoach)" class="actions">
        <template v-if="canEnroll">
          <Button
            :label="t('academy.transfer.title')"
            icon="pi pi-arrow-right-arrow-left"
            size="small"
            severity="secondary"
            @click="open('transfer')"
          />
          <Button
            v-if="e.pause_rules.enabled"
            :label="t('academy.pause.title')"
            icon="pi pi-pause"
            size="small"
            severity="secondary"
            @click="open('pause')"
          />
          <Button
            :label="t('academy.withdraw.title')"
            icon="pi pi-sign-out"
            size="small"
            severity="danger"
            variant="outlined"
            @click="open('withdraw')"
          />
        </template>
        <Button
          v-if="isCoach || canEnroll"
          :label="t('academy.transfer.recommend')"
          icon="pi pi-thumbs-up"
          size="small"
          variant="text"
          @click="open('recommend')"
        />
      </div>

      <section>
        <div class="section-head">
          <h3>{{ t('academy.notes.title') }}</h3>
          <Button
            v-if="current && (isCoach || auth.can('academy.update'))"
            :label="t('academy.notes.add')"
            icon="pi pi-plus"
            size="small"
            variant="text"
            @click="openNote(null)"
          />
        </div>
        <p v-if="!notes.length" class="muted">{{ t('academy.notes.noneForPlayer') }}</p>
        <NotesList
          v-else
          :notes="notes"
          :can-resolve="isCoach || auth.can('academy.update')"
          @edit="openNote"
          @resolve="resolveNote"
        />
      </section>

      <section v-if="e.recommendations.length">
        <h3>{{ t('academy.transfer.recommendations') }}</h3>
        <div v-for="r in e.recommendations" :key="r.id" class="item">
          <div>
            <strong>{{ r.to_group?.display_name ?? r.to_level?.display_name }}</strong>
            <span class="muted small">
              · {{ r.recommended_by }} · {{ r.created_at ? format.date(r.created_at) : '' }}</span
            >
            <p v-if="r.note" class="note">{{ r.note }}</p>
          </div>
          <Tag
            v-if="r.status !== 'Pending'"
            :value="t(`academy.transfer.statuses.${r.status}`)"
            severity="secondary"
          />
          <div v-else-if="canEnroll && current" class="row-actions">
            <Button
              :label="t('academy.transfer.approve')"
              size="small"
              @click="open('transfer', r)"
            />
            <Button
              :label="t('academy.transfer.reject')"
              size="small"
              variant="text"
              severity="secondary"
              @click="reject(r)"
            />
          </div>
        </div>
      </section>

      <section v-if="e.pauses?.length">
        <h3>{{ t('academy.pause.list') }}</h3>
        <div v-for="p in e.pauses" :key="p.id" class="item">
          <span class="num">{{ day(p.starts_on) }} – {{ day(p.ends_on) }}</span>
          <span class="muted small">{{ p.reason }}</span>
          <Tag v-if="p.ended_early" :value="t('academy.pause.endedEarly')" severity="secondary" />
          <Button
            v-else-if="
              canEnroll && p.starts_on <= isoDay(new Date()) && p.ends_on >= isoDay(new Date())
            "
            :label="t('academy.pause.end')"
            size="small"
            variant="text"
            @click="endPause(p.id)"
          />
        </div>
      </section>

      <section>
        <h3>{{ t('academy.roster.invoices') }}</h3>
        <p v-if="!e.invoices.length" class="muted">{{ t('academy.roster.noInvoices') }}</p>
        <div v-for="inv in e.invoices" :key="inv.id" class="item">
          <span class="num" dir="ltr">{{ inv.number }}</span>
          <span class="muted small">{{ t('academy.roster.due', { date: day(inv.due_on) }) }}</span>
          <span class="num">{{ format.money(inv.total) }}</span>
          <StatusTag :status="inv.status" size="sm" />
        </div>
        <RouterLink
          v-if="
            e.invoices.some((i) => i.status === 'Due' || i.status === 'PartiallyPaid') &&
            auth.can('payments.create')
          "
          :to="{
            name: 'tenant.client',
            params: { id: e.invoices[0]?.client_id ?? e.payer?.id ?? e.client?.id ?? 0 },
            query: { tab: 'payments' },
          }"
        >
          {{ t('academy.roster.takePayment') }}
        </RouterLink>
      </section>

      <section>
        <h3>{{ t('academy.groups.upcoming') }}</h3>
        <p v-if="!e.upcoming.length" class="muted">{{ t('academy.roster.noUpcoming') }}</p>
        <div v-for="b in e.upcoming" :key="b.booking_id" class="item">
          <RouterLink :to="{ name: 'tenant.session', params: { id: b.session_id } }" class="num">
            {{ format.date(b.starts_at) }} · {{ format.time(b.starts_at) }}
          </RouterLink>
          <Tag v-if="b.excused" :value="t('roster.excused')" severity="secondary" />
          <span v-if="b.excuse_reason" class="muted small">{{ b.excuse_reason }}</span>
          <Button
            v-if="auth.can('attendance.update') && b.status === 'Confirmed'"
            :label="b.excused ? t('academy.absence.withdraw') : t('academy.absence.report')"
            size="small"
            variant="text"
            @click="excuse(b)"
          />
        </div>
      </section>
    </div>
  </Drawer>

  <FormDialog
    v-model:visible="dialogOpen"
    :title="action ? t(titles[action]) : ''"
    :subtitle="e?.client?.name"
    :icon="action === 'withdraw' ? 'pi-sign-out' : 'pi-user'"
    :danger="action === 'withdraw'"
    :saving="saving"
    :save-disabled="saveDisabled"
    :save-label="
      action === 'excuse' && excuseFor?.excused ? t('academy.absence.withdraw') : undefined
    "
    :error="formError"
    @save="submit"
  >
    <template v-if="action === 'pause' && e">
      <p class="muted">
        {{
          t('academy.pause.rules', {
            min: e.pause_rules.min_days,
            max: e.pause_rules.max_days,
            n: e.pause_rules.max_per_term,
          })
        }}
        <template v-if="!e.pause_rules.keeps_place"> {{ t('academy.pause.freesPlace') }}</template>
      </p>
      <div class="row">
        <FormField :label="t('academy.pause.from')" for="pause-from" required>
          <DatePicker v-model="from" input-id="pause-from" :min-date="new Date()" show-icon fluid />
        </FormField>
        <FormField :label="t('academy.pause.until')" for="pause-until" required>
          <DatePicker
            v-model="until"
            input-id="pause-until"
            :min-date="from ?? new Date()"
            show-icon
            fluid
          />
        </FormField>
      </div>
      <FormField :label="t('academy.pause.reason')" for="pause-reason">
        <InputText id="pause-reason" v-model="note" maxlength="500" fluid />
      </FormField>
    </template>

    <template v-else-if="action === 'withdraw' && e">
      <FormField :label="t('academy.withdraw.reason')" for="wd-reason" required>
        <Select
          v-model="reason"
          input-id="wd-reason"
          :options="endReasons"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
      <FormField
        :label="t('academy.withdraw.from')"
        for="wd-from"
        :help="t('academy.withdraw.fromHint')"
      >
        <DatePicker v-model="from" input-id="wd-from" :min-date="new Date()" show-icon fluid />
      </FormField>
      <FormField :label="t('academy.withdraw.note')" for="wd-note">
        <Textarea id="wd-note" v-model="note" rows="2" maxlength="500" auto-resize fluid />
      </FormField>
      <Message severity="secondary" :closable="false">{{
        t(`academy.withdraw.refund.${e.refund_policy}`)
      }}</Message>
    </template>

    <template v-else-if="action === 'transfer'">
      <FormField :label="t('academy.transfer.to')" for="tr-group" required>
        <Select
          v-model="targetGroup"
          input-id="tr-group"
          :options="otherGroups"
          :option-label="
            (g: AcademyGroup) => `${g.display_name} · ${g.location?.name ?? ''} (${g.free})`
          "
          option-value="id"
          filter
          fluid
        />
      </FormField>
      <FormField
        :label="t('academy.transfer.from')"
        for="tr-from"
        :help="t('academy.transfer.fromHint')"
      >
        <DatePicker v-model="from" input-id="tr-from" :min-date="new Date()" show-icon fluid />
      </FormField>
      <FormField :label="t('academy.transfer.reason')" for="tr-reason">
        <InputText id="tr-reason" v-model="note" maxlength="500" fluid />
      </FormField>
      <label v-if="auth.can('academy.override_age')" class="radio">
        <Checkbox v-model="confirmAge" binary />
        <span>{{ t('academy.transfer.confirmAge') }}</span>
      </label>
      <label v-if="auth.can('academy.override')" class="radio">
        <Checkbox v-model="overrideCapacity" binary />
        <span>{{ t('academy.transfer.overrideCapacity') }}</span>
      </label>
      <small class="muted">{{ t('academy.transfer.hint') }}</small>
    </template>

    <template v-else-if="action === 'recommend'">
      <FormField :label="t('academy.transfer.toGroup')" for="rec-group">
        <Select
          v-model="targetGroup"
          input-id="rec-group"
          :options="otherGroups"
          option-label="display_name"
          option-value="id"
          show-clear
          filter
          fluid
        />
      </FormField>
      <FormField :label="t('academy.transfer.toLevel')" for="rec-level">
        <Select
          v-model="targetLevel"
          input-id="rec-level"
          :options="levels"
          option-label="display_name"
          option-value="id"
          show-clear
          fluid
        />
      </FormField>
      <FormField :label="t('academy.transfer.why')" for="rec-note">
        <Textarea id="rec-note" v-model="note" rows="3" maxlength="1000" auto-resize fluid />
      </FormField>
    </template>

    <template v-else-if="action === 'excuse' && excuseFor">
      <p>{{ format.date(excuseFor.starts_at) }} · {{ format.time(excuseFor.starts_at) }}</p>
      <FormField v-if="!excuseFor.excused" :label="t('academy.absence.reason')" for="abs-reason">
        <InputText id="abs-reason" v-model="note" maxlength="500" fluid />
      </FormField>
      <small class="muted">{{ t('academy.absence.hint') }}</small>
    </template>
  </FormDialog>
  <NoteFormDrawer
    v-if="e?.client"
    v-model:visible="noteOpen"
    :note="noteEditing"
    :client="{ id: e.client.id, name: e.client.name }"
    :group-id="group.id"
    @saved="loadNotes"
  />
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.facts {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px 16px;
  margin: 0;
}
.facts dt {
  color: var(--text-secondary);
}
.facts dd {
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
section h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 6px;
}
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-default);
}
.item > div:first-child {
  flex: 1;
}
.row-actions {
  display: flex;
  gap: 4px;
}
.note {
  margin: 4px 0 0;
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
.num {
  font-variant-numeric: tabular-nums;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
@media (max-width: 520px) {
  .facts,
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
