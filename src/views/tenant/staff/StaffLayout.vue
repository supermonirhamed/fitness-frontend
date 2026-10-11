<script setup lang="ts">
// Staff area from the design's navigation: Users & access and Roles & permissions as tabs.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/patterns/PageHeader.vue'
import RouteTabs from '@/components/patterns/RouteTabs.vue'
import { allowedPages, STAFF_PAGES } from '@/lib/permissions'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const auth = useStaffAuth()
const tabs = computed(() =>
  allowedPages(STAFF_PAGES, (p) => auth.can(p)).map((page) => ({
    key: page.key,
    label: t(`staff.pages.${page.key}`),
    to: { name: page.name },
  })),
)
</script>

<template>
  <div class="staff">
    <PageHeader :title="t('staff.title')" :subtitle="t('staff.subtitle')" />
    <RouteTabs :tabs="tabs" :label="t('staff.title')" />
    <RouterView />
  </div>
</template>

<style scoped>
.staff {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
