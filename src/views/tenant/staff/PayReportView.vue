<script setup lang="ts">
// The pay report (US-09.07): what each coach earns for a period under their pay rates, session by
// session (the most specific rate wins) plus shifts paid by the hour. Sessions without a rate are
// counted so they can be fixed. A report only, not payroll.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type PayReport } from '@/api/tenant'
import { isoDay } from '@/lib/audit'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()
const state = ref<'loading' | 'ready' | 'error'>('loading')
const report = ref<PayReport | null>(null)
const range = ref<(Date | null)[] | null>([
  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  new Date(),
])
const locationId = ref<number | null>(null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const expanded = ref({})
async function load() {
  state.value = 'loading'
  try {
    report.value = await tenantApi.staff.payReport({
      from: range.value?.[0] ? isoDay(range.value[0]) : undefined,
      to: range.value?.[1] ? isoDay(range.value[1]) : undefined,
      location_id: locationId.value ?? undefined,
    })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch([range, locationId], load, { deep: true })
onMounted(load)
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
      <strong v-if="report" class="total num">{{
        t('payReport.total', { amount: format.money(report.total) })
      }}</strong>
    </div>
    <ErrorState v-if="state === 'error'" class="card" @retry="load" />
    <DataTable
      v-else
      v-model:expanded-rows="expanded"
      :value="report?.rows ?? []"
      data-key="user_id"
      :loading="state === 'loading'"
      class="card"
    >
      <template #empty
        ><EmptyState compact icon="pi-money-bill" :title="t('payReport.empty')"
      /></template>
      <Column expander style="width: 3rem" />
      <Column field="name" :header="t('access.columns.person')" />
      <Column :header="t('payReport.lines')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><span class="num">{{ data.lines.length }}</span></template
        ></Column
      >
      <Column :header="t('payReport.unpriced')" header-class="row-end" body-class="row-end">
        <template #body="{ data }"
          ><Tag
            v-if="data.unpriced"
            class="tag-sm"
            severity="warn"
            :value="String(data.unpriced)"
          /><span v-else class="muted">0</span></template
        >
      </Column>
      <Column :header="t('payments.amount')" header-class="row-end" body-class="row-end"
        ><template #body="{ data }"
          ><strong class="num">{{ format.money(data.amount) }}</strong></template
        ></Column
      >
      <template #expansion="{ data }">
        <ul class="lines">
          <li v-for="(l, i) in data.lines" :key="i">
            <span class="num">{{ format.dateTime(l.starts_at) }}</span>
            <span>{{
              l.kind === 'shift'
                ? t('payReport.shift', { hours: Math.round(((l.minutes ?? 0) / 60) * 100) / 100 })
                : l.title
            }}</span>
            <span class="muted">{{
              l.rate ? t(`payRates.types.${l.rate.type}`) : t('payReport.noRate')
            }}</span>
            <span class="num">{{ l.amount === null ? '—' : format.money(l.amount) }}</span>
          </li>
        </ul>
      </template>
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
.total {
  font-size: 16px;
}
.lines {
  list-style: none;
  margin: 0;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lines li {
  display: grid;
  grid-template-columns: 180px 1fr 160px 120px;
  gap: 12px;
}
.muted {
  color: var(--text-muted);
}
:deep(.row-end) {
  text-align: end;
}
</style>
