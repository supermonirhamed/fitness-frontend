<script setup lang="ts">
// The client app is turned off (US-11.01): who to contact instead.
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const app = useClientApp()
</script>

<template>
  <div class="ca-card">
    <EmptyState icon="pi-mobile" :title="t('app.closed.title')" :body="t('app.closed.body')" />
    <ul v-if="app.config" class="ca-list contact">
      <li v-if="app.config.contact.phone">
        <i class="pi pi-phone" aria-hidden="true" />
        <a :href="`tel:${app.config.contact.phone}`" dir="ltr">{{ app.config.contact.phone }}</a>
      </li>
      <li v-if="app.config.contact.email">
        <i class="pi pi-envelope" aria-hidden="true" />
        <a :href="`mailto:${app.config.contact.email}`">{{ app.config.contact.email }}</a>
      </li>
      <li v-if="app.config.contact.address">
        <i class="pi pi-map-marker" aria-hidden="true" />{{ app.config.contact.address }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.contact li {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
}
</style>
