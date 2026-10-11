// Initials and tone for person avatars, as in the design system's data/Avatar.jsx.

const TONES = ['primary', 'green', 'sky', 'amber', 'purple', 'red'] as const
export type AvatarTone = (typeof TONES)[number]

/** "Sara Al-Otaibi" → "SO"; "سارة العتيبي" → "س ع" (the "Al"/"ال" prefix is skipped). */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s-]/gu, '')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(ال|Al)(?=\p{L}{2})/u, ''))
  if (!parts.length) return ''
  const first = parts[0]![0]!
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : ''
  return /[؀-ۿ]/.test(parts[0]!) ? first + (last ? ' ' + last : '') : (first + last).toUpperCase()
}

/** A stable colour per name. */
export function avatarTone(name: string): AvatarTone {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]!
}
