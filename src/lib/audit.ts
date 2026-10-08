/** One changed field of an audit entry, ready to show as before → after. */
export interface FieldChange {
  field: string
  before: unknown
  after: unknown
  /** For lists (e.g. permissions): what was added and removed, instead of two long lists. */
  added?: unknown[]
  removed?: unknown[]
}

export function fieldChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  return fields.map((field) => {
    const b = before?.[field]
    const a = after?.[field]
    if (Array.isArray(b) || Array.isArray(a)) {
      const was = (b as unknown[] | undefined) ?? []
      const now = (a as unknown[] | undefined) ?? []
      const key = (v: unknown) => JSON.stringify(v)
      return {
        field,
        before: b,
        after: a,
        added: now.filter((v) => !was.some((w) => key(w) === key(v))),
        removed: was.filter((v) => !now.some((n) => key(n) === key(v))),
      }
    }
    return { field, before: b, after: a }
  })
}

/** vue-i18n treats dots as nesting, so translation keys use underscores (`role.created` → `role_created`). */
export const actionKey = (action: string) => action.replace(/\./g, '_')

/** yyyy-mm-dd of a local calendar date (what the API filters on, in the organization's timezone). */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
