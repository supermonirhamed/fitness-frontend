import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'

import App from './App.vue'
import router from './router'
import { i18n, setLocale } from './i18n'
import { StudioPreset } from './theme/preset'

setLocale(i18n.global.locale.value)

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(PrimeVue, {
  theme: {
    preset: StudioPreset,
    options: {
      darkModeSelector: '[data-theme="dark"]',
      cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
    },
  },
})
app.use(ToastService)

app.mount('#app')
