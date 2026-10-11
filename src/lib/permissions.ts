/** Actions shown as matrix columns; every other action of a module is a special one (e.g. refund, override). */
export const STANDARD_ACTIONS = ['view', 'create', 'update', 'delete'] as const

export function specialActions(actions: string[]): string[] {
  return actions.filter((a) => !(STANDARD_ACTIONS as readonly string[]).includes(a))
}

export interface SettingsPage {
  name: string
  key: string
  icon: string
  permission: string
}

/** Settings sub-pages, in menu order, with the permission each needs. */
export const SETTINGS_PAGES: SettingsPage[] = [
  {
    name: 'tenant.settings.organization',
    key: 'organization',
    icon: 'pi-id-card',
    permission: 'settings.view',
  },
  {
    name: 'tenant.settings.regional',
    key: 'regional',
    icon: 'pi-globe',
    permission: 'settings.view',
  },
  {
    name: 'tenant.settings.booking',
    key: 'booking',
    icon: 'pi-sliders-h',
    permission: 'settings.view',
  },
  {
    name: 'tenant.settings.security',
    key: 'security',
    icon: 'pi-shield',
    permission: 'settings.security',
  },
  { name: 'tenant.settings.audit', key: 'audit', icon: 'pi-history', permission: 'audit.view' },
]

/** Staff sub-pages (tabs), in order. */
export const STAFF_PAGES: SettingsPage[] = [
  { name: 'tenant.staff.users', key: 'users', icon: 'pi-users', permission: 'staff.view' },
  { name: 'tenant.staff.roles', key: 'roles', icon: 'pi-key', permission: 'roles.view' },
]

export function allowedPages(
  pages: SettingsPage[],
  can: (permission: string) => boolean,
): SettingsPage[] {
  return pages.filter((page) => can(page.permission))
}

export function allowedSettingsPages(can: (permission: string) => boolean): SettingsPage[] {
  return allowedPages(SETTINGS_PAGES, can)
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
