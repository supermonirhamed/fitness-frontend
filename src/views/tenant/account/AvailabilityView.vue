<script setup lang="ts">
// My availability (US-09.04): a coach sets their own weekly hours, date-specific changes and time
// off (which may wait for a manager's approval).
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/patterns/PageHeader.vue'
import AvailabilityPanel from '@/components/staff/AvailabilityPanel.vue'

const { t } = useI18n()
</script>

<template>
  <div class="page">
    <PageHeader :title="t('staffAvailability.myTitle')" :subtitle="t('staffAvailability.mySubtitle')" />
    <AvailabilityPanel :user-id="null" :can-edit="true" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
