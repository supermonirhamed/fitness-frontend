<script setup lang="ts">
// The academy overview (US-10.22): totals, alerts (groups below the minimum size, players with a
// low attendance rate, children without a guardian to contact, overdue fees) and per program each
// group's players against capacity, waiting list, this month's attendance, fees and head coach.
// Filtered by branch, term, program and coach; fees only for staff who see payments.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type AcademyOverview, type AcademyTerm, type Program } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

defineProps<{ programs: Program[] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const branches = computed(() => auth.user?.switchable_locations ?? [])
const showFees = computed(() => auth.can('payments.view'))

const locationId = ref<number | null>(null)
const programId = ref<number | null>(null)
const termId = ref<number | null>(null)
const coachId = ref<number | null>(null)
const terms = ref<AcademyTerm[]>([])
const coaches = ref<{ id: number; name: string }[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const data = ref<AcademyOverview | null>(null)

async function load() {
  state.value = 'loading'
  try {
    data.value = await tenantApi.academy.overview({
      location_id: locationId.value,
      program_id: programId.value,
      term_id: termId.value,
      coach_id: coachId.value,
    })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  load()
  const groups = await tenantApi.academy.groups.list().catch(() => [])
  coaches.value = [
    ...new Map(
      groups.flatMap((g) => g.coaches ?? []).map((c) => [c.id, { id: c.id, name: c.name }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name))
})
watch([locationId, termId, coachId], load)
watch(programId, async (id) => {
  termId.value = null
  terms.value = id ? await tenantApi.academy.terms.list(id).catch(() => []) : []
  load()
})
const alertCount = computed(() => {
  const a = data.value?.alerts
  return a
    ? a.small_groups.length +
        a.low_attendance.length +
        a.no_guardian_contact.length +
        a.overdue_fees.length
    : 0
})
const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0)
</script>

<template>
  <div class="stack">
    <div class="toolbar">
      <Select
        v-if="branches.length > 1"
        v-model="locationId"
        :options="branches"
        option-label="name"
        option-value="id"
        :placeholder="t('clients.filters.anyBranch')"
        show-clear
      />
      <Select
        v-if="programs.length > 1"
        v-model="programId"
        :options="programs"
        option-label="display_name"
        option-value="id"
        :placeholder="t('academy.groups.anyProgram')"
        show-clear
      />
      <Select
        v-if="terms.length"
        v-model="termId"
        :options="terms"
        option-label="display_name"
        option-value="id"
        :placeholder="t('academy.overview.anyTerm')"
        show-clear
      />
      <Select
        v-if="coaches.length > 1"
        v-model="coachId"
        :options="coaches"
        option-label="name"
        option-value="id"
        :placeholder="t('academy.overview.anyCoach')"
        show-clear
        filter
      />
    </div>

    <div v-if="state === 'loading' && !data" class="tiles" aria-busy="true">
      <Skeleton v-for="i in 4" :key="i" height="84px" />
    </div>
    <ErrorState v-else-if="state === 'error'" class="card" @retry="load" />
    <template v-else-if="data">
      <div class="tiles">
        <div class="card tile">
          <span class="tile__value num"
            >{{ data.totals.enrolled }} / {{ data.totals.capacity }}</span
          >
          <span class="muted">{{
            t('academy.overview.players', { n: pct(data.totals.enrolled, data.totals.capacity) })
          }}</span>
        </div>
        <div class="card tile">
          <span class="tile__value num">{{ data.totals.groups }}</span>
          <span class="muted">{{ t('academy.overview.groups') }}</span>
        </div>
        <div class="card tile">
          <span class="tile__value num">{{ data.totals.waiting }}</span>
          <span class="muted">{{ t('academy.overview.waiting') }}</span>
        </div>
        <div v-if="showFees" class="card tile">
          <span class="tile__value num">{{ format.money(data.totals.unpaid ?? 0) }}</span>
          <span class="muted"
            >{{ t('academy.overview.unpaid') }} ·
            {{
              t('academy.overview.overdue', { amount: format.money(data.totals.overdue ?? 0) })
            }}</span
          >
        </div>
      </div>

      <section v-if="alertCount" class="card alerts">
        <h2>{{ t('academy.overview.alerts', { n: alertCount }) }}</h2>
        <div v-if="data.alerts.small_groups.length" class="alert">
          <strong>{{
            t('academy.overview.smallGroups', { n: data.alerts.min_group_size })
          }}</strong>
          <span v-for="g in data.alerts.small_groups" :key="g.id" class="chip">
            <RouterLink :to="{ name: 'tenant.academy.group', params: { id: g.id } }">{{
              g.display_name
            }}</RouterLink>
            <span class="num"> ({{ g.enrolled }}/{{ g.capacity }})</span>
          </span>
        </div>
        <div v-if="data.alerts.low_attendance.length" class="alert">
          <strong>{{ t('academy.overview.lowAttendance', { n: data.alerts.threshold }) }}</strong>
          <span
            v-for="p in data.alerts.low_attendance"
            :key="`${p.client.id}-${p.group.id}`"
            class="chip"
          >
            <RouterLink :to="{ name: 'tenant.client', params: { id: p.client.id } }">{{
              p.client.name
            }}</RouterLink>
            <span class="muted"> {{ p.group.display_name }} · {{ p.rate }}%</span>
          </span>
        </div>
        <div v-if="data.alerts.no_guardian_contact.length" class="alert">
          <strong>{{ t('academy.overview.noContact') }}</strong>
          <span v-for="p in data.alerts.no_guardian_contact" :key="p.client.id" class="chip">
            <RouterLink
              :to="{ name: 'tenant.client', params: { id: p.client.id }, query: { tab: 'family' } }"
              >{{ p.client.name }}</RouterLink
            >
          </span>
        </div>
        <div v-if="data.alerts.overdue_fees.length" class="alert">
          <strong>{{ t('academy.overview.overdueFees') }}</strong>
          <span v-for="p in data.alerts.overdue_fees" :key="p.client.id" class="chip">
            <RouterLink
              :to="{
                name: 'tenant.client',
                params: { id: p.payer_id ?? p.client.id },
                query: { tab: 'payments' },
              }"
              >{{ p.client.name }}</RouterLink
            >
            <span class="num"> {{ format.money(p.amount) }}</span>
          </span>
        </div>
      </section>

      <EmptyState
        v-if="!data.programs.length"
        class="card"
        icon="pi-sitemap"
        :title="t('academy.groups.none')"
      />
      <section v-for="program in data.programs" :key="program.id" class="card">
        <header class="program">
          <h2>{{ program.display_name }}</h2>
          <span class="muted num">{{ program.enrolled }} / {{ program.capacity }}</span>
        </header>
        <DataTable :value="program.groups" data-key="id" size="small">
          <Column :header="t('academy.groups.columns.group')">
            <template #body="{ data: g }">
              <RouterLink
                :to="{ name: 'tenant.academy.group', params: { id: g.id } }"
                class="name"
                >{{ g.display_name }}</RouterLink
              >
              <div class="muted small">{{ [g.location, g.term].filter(Boolean).join(' · ') }}</div>
            </template>
          </Column>
          <Column :header="t('academy.groups.columns.places')">
            <template #body="{ data: g }"
              ><span class="num" dir="ltr">{{ g.enrolled }} / {{ g.capacity }}</span></template
            >
          </Column>
          <Column :header="t('academy.overview.waitingCol')">
            <template #body="{ data: g }"
              ><span class="num">{{ g.waiting || '—' }}</span></template
            >
          </Column>
          <Column :header="t('academy.overview.rateMonth')">
            <template #body="{ data: g }"
              ><span class="num">{{
                g.attendance_rate == null ? '—' : `${g.attendance_rate}%`
              }}</span></template
            >
          </Column>
          <Column v-if="showFees" :header="t('academy.overview.unpaid')">
            <template #body="{ data: g }">
              <span class="num">{{ g.unpaid ? format.money(g.unpaid) : '—' }}</span>
              <div v-if="g.overdue" class="overdue small">
                {{ t('academy.overview.overdue', { amount: format.money(g.overdue) }) }}
              </div>
            </template>
          </Column>
          <Column :header="t('academy.groups.columns.coach')">
            <template #body="{ data: g }">{{ g.head_coach ?? '—' }}</template>
          </Column>
          <Column :header="t('academy.groups.columns.status')">
            <template #body="{ data: g }"><StatusTag :status="g.status" size="sm" /></template>
          </Column>
        </DataTable>
      </section>
    </template>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tile__value {
  font-size: 1.5rem;
  font-weight: 700;
}
.alerts {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-color: var(--sev-warn-border, var(--border-default));
}
.alerts h2,
.program h2 {
  margin: 0;
  font-size: 1rem;
}
.alert {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
}
.chip {
  white-space: nowrap;
}
.program {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}
.name {
  font-weight: 600;
}
.overdue {
  color: var(--sev-danger-fg);
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
