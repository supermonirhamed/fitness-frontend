<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Tag from 'primevue/tag'

// One colour per status everywhere (design system: StatusTag).
const SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  Active: 'success',
  Provisioning: 'info',
  Suspended: 'warn',
  Failed: 'danger',
  Draft: 'info',
  Inactive: 'secondary',
}

const props = defineProps<{ status: string }>()
const { t, te } = useI18n()

const severity = computed(() => SEVERITY[props.status] ?? 'secondary')
const label = computed(() =>
  te(`status.${props.status}`) ? t(`status.${props.status}`) : props.status,
)
</script>

<template>
  <Tag
    :severity="severity"
    :value="label"
    :icon="status === 'Provisioning' ? 'pi pi-spin pi-spinner' : undefined"
  />
</template>
