import { useI18n } from 'vue-i18n'
import type { ClientMessage } from '@/api/tenant'

type Status = ClientMessage['status']
const SEVERITY: Record<Status, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  Queued: 'info',
  Sending: 'info',
  Sent: 'success',
  Delivered: 'success',
  Failed: 'danger',
  Bounced: 'danger',
  Skipped: 'secondary',
}

/** Names of notification types, statuses and skip reasons (EP-12), falling back to the key. */
export function useMessageLabels() {
  const { t, te } = useI18n()
  const label = (prefix: string, key: string | null) =>
    !key ? '' : te(`${prefix}.${key}`) ? t(`${prefix}.${key}`) : key
  return {
    typeName: (key: string) => label('notificationSettings.typeNames', key),
    status: (status: Status) => t(`clientMessages.statuses.${status}`),
    reason: (key: string | null) => label('clientMessages.reasons', key),
    severity: (status: Status) => SEVERITY[status],
  }
}
