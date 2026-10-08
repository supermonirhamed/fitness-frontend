<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import EmptyState from '@/components/patterns/EmptyState.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { useOrganization } from '@/stores/organization'

const { t } = useI18n()
const org = useOrganization()
const router = useRouter()

const view = computed(() => {
  switch (org.state) {
    case 'suspended':
      return {
        icon: 'pi-ban',
        title: t('tenantApp.suspendedTitle'),
        body: t('tenantApp.suspended'),
        retry: false,
      }
    case 'notFound':
      return {
        icon: 'pi-question-circle',
        title: t('tenantApp.notFoundTitle'),
        body: t('tenantApp.notFound'),
        retry: false,
      }
    case 'unavailable':
      return {
        icon: 'pi-clock',
        title: t('tenantApp.unavailableTitle'),
        body: t('tenantApp.unavailable'),
        retry: true,
      }
    default:
      return {
        icon: 'pi-exclamation-triangle',
        title: t('common.genericError'),
        body: '',
        retry: true,
      }
  }
})

async function retry() {
  if ((await org.load(true)) === 'ready') await router.replace('/')
}
</script>

<template>
  <div class="tenant-status">
    <div class="tenant-status__lang"><LanguageToggle /></div>
    <EmptyState :icon="view.icon" :title="view.title" :body="view.body">
      <Button
        v-if="view.retry"
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="retry"
      />
    </EmptyState>
  </div>
</template>

<style scoped>
.tenant-status {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tenant-status__lang {
  position: fixed;
  top: var(--space-4);
  inset-inline-end: var(--space-4);
}
</style>
