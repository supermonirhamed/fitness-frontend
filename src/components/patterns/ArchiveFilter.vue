<script setup lang="ts">
// "Active / Archived" switch for lists of archivable records (US-00.12).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectButton from 'primevue/selectbutton'

const archived = defineModel<boolean>({ required: true })
const { t } = useI18n()

const options = computed(() => [
  { value: false, label: t('archive.active') },
  { value: true, label: t('archive.archived') },
])
</script>

<template>
  <SelectButton
    v-model="archived"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    size="small"
    :aria-label="t('archive.filter')"
  />
</template>
