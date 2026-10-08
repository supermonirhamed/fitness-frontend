import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Maps the Studio Admin design tokens (src/styles/tokens) onto PrimeVue's Aura preset.
const primary = {
  50: '#edf5ff',
  100: '#d6e8ff',
  200: '#b0d3ff',
  300: '#7ab5ff',
  400: '#3f8cff',
  500: '#1769f5',
  600: '#0b55d9',
  700: '#0c44ad',
  800: '#10398a',
  900: '#133270',
  950: '#0d1f45',
}
const surface = {
  0: '#ffffff',
  50: '#f7f8fa',
  100: '#eef0f3',
  200: '#e2e5ea',
  300: '#cdd2da',
  400: '#9aa2ae',
  500: '#6b7482',
  600: '#4f5866',
  700: '#3a424e',
  800: '#262c35',
  900: '#181c23',
  950: '#0e1116',
}

export const StudioPreset = definePreset(Aura, {
  semantic: {
    primary,
    focusRing: {
      width: '0',
      style: 'none',
      color: 'transparent',
      offset: '0',
      shadow: 'var(--focus-ring)',
    },
    formField: { borderRadius: '6px', paddingX: '0.75rem', paddingY: '0.5rem' },
    colorScheme: {
      light: {
        surface,
        primary: {
          color: '{primary.600}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
        formField: {
          borderColor: '{surface.300}',
          hoverBorderColor: '{surface.400}',
          focusBorderColor: '{primary.600}',
        },
      },
      dark: {
        surface,
        primary: {
          color: '{primary.400}',
          contrastColor: '{surface.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
      },
    },
  },
  components: {
    card: { root: { borderRadius: '10px', shadow: 'none' } },
    dialog: { root: { borderRadius: '12px' } },
    tag: { root: { borderRadius: '4px', fontWeight: '600' } },
  },
})
