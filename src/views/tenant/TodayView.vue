<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import PageHeader from '@/components/patterns/PageHeader.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, d } = useI18n()
const auth = useStaffAuth()

// Onboarding (US-01.03): an organization starts without branches; whoever may add one is asked to.
const needsFirstBranch = ref(false)
onMounted(async () => {
  if (!auth.can('locations.create')) return
  try {
    needsFirstBranch.value = (await tenantApi.locations()).length === 0
  } catch {
    // the prompt is a shortcut; the branches page shows the same
  }
})
</script>

<template>
  <div class="today">
    <PageHeader :title="t('today.title')" :subtitle="d(new Date(), 'long')" />
    <section v-if="needsFirstBranch" class="card">
      <EmptyState
        icon="pi-building"
        :title="t('today.firstBranchTitle')"
        :body="t('today.firstBranchBody')"
      >
        <Button
          icon="pi pi-plus"
          :label="t('locationForm.firstBranch')"
          @click="$router.push({ name: 'tenant.settings.locations', query: { new: '1' } })"
        />
      </EmptyState>
    </section>
    <section v-else class="card">
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
