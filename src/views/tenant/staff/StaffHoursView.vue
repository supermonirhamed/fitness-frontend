<script setup lang="ts">
// Hours & sessions delivered (US-09.06): per staff member for a period, sessions taught (credited
// to the coach who actually taught them), appointments, their hours, attendees per session and
// shift hours clocked at the desk. Exported to CSV for payroll (a report, not payroll).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type StaffHoursRow } from '@/api/tenant'
import { isoDay } from '@/lib/audit'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const state = ref<'loading' | 'ready' | 'error'>('loading')
const rows = ref<StaffHoursRow[]>([])
const range = ref<(Date | null)[] | null>([
  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  new Date(),
])
const locationId = ref<number | null>(auth.currentLocation?.id ?? null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const params = computed(() => ({
  from: range.value?.[0] ? isoDay(range.value[0]) : undefined,
  to: range.value?.[1]
    ? isoDay(range.value[1])
    : range.value?.[0]
      ? isoDay(range.value[0])
      : undefined,
  location_id: locationId.value ?? undefined,
}))
async function load() {
  state.value = 'loading'
  try {
    rows.value = await tenantApi.staff.hours(params.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(params, load, { deep: true })
onMounted(load)
const exportCsv = () => (window.location.href = tenantApi.staff.hoursExportUrl(params.value))
</script>

<template>
  <section class="page">
    <div class="toolbar">
      <DatePicker
        v-model="range"
        selection-mode="range"
        :manual-input="false"
        show-icon
        icon-display="input"
        :aria-label="t('transactions.dates')"
      />
      <Select
        v-if="branches.length > 1"
        v-model="locationId"
        :options="branches"
        option-label="name"
        option-value="id"
        :placeholder="t('clients.filters.anyBranch')"
        show-clear
      />
      <span class="spacer" />
      <Button
        v-if="auth.can('reports.export')"
        :label="t('transactions.export')"
        icon="pi pi-download"
        severity="secondary"
        variant="outlined"
        :disabled="!rows.length"
        @click="exportCsv"
      />
    </div>
    <ErrorState v-if="state === 'error'" class="card" @retry="load" />
    <DataTable
      v-else
      :value="rows"
      data-key="user_id"
      :loading="state === 'loading'"
      class="card"
      row-hover
      :row-class="() => 'row-click'"
      @row-click="
        router.push({
          name: 'tenant.staff.member',
          params: { id: $event.data.user_id },
          query: { tab: 'hours' },
        })
      "
    >
      <template #empty
        ><EmptyState compact icon="pi-clock" :title="t('staffHours.empty')"
      /></template>
      <Column field="name" :header="t('access.columns.person')" />
      <Column :header="t('staffHours.sessions')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.sessions }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.appointments')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.appointments }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.sessionHours')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.session_hours }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.perSession')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.attendees_per_session ?? '—' }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.substitutions')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.substitutions }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.delivered')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.delivered }}</span></template
        ></Column
      >
      <Column :header="t('staffHours.shiftHours')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.shift_hours }}</span></template
        ></Column
      >
    </DataTable>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.spacer {
  flex: 1;
}
:deep(.row-end) {
  text-align: end;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
