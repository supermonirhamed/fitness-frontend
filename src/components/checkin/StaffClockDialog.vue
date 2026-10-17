<script setup lang="ts">
// Desk staff clock staff in and out of their shift (US-08.07); the times feed staff hours (US-09.06).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import { tenantApi, type StaffAttendanceDay } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ locationId: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const format = useFormat()

const day = ref<StaffAttendanceDay | null>(null)
const error = ref<string | null>(null)
const busy = ref<number | null>(null)
async function load() {
  if (!props.locationId) return
  error.value = null
  try {
    day.value = await tenantApi.staffAttendance.day(props.locationId)
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  }
}
watch(visible, (open) => open && load())

const openShift = (userId: number) =>
  day.value?.records.find((r) => r.kind === 'shift' && r.user.id === userId && !r.ended_at) ?? null
const rows = computed(() => (day.value?.staff ?? []).map((s) => ({ ...s, shift: openShift(s.id) })))
const sessions = computed(() => (day.value?.records ?? []).filter((r) => r.kind === 'session'))

async function clock(userId: number, action: 'in' | 'out') {
  if (!props.locationId) return
  busy.value = userId
  error.value = null
  try {
    await tenantApi.staffAttendance.clock({
      user_id: userId,
      location_id: props.locationId,
      action,
    })
    await load()
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('staffClock.title')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <ul class="staff">
      <li v-for="s in rows" :key="s.id">
        <PersonAvatar :name="s.name" size="md" />
        <span class="name">
          <strong>{{ s.name }}</strong>
          <small v-if="s.shift" class="in">{{
            t('staffClock.since', { time: format.time(s.shift.started_at) })
          }}</small>
        </span>
        <Button
          v-if="s.shift"
          :label="t('staffClock.out')"
          icon="pi pi-sign-out"
          severity="secondary"
          size="small"
          :loading="busy === s.id"
          @click="clock(s.id, 'out')"
        />
        <Button
          v-else
          :label="t('staffClock.in')"
          icon="pi pi-sign-in"
          size="small"
          :loading="busy === s.id"
          @click="clock(s.id, 'in')"
        />
      </li>
    </ul>
    <template v-if="sessions.length">
      <h4 class="sub">{{ t('staffClock.sessions') }}</h4>
      <ul class="sessions">
        <li v-for="r in sessions" :key="r.id">
          <span>{{ r.user.name }} · {{ r.session?.title }}</span>
          <span class="muted num"
            >{{ format.time(r.started_at) }} –
            {{ r.ended_at ? format.time(r.ended_at) : '…' }}</span
          >
        </li>
      </ul>
    </template>
  </Dialog>
</template>

<style scoped>
.staff,
.sessions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.staff li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
  min-height: var(--touch-target, 44px);
}
.name {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.in {
  color: var(--sev-success-fg, var(--green-700));
}
.sub {
  margin: 16px 0 6px;
  font: var(--text-h4);
}
.sessions li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font: var(--text-small);
}
.muted {
  color: var(--text-muted);
}
</style>
