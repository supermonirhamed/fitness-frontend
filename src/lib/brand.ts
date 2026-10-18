import { updatePrimaryPalette } from '@primeuix/themes'

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** How much white (positive) or black (negative) each step mixes into the brand colour, which is 600. */
const MIX: Record<(typeof STEPS)[number], number> = {
  50: 0.93,
  100: 0.85,
  200: 0.7,
  300: 0.5,
  400: 0.28,
  500: 0.12,
  600: 0,
  700: -0.17,
  800: -0.32,
  900: -0.45,
  950: -0.62,
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0
  const share = Math.abs(amount)
  return (
    '#' +
    rgb(hex)
      .map((c) =>
        Math.round(c + (target - c) * share)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

/** A 50–950 scale around one brand colour. */
export function brandPalette(hex: string): Record<string, string> {
  return Object.fromEntries(STEPS.map((step) => [String(step), mix(hex, MIX[step])]))
}

/**
 * The organization's colour on the client app (US-11.01): PrimeVue's primary palette and our own
 * --primary-* tokens.
 */
export function applyBrandColor(hex: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return
  const scale = brandPalette(hex)
  updatePrimaryPalette(scale)
  const root = document.documentElement.style
  for (const [step, value] of Object.entries(scale)) root.setProperty(`--primary-${step}`, value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex)
}
