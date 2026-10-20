<script setup lang="ts">
// The check-in code in a dialog, from the home screen, a booking or the account (US-11.23).
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import MemberQr from '@/components/app/MemberQr.vue'

const visible = defineModel<boolean>('visible', { required: true })
defineProps<{ memberId?: string | null }>()
const { t } = useI18n()
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('app.home.checkIn')"
    :style="{ width: 'min(92vw, 360px)' }"
  >
    <MemberQr v-if="visible" :member-id="memberId" />
  </Dialog>
</template>
