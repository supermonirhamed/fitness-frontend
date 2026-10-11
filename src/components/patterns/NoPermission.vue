<script setup lang="ts">
// Port of the design system's NoPermission (patterns/NoPermission.jsx); the fixed copy is part of the design.
import { useI18n } from 'vue-i18n'
import EmptyState from './EmptyState.vue'

defineProps<{ compact?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <EmptyState
    icon="pi-lock"
    :title="t('common.noAccess')"
    :body="t('common.noAccessHint')"
    :compact="compact"
  >
    <slot />
  </EmptyState>
</template>
