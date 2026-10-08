<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/patterns/PageHeader.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, d } = useI18n()
const auth = useStaffAuth()
</script>

<template>
  <div class="today">
    <PageHeader :title="t('today.title')" :subtitle="d(new Date(), 'long')" />
    <section class="card">
      <EmptyState
        icon="pi-sun"
        :title="t('today.welcome', { name: auth.user?.name.split(' ')[0] })"
        :body="t('today.empty')"
      />
    </section>
  </div>
</template>

<style scoped>
.today {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
</style>
