/** Actions shown as matrix columns; every other action of a module is a special one (e.g. refund, override). */
export const STANDARD_ACTIONS = ['view', 'create', 'update', 'delete'] as const

export function specialActions(actions: string[]): string[] {
  return actions.filter((a) => !(STANDARD_ACTIONS as readonly string[]).includes(a))
}

export interface SettingsPage {
  name: string
  key: string
  permission: string
}

/** Settings sub-pages, in menu order, with the permission each needs. */
export const SETTINGS_PAGES: SettingsPage[] = [
  { name: 'tenant.settings.users', key: 'users', permission: 'staff.view' },
  { name: 'tenant.settings.roles', key: 'roles', permission: 'roles.view' },
  { name: 'tenant.settings.security', key: 'security', permission: 'settings.security' },
  { name: 'tenant.settings.audit', key: 'audit', permission: 'audit.view' },
]

export function allowedSettingsPages(can: (permission: string) => boolean): SettingsPage[] {
  return SETTINGS_PAGES.filter((page) => can(page.permission))
}

export interface PermissionDiff {
  added: string[]
  removed: string[]
}

/** What saving would change, sorted in catalog order (module order, then action order). */
export function permissionDiff(
  before: string[],
  after: string[],
  modules: Record<string, string[]>,
): PermissionDiff {
  const order = Object.entries(modules).flatMap(([module, actions]) =>
    actions.map((action) => `${module}.${action}`),
  )
  const was = new Set(before)
  const now = new Set(after)
  return {
    added: order.filter((p) => now.has(p) && !was.has(p)),
    removed: order.filter((p) => was.has(p) && !now.has(p)),
  }
}
