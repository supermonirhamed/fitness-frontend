<script setup lang="ts">
// What clients book (EP-11): classes, appointments with a trainer, and events.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RouteTabs from '@/components/patterns/RouteTabs.vue'

const { t } = useI18n()
const tabs = computed(() => [
  { key: 'classes', label: t('app.book.classes'), to: { name: 'app.schedule' } },
  { key: 'appointments', label: t('app.book.appointments'), to: { name: 'app.appointments' } },
  { key: 'events', label: t('app.book.events'), to: { name: 'app.events' } },
])
</script>

<template>
  <RouteTabs :tabs="tabs" :label="t('app.nav.schedule')" />
</template>
