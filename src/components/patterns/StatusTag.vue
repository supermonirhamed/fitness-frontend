<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Tag from 'primevue/tag'

// One colour per status everywhere (design system: patterns/StatusTag.jsx STATUS_MAP).
const SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> =
  {
    Draft: 'secondary',
    Full: 'warn',
    Published: 'success',
    Active: 'success',
    Inactive: 'secondary',
    Archived: 'secondary',
    Cancelled: 'contrast',
    Completed: 'info',
    Provisioning: 'info',
    Invited: 'info',
    Suspended: 'danger',
    Failed: 'danger',
    Blocked: 'danger',
    Lead: 'info',
    Confirmed: 'success',
    Attended: 'info',
    LateCancel: 'warn',
    NoShow: 'danger',
    CancelledByBusiness: 'contrast',
    Rescheduled: 'secondary',
    Waiting: 'warn',
    Promoted: 'success',
    Skipped: 'secondary',
    Expired: 'secondary',
    Removed: 'secondary',
    Pending: 'warn',
    Frozen: 'info',
    Exhausted: 'secondary',
    Due: 'warn',
    PartiallyPaid: 'warn',
    Paid: 'success',
    Void: 'secondary',
    Paused: 'info',
    Withdrawn: 'secondary',
    Transferred: 'info',
    Offered: 'warn',
    Enrolled: 'success',
    Declined: 'secondary',
    Accepted: 'success',
    Approved: 'success',
    Rejected: 'secondary',
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
