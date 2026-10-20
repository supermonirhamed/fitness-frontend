<script setup lang="ts">
// What clients book (EP-11): classes, appointments with a trainer, events, and the coaches.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RouteTabs from '@/components/patterns/RouteTabs.vue'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const app = useClientApp()
const tabs = computed(() => [
  { key: 'classes', label: t('app.book.classes'), to: { name: 'app.schedule' } },
  { key: 'appointments', label: t('app.book.appointments'), to: { name: 'app.appointments' } },
  { key: 'events', label: t('app.book.events'), to: { name: 'app.events' } },
  ...(app.config?.features.show_coaches
    ? [{ key: 'coaches', label: t('app.book.coaches'), to: { name: 'app.coaches' } }]
    : []),
])
</script>

<template>
  <RouteTabs :tabs="tabs" :label="t('app.nav.schedule')" />
</template>
