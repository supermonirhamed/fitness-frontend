<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import EmptyState from '@/components/patterns/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <section class="forbidden">
    <EmptyState
      icon="pi-lock"
      :title="t('permissions.forbidden')"
      :body="t('permissions.forbiddenHint')"
    >
      <RouterLink :to="{ name: 'tenant.today' }" custom v-slot="{ navigate }">
        <Button
          :label="t('permissions.backToToday')"
          severity="secondary"
          variant="outlined"
          @click="navigate"
        />
      </RouterLink>
    </EmptyState>
  </section>
</template>

<style scoped>
.forbidden {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
</style>
