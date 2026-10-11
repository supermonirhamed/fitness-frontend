<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Tag from 'primevue/tag'

// One colour per status everywhere (design system: patterns/StatusTag.jsx STATUS_MAP).
const SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> =
  {
    Draft: 'secondary',
    Published: 'success',
    Active: 'success',
    Inactive: 'secondary',
    Archived: 'secondary',
    Cancelled: 'contrast',
    Provisioning: 'info',
    Invited: 'info',
    Suspended: 'danger',
    Failed: 'danger',
  }

const props = defineProps<{ status: string; size?: 'sm' }>()
const { t, te } = useI18n()

const severity = computed(() => SEVERITY[props.status] ?? 'secondary')
const label = computed(() =>
  te(`status.${props.status}`) ? t(`status.${props.status}`) : props.status,
)
</script>

<template>
  <Tag
    :class="{ 'tag-sm': size === 'sm' }"
    :severity="severity"
    :value="label"
    :icon="status === 'Provisioning' ? 'pi pi-spin pi-spinner' : undefined"
  />
</template>
