<script setup lang="ts">
// Academy groups in a table (US-10.04): the group, its program, level and age group, branch,
// term, head coach, places and status. Used on the Academy page and a program's Groups tab.
import { useI18n } from 'vue-i18n'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import StatusTag from '@/components/patterns/StatusTag.vue'
import type { AcademyGroup } from '@/api/tenant'

defineProps<{ groups: AcademyGroup[]; showProgram?: boolean; loading?: boolean }>()
const { t } = useI18n()
const head = (g: AcademyGroup) => g.coaches?.find((c) => c.role === 'head')?.name ?? '—'
const placement = (g: AcademyGroup) =>
  [g.level?.display_name, g.age_group?.display_name].filter(Boolean).join(' · ') || '—'
</script>

<template>
  <DataTable :value="groups" :loading="loading" data-key="id" size="small" class="groups-table">
    <Column :header="t('academy.groups.columns.group')">
      <template #body="{ data }">
        <RouterLink :to="{ name: 'tenant.academy.group', params: { id: data.id } }" class="name">
          {{ data.display_name }}
        </RouterLink>
        <div v-if="showProgram" class="muted small">{{ data.program?.display_name }}</div>
      </template>
    </Column>
    <Column :header="t('academy.groups.columns.placement')">
      <template #body="{ data }">{{ placement(data) }}</template>
    </Column>
    <Column :header="t('academy.groups.columns.branch')">
      <template #body="{ data }">
        {{ data.location?.name }}
        <div v-if="data.facility" class="muted small">{{ data.facility.name }}</div>
      </template>
    </Column>
    <Column :header="t('academy.groups.columns.term')">
      <template #body="{ data }">{{
        data.term?.display_name ?? t('programs.modes.Rolling')
      }}</template>
    </Column>
    <Column :header="t('academy.groups.columns.coach')">
      <template #body="{ data }">{{ head(data) }}</template>
    </Column>
    <Column :header="t('academy.groups.columns.places')">
      <template #body="{ data }">
        <span dir="ltr">{{ data.enrolled }} / {{ data.capacity }}</span>
      </template>
    </Column>
    <Column :header="t('academy.groups.columns.status')">
      <template #body="{ data }"><StatusTag :status="data.status" /></template>
    </Column>
  </DataTable>
</template>

<style scoped>
.name {
  font-weight: 600;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
