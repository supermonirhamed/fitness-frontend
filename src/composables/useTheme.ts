import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const KEY = 'theme'

function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const theme = ref<Theme>(stored())
document.documentElement.dataset.theme = theme.value

/** Light / dark mode from the user menu (design: App.jsx), remembered in this browser. */
export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme.value
    try {
      localStorage.setItem(KEY, theme.value)
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }
  return { theme, toggle }
}
