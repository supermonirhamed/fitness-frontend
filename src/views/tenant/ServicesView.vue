<script setup lang="ts">
// Services (EP-02): the catalog (US-02.02/03), programs (US-02.09) and categories (US-02.01).
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
import ProgramsPanel from '@/components/services/ProgramsPanel.vue'
import ServicesPanel from '@/components/services/ServicesPanel.vue'
import { tenantApi, type ServiceCategory } from '@/api/tenant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const TABS = ['services', 'programs', 'categories']
const tab = ref(TABS.includes(String(route.query.tab)) ? String(route.query.tab) : 'services')
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
        <Tab value="programs">{{ t('catalog.tabs.programs') }}</Tab>
        <Tab value="categories">{{ t('catalog.tabs.categories') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="services"><ServicesPanel :categories="categories" /></TabPanel>
        <TabPanel value="programs"
          ><ProgramsPanel v-if="tab === 'programs'" :categories="categories"
        /></TabPanel>
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
