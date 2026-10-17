<script setup lang="ts">
// Attendance rates (US-08.10): attended ÷ (attended + no-shows) over a period, by client, coach or
// session series (academy groups come with EP-10), at the user's branches (a coach sees their own
// sessions). Excused absences don't count. Clients below the organization's threshold are flagged,
// and the ones picked can be added to a static segment (US-05.12) for follow-up.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { tenantApi, type AttendanceRates, type Segment } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

type Row = AttendanceRates['rows'][number]
const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const result = ref<AttendanceRates | null>(null)
const groupBy = ref<'client' | 'coach' | 'series'>('client')
const below = ref(false)
const start = new Date(Date.now() - 30 * 864e5)
const dates = ref<(Date | null)[] | null>([start, new Date()])
const locationId = ref<number | null>(auth.currentLocation?.id ?? null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const selected = ref<Row[]>([])

let seq = 0
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const data = await tenantApi.attendance.rates({
      group_by: groupBy.value,
      from: dates.value?.[0] ? isoDay(dates.value[0]) : undefined,
      to: dates.value?.[1] ? isoDay(dates.value[1]) : undefined,
      location_id: locationId.value ?? undefined,
      below: below.value,
    })
    if (mine !== seq) return
    result.value = data
    selected.value = []
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
watch([groupBy, below, dates, locationId], load, { deep: true })
onMounted(load)

const groupOptions = computed(() =>
  (['client', 'coach', 'series'] as const).map((v) => ({
    value: v,
    label: t(`attendanceRates.by.${v}`),
  })),
)
const lowCount = computed(() => result.value?.rows.filter((r) => r.low).length ?? 0)
function open(row: Row) {
  if (groupBy.value === 'client')
    router.push({ name: 'tenant.client', params: { id: row.id }, query: { tab: 'attendance' } })
}

// Add the selected clients to a static segment.
const segmentOpen = ref(false)
const segments = ref<Segment[]>([])
const segmentId = ref<number | null>(null)
const newName = ref('')
const saving = ref(false)
const segmentError = ref<string | null>(null)
async function openSegment() {
  segmentError.value = null
  segmentId.value = null
  newName.value = t('attendanceRates.defaultSegment')
  segments.value = (await tenantApi.segments.list().catch(() => [])).filter(
    (s) => s.type === 'static',
  )
  segmentOpen.value = true
}
async function addToSegment() {
  saving.value = true
  segmentError.value = null
  try {
    const id =
      segmentId.value ??
      (await tenantApi.segments.create({ name: newName.value.trim(), type: 'static' })).id
    await tenantApi.segments.addMembers(
      id,
      selected.value.map((r) => r.id),
    )
    segmentOpen.value = false
    toast.add({
      severity: 'success',
      summary: t('attendanceRates.added', selected.value.length),
      life: 3000,
    })
    selected.value = []
  } catch (e) {
    segmentError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('attendanceRates.title')">
      <template v-if="result" #meta>
        <span>{{
          t('attendanceRates.subtitle', { threshold: result.threshold, n: result.min_sessions })
        }}</span>
      </template>
      <template v-if="groupBy === 'client' && auth.can('clients.update')" #actions>
        <Button
          :label="t('attendanceRates.addToSegment', { n: selected.length })"
          icon="pi pi-filter"
          :disabled="!selected.length"
          @click="openSegment"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <div class="filters card">
        <SelectButton
          v-model="groupBy"
          :options="groupOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <DatePicker
          v-model="dates"
          selection-mode="range"
          :manual-input="false"
          show-icon
          icon-display="input"
          :aria-label="t('transactions.dates')"
          class="filter"
        />
        <Select
          v-if="branches.length > 1"
          v-model="locationId"
          :options="branches"
          option-label="name"
          option-value="id"
          :placeholder="t('clients.filters.anyBranch')"
          show-clear
          class="filter"
        />
        <label class="toggle">
          <Checkbox v-model="below" binary input-id="rates-below" />
          <span>{{ t('attendanceRates.onlyLow', { n: lowCount }) }}</span>
        </label>
      </div>

      <ErrorState v-if="state === 'error'" class="card" @retry="load" />
      <DataTable
        v-else
        v-model:selection="selected"
        :value="result?.rows ?? []"
        data-key="id"
        :loading="state === 'loading'"
        :row-class="() => (groupBy === 'client' ? 'row-click' : '')"
        class="card"
        @row-click="open($event.data)"
      >
        <template #empty>
          <EmptyState compact icon="pi-chart-line" :title="t('attendanceRates.empty')" />
        </template>
        <Column
          v-if="groupBy === 'client' && auth.can('clients.update')"
          selection-mode="multiple"
          header-style="width: 3rem"
        />
        <Column :header="t(`attendanceRates.by.${groupBy}`)">
          <template #body="{ data }">
            {{ data.name }}
            <Tag
              v-if="data.low"
              class="tag-sm"
              severity="danger"
              :value="t('attendanceRates.low')"
            />
          </template>
        </Column>
        <Column :header="t('attendanceRates.attended')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span class="num">{{ data.attended }}</span></template
          >
        </Column>
        <Column :header="t('attendanceRates.noShows')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span class="num">{{ data.no_shows }}</span></template
          >
        </Column>
        <Column :header="t('attendanceRates.excused')" header-class="row-end" body-class="row-end">
          <template #body="{ data }"
            ><span class="num muted">{{ data.excused }}</span></template
          >
        </Column>
        <Column :header="t('attendanceRates.rate')" header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <span :class="['num', 'rate', { low: data.low }]">{{
              data.rate === null ? '—' : `${data.rate}%`
            }}</span>
          </template>
        </Column>
      </DataTable>
    </template>

    <FormDialog
      v-model:visible="segmentOpen"
      :title="t('attendanceRates.segmentTitle')"
      icon="pi-filter"
      size="sm"
      :save-label="t('attendanceRates.addToSegment', { n: selected.length })"
      :saving="saving"
      :save-disabled="!segmentId && !newName.trim()"
      :error="segmentError"
      @save="addToSegment"
    >
      <FormField :label="t('attendanceRates.segment')" for="rates-segment">
        <Select
          v-model="segmentId"
          input-id="rates-segment"
          :options="segments"
          option-label="name"
          option-value="id"
          :placeholder="t('attendanceRates.newSegment')"
          show-clear
          fluid
        />
      </FormField>
      <FormField
        v-if="!segmentId"
        :label="t('attendanceRates.segmentName')"
        for="rates-segment-name"
      >
        <InputText id="rates-segment-name" v-model="newName" maxlength="80" fluid />
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.filters {
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.filter {
  min-width: 180px;
}
.toggle {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font: var(--text-small);
}
.rate {
  font-weight: 600;
}
.low {
  color: var(--sev-danger-fg, var(--red-600));
}
.muted {
  color: var(--text-muted);
}
:deep(.row-end) {
  text-align: end;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
