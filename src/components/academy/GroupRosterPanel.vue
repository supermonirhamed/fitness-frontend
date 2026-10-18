<script setup lang="ts">
// A group's players (US-10.08/09): current ones with their guardian, start, status and attendance
// rate; past ones (withdrawn, transferred, completed) on request. A row opens the enrollment.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import type { AcademyEnrollment } from '@/api/tenant'
import { showDay } from '@/lib/academy'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ roster: AcademyEnrollment[]; canEnroll: boolean }>()
const emit = defineEmits<{ open: [id: number]; enroll: [] }>()
const { t } = useI18n()
const format = useFormat()
const showPast = ref(false)
const isCurrent = (e: AcademyEnrollment) => e.status === 'Active' || e.status === 'Suspended'
const current = computed(() => props.roster.filter(isCurrent))
const shown = computed(() => (showPast.value ? props.roster : current.value))
const pastCount = computed(() => props.roster.length - current.value.length)
</script>

<template>
  <div class="card">
    <header class="head">
      <strong>{{ t('academy.roster.count', { n: current.length }) }}</strong>
      <label v-if="pastCount" class="toggle">
        <ToggleSwitch v-model="showPast" />
        <span>{{ t('academy.roster.showPast', { n: pastCount }) }}</span>
      </label>
    </header>
    <EmptyState
      v-if="!shown.length"
      compact
      icon="pi-users"
      :title="t('academy.groups.noPlayers')"
      :body="canEnroll ? t('academy.roster.emptyHint') : undefined"
    >
      <Button
        v-if="canEnroll"
        :label="t('academy.enroll.title')"
        icon="pi pi-user-plus"
        size="small"
        @click="emit('enroll')"
      />
    </EmptyState>
    <DataTable
      v-else
      :value="shown"
      data-key="id"
      size="small"
      row-hover
      class="clickable"
      @row-click="emit('open', $event.data.id)"
    >
      <Column :header="t('academy.roster.player')">
        <template #body="{ data }">
          <button type="button" class="name" @click.stop="emit('open', data.id)">
            {{ data.client?.name }}
          </button>
          <div class="muted small">
            <span v-if="data.client?.age != null">{{
              t('academy.roster.age', { n: data.client.age })
            }}</span>
          </div>
        </template>
      </Column>
      <Column :header="t('academy.enroll.payer')">
        <template #body="{ data }">{{ data.payer?.name ?? '—' }}</template>
      </Column>
      <Column :header="t('academy.roster.since')">
        <template #body="{ data }">{{ showDay(format, data.starts_on) }}</template>
      </Column>
      <Column :header="t('academy.groups.rate')">
        <template #body="{ data }">
          <span class="num">{{
            data.attendance_rate == null ? '—' : `${data.attendance_rate}%`
          }}</span>
        </template>
      </Column>
      <Column :header="t('academy.groups.columns.status')">
        <template #body="{ data }"><StatusTag :status="data.display_status" size="sm" /></template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--primary-700);
  cursor: pointer;
}
.clickable :deep(tbody tr) {
  cursor: pointer;
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
