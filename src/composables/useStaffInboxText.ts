import { useI18n } from 'vue-i18n'
import type { StaffInboxItem } from '@/api/tenant'

/** Words a staff inbox item or staff alert (US-12.04, US-12.15) from its kind and details. */
export function useStaffInboxText() {
  const { t, te } = useI18n()
  return (item: StaffInboxItem): string => {
    const data = { ...(item.data as Record<string, unknown>) }
    if (typeof data.change === 'string' && te(`staffInbox.changes.${data.change}`))
      data.change = t(`staffInbox.changes.${data.change}`)
    return te(`staffInbox.kinds.${item.kind}`)
      ? t(`staffInbox.kinds.${item.kind}`, data)
      : item.kind
  }
}
