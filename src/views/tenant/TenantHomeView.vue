<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { tenantApi, type Organization } from '@/api/tenant'
import { statusOf } from '@/lib/http'

defineProps<{ slug: string }>()
const { t } = useI18n()

const org = ref<Organization | null>(null)
const state = ref<'loading' | 'ready' | 'suspended' | 'notFound' | 'unavailable' | 'error'>(
  'loading',
)

async function load() {
  state.value = 'loading'
  try {
    org.value = await tenantApi.organization()
    state.value = 'ready'
  } catch (e) {
    state.value =
      ({ 403: 'suspended', 404: 'notFound', 503: 'unavailable' } as const)[statusOf(e) ?? 0] ??
      'error'
  }
}

onMounted(load)
</script>

<template>
  <div class="tenant-home">
    <div class="tenant-home__lang"><LanguageToggle /></div>

    <div v-if="state === 'loading'" class="tenant-home__loading" aria-busy="true">
      <Skeleton width="56px" height="56px" border-radius="12px" />
      <Skeleton width="180px" height="20px" />
    </div>
    <EmptyState
      v-else-if="state === 'suspended'"
      icon="pi-ban"
      :title="t('tenantApp.suspendedTitle')"
      :body="t('tenantApp.suspended')"
    />
    <EmptyState
      v-else-if="state === 'notFound'"
      icon="pi-question-circle"
      :title="t('tenantApp.notFoundTitle')"
      :body="t('tenantApp.notFound')"
    />
    <EmptyState
      v-else-if="state === 'unavailable'"
      icon="pi-clock"
      :title="t('tenantApp.unavailableTitle')"
      :body="t('tenantApp.unavailable')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('common.genericError')"
    >
      <Button
        severity="secondary"
        variant="outlined"
        icon="pi pi-replay pi-dir"
        :label="t('common.retry')"
        @click="load"
      />
    </EmptyState>
    <EmptyState
      v-else
      icon="pi-building"
      :title="org?.name ?? slug"
      :body="t('tenantApp.comingSoon')"
    />
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
.tenant-home__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
</style>
