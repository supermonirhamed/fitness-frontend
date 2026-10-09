<script setup lang="ts">
// Services (EP-02): the catalog (US-02.02/03) and its categories (US-02.01).
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import PageHeader from '@/components/patterns/PageHeader.vue'
import CategoriesPanel from '@/components/services/CategoriesPanel.vue'
import ServicesPanel from '@/components/services/ServicesPanel.vue'
import { tenantApi, type ServiceCategory } from '@/api/tenant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const tab = ref(route.query.tab === 'categories' ? 'categories' : 'services')
watch(tab, (value) => router.replace({ query: value === 'services' ? {} : { tab: value } }))

const categories = ref<ServiceCategory[]>([])
async function loadCategories() {
  try {
    categories.value = await tenantApi.serviceCategories.list()
  } catch {
    categories.value = []
  }
}
onMounted(loadCategories)
</script>

<template>
  <div class="page">
    <PageHeader :title="t('catalog.title')" :subtitle="t('catalog.subtitle')" />
    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="services">{{ t('catalog.tabs.services') }}</Tab>
        <Tab value="categories">{{ t('catalog.tabs.categories') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="services"><ServicesPanel :categories="categories" /></TabPanel>
        <TabPanel value="categories"><CategoriesPanel @changed="loadCategories" /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
