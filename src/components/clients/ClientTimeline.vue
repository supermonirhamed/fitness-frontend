<script setup lang="ts">
// The client's timeline (US-05.06) arrives with its story.
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/patterns/EmptyState.vue'

defineProps<{ clientId: number }>()
const { t } = useI18n()
</script>

<template>
  <EmptyState class="card" icon="pi-history" :title="t('clientProfile.later')" />
</template>
