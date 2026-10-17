<script setup lang="ts">
// The session's roster for taking attendance (US-08.04), made for the coach's phone: each booked
// client with photo and alerts (first visit, health note, waiver), marked Present, Late, Absent or Excused (left out of attendance rates),
// "Mark all present", and a walk-in added subject to eligibility and capacity. Clients checked in
// at the desk are already Present. Coaches edit until the organization's limit after the session;
// later only managers. The coach starts and delivers the session here (US-08.07).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import { tenantApi, type Client, type EntitlementSource, type Roster } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ sessionId: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const roster = ref<Roster | null>(null)
async function load() {
  try {
    roster.value = await tenantApi.roster.get(props.sessionId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
defineExpose({ load })

const busy = ref(false)
async function act(action: () => Promise<Roster>) {
  busy.value = true
  try {
    roster.value = await action()
    emit('changed')
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    busy.value = false
  }
}
const marks = computed(() =>
  (['present', 'late', 'absent', 'excused'] as const).map((m) => ({
    value: m,
    label: t(`roster.${m}`),
  })),
)
const mark = (bookingId: number, value: 'present' | 'late' | 'absent' | 'excused' | null) =>
  value && act(() => tenantApi.roster.mark(props.sessionId, bookingId, value))
const markAll = () => act(() => tenantApi.roster.markAll(props.sessionId))
const deliver = (action: 'start' | 'deliver') =>
  act(() => tenantApi.roster.delivery(props.sessionId, action))
const unmarked = computed(() => roster.value?.clients.some((c) => !c.mark) ?? false)
const started = computed(
  () => !!roster.value && new Date(roster.value.session.starts_at).getTime() <= Date.now(),
)

// Walk-in
const walkInOpen = ref(false)
const query = ref<Client | string | null>(null)
const suggestions = ref<Client[]>([])
const walkInClient = ref<Client | null>(null)
const sources = ref<EntitlementSource[]>([])
const source = ref<EntitlementSource | null>(null)
const walkInError = ref<string | null>(null)
async function searchClients(e: AutoCompleteCompleteEvent) {
  suggestions.value = (
    await tenantApi.clients.list({ q: e.query, per_page: 8 }).catch(() => ({ data: [] }))
  ).data
}
async function chooseClient(c: Client) {
  walkInClient.value = c
  walkInError.value = null
  const result = await tenantApi.bookings
    .eligibility(props.sessionId, { client_id: c.id })
    .catch(() => null)
  sources.value = result?.entitlements ?? []
  source.value = sources.value[0] ?? null
  if (result && !result.ok) walkInError.value = result.reasons[0]?.message ?? null
}
function openWalkIn() {
  query.value = null
  walkInClient.value = null
  sources.value = []
  source.value = null
  walkInError.value = null
  walkInOpen.value = true
}
async function addWalkIn() {
  if (!walkInClient.value || !source.value) return
  busy.value = true
  walkInError.value = null
  try {
    roster.value = await tenantApi.roster.walkIn(props.sessionId, {
      client_id: walkInClient.value.id,
      entitlement_source: source.value,
    })
    walkInOpen.value = false
    emit('changed')
  } catch (e) {
    walkInError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
const isCoach = computed(
  () => auth.user?.roles.some((r) => ['Coach', 'Personal Trainer'].includes(r)) ?? false,
)
</script>

<template>
  <ErrorState v-if="state === 'error'" class="panel" @retry="load" />
  <div v-else-if="roster" class="roster">
    <div class="head">
      <span class="counts num">{{ t('roster.counts', roster.counts) }}</span>
      <span class="head__actions">
        <Button
          v-if="roster.can_edit && unmarked"
          :label="t('roster.markAll')"
          icon="pi pi-check-circle"
          size="small"
          :loading="busy"
          @click="markAll"
        />
        <Button
          v-if="roster.can_edit"
          :label="t('roster.walkIn')"
          icon="pi pi-user-plus"
          size="small"
          severity="secondary"
          @click="openWalkIn"
        />
      </span>
    </div>

    <div v-if="isCoach || auth.can('attendance.override')" class="delivery">
      <span v-if="roster.delivery?.ended_at" class="muted">{{
        t('roster.delivered', {
          start: format.time(roster.delivery.started_at),
          end: format.time(roster.delivery.ended_at),
          name: roster.delivery.by ?? '',
        })
      }}</span>
      <template v-else>
        <span v-if="roster.delivery" class="muted">{{
          t('roster.started', {
            time: format.time(roster.delivery.started_at),
            name: roster.delivery.by ?? '',
          })
        }}</span>
        <Button
          v-else
          :label="t('roster.start')"
          icon="pi pi-play"
          size="small"
          variant="outlined"
          :loading="busy"
          @click="deliver('start')"
        />
        <Button
          v-if="started"
          :label="t('roster.deliver')"
          icon="pi pi-flag"
          size="small"
          variant="outlined"
          :loading="busy"
          @click="deliver('deliver')"
        />
      </template>
    </div>

    <Message
      v-if="!roster.can_edit && auth.can('attendance.update')"
      severity="secondary"
      :closable="false"
    >
      {{ t('roster.locked', { date: format.dateTime(roster.edit_until) }) }}
    </Message>

    <EmptyState
      v-if="!roster.clients.length"
      class="panel"
      icon="pi-users"
      :title="t('roster.empty')"
    />
    <ul v-else class="list">
      <li v-for="c in roster.clients" :key="c.booking_id" class="item">
        <PersonAvatar :name="c.client?.name ?? '—'" :image="c.client?.photo_url" size="lg" />
        <div class="who">
          <strong>{{ c.client?.name }}</strong>
          <span class="tags">
            <Tag
              v-if="c.alerts.first_visit"
              class="tag-sm"
              severity="info"
              icon="pi pi-star"
              :value="t('roster.firstVisit')"
            />
            <i
              v-if="c.alerts.health_note"
              v-tooltip.top="t('roster.healthNote')"
              class="pi pi-heart alert"
              :aria-label="t('roster.healthNote')"
            />
            <Tag
              v-if="c.alerts.waiver_missing"
              class="tag-sm"
              severity="warn"
              :value="t('roster.waiverMissing')"
            />
            <small v-if="c.checked_in" class="muted">{{
              t('roster.fromDesk', { time: format.time(c.checked_in.at) })
            }}</small>
          </span>
        </div>
        <SelectButton
          :model-value="c.mark"
          :options="marks"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="!roster.can_edit || busy"
          :aria-label="c.client?.name"
          class="marks"
          @update:model-value="
            (v: 'present' | 'late' | 'absent' | 'excused' | null) => mark(c.booking_id, v)
          "
        />
      </li>
    </ul>

    <FormDialog
      v-model:visible="walkInOpen"
      :title="t('roster.walkInTitle')"
      icon="pi-user-plus"
      size="sm"
      :save-label="t('roster.walkIn')"
      :saving="busy"
      :save-disabled="!walkInClient || !source"
      :error="walkInError"
      @save="addWalkIn"
    >
      <FormField :label="t('booking.client')" for="walkin-client" required>
        <AutoComplete
          v-model="query"
          input-id="walkin-client"
          :suggestions="suggestions"
          option-label="name"
          :delay="250"
          fluid
          @complete="searchClients"
          @option-select="chooseClient($event.value)"
        />
      </FormField>
      <FormField v-if="walkInClient" :label="t('roster.pay')" for="walkin-source" required>
        <Select
          v-model="source"
          input-id="walkin-source"
          :options="sources.map((s) => ({ value: s, label: t(`booking.payments.${s}`) }))"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.roster {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head,
.delivery {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.delivery {
  justify-content: flex-start;
}
.head__actions {
  display: inline-flex;
  gap: 8px;
}
.counts,
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
  flex-wrap: wrap;
  min-height: var(--touch-target, 44px);
}
.item:last-child {
  border-bottom: 0;
}
.who {
  flex: 1;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tags {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.alert {
  color: var(--sev-danger-fg, var(--red-600));
}
</style>
