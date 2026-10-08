<script setup lang="ts">
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()
</script>

<template>
  <Button
    variant="text"
    severity="secondary"
    icon="pi pi-globe"
    :label="t('common.language')"
    @click="setLocale(locale === 'ar' ? 'en' : 'ar')"
  />
</template>
