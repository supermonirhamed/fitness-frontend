<script setup lang="ts">
// Booking rules of a service (US-02.07) from the service list.
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import ServiceBookingRules from '@/components/services/ServiceBookingRules.vue'
import type { Service } from '@/api/tenant'

defineProps<{ service: Service | null; canEdit: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('serviceRules.title', { name: service?.display_name })"
    :style="{ width: '760px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <ServiceBookingRules v-if="visible && service" :service="service" :can-edit="canEdit" />
  </Dialog>
</template>
