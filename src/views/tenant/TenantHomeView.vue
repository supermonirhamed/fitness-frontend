<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/patterns/EmptyState.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'

defineProps<{ slug: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="tenant-home">
    <div class="tenant-home__lang"><LanguageToggle /></div>
    <EmptyState icon="pi-building" :title="slug" :body="t('tenantApp.comingSoon')" />
  </div>
</template>

<style scoped>
.tenant-home {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tenant-home__lang {
  position: fixed;
  top: var(--space-4);
  inset-inline-end: var(--space-4);
}
</style>
