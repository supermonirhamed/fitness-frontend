<template>
  <RouterView />
  <Toast />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrimeVue } from 'primevue/config'
import Toast from 'primevue/toast'
import { applyPrimeVueLocale } from '@/theme/primevueLocale'
import { useOrganization } from '@/stores/organization'

const { locale } = useI18n()
const primevue = usePrimeVue()
const org = useOrganization()
const english = { ...primevue.config.locale! } // PrimeVue's built-in English texts

// Calendar texts follow the language; the week starts where the organization says (US-00.14).
watchEffect(() =>
  applyPrimeVueLocale(
    primevue.config,
    english,
    locale.value as 'ar' | 'en',
    org.organization?.week_start ?? 0,
  ),
)
</script>
