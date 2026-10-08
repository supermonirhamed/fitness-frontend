<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'
import { tenantApi } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
const auth = useStaffAuth()

/** Remembered in this browser, and on the user's profile when signed in to an organization. */
async function toggle() {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next, true)
  if (!auth.signedIn) return
  try {
    auth.user!.locale = (await tenantApi.updateProfile({ locale: next })).locale
  } catch {
    // The screen already switched; the preference is saved next time.
  }
}
</script>

<template>
  <Button
    variant="text"
    severity="secondary"
    icon="pi pi-globe"
    :label="t('common.language')"
    @click="toggle"
  />
</template>
