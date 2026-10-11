<script setup lang="ts">
// Services (EP-02), laid out as the design (ui_kits/admin/ServicesScreen.jsx): counts in the header,
// Categories as its own page, a split "New service ▾" button, and Services | Programs tabs.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SplitButton from 'primevue/splitbutton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import PageHeader from '@/components/patterns/PageHeader.vue'
import ProgramsPanel from '@/components/services/ProgramsPanel.vue'
import ServicesPanel from '@/components/services/ServicesPanel.vue'
import { tenantApi, type ServiceCategory } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))
const TABS = ['services', 'programs']
const tab = ref(TABS.includes(String(route.query.tab)) ? String(route.query.tab) : 'services')
watch(tab, (value) => router.replace({ query: value === 'services' ? {} : { tab: value } }))

const categories = ref<ServiceCategory[]>([])
const serviceCount = ref<number | null>(null)
const programCount = ref<number | null>(null)
async function loadCounts() {
  try {
    const [services, programs] = await Promise.all([
      tenantApi.services.list({}),
      tenantApi.programs.list(),
    ])
    serviceCount.value = services.filter((s) => s.status !== 'Archived').length
    programCount.value = programs.length
  } catch {
    serviceCount.value = programCount.value = null
  }
}
onMounted(async () => {
  loadCounts()
  try {
    categories.value = await tenantApi.serviceCategories.list()
  } catch {
    categories.value = []
  }
})

const programsPanel = ref<InstanceType<typeof ProgramsPanel>>()
const newService = () => router.push({ name: 'tenant.services.new' })
async function newProgram() {
  tab.value = 'programs'
  // The panel mounts with the tab.
  await new Promise((resolve) => setTimeout(resolve))
  programsPanel.value?.create()
}
const createItems = computed(() => [
  { label: t('catalog.serviceOne'), icon: 'pi pi-th-large', command: newService },
  { label: t('catalog.programOne'), icon: 'pi pi-sitemap', command: newProgram },
])
</script>

<template>
  <div class="page">
    <PageHeader :title="t('catalog.title')">
      <template v-if="serviceCount !== null" #meta>
        <span
          >{{ t('catalog.servicesCount', serviceCount) }} ·
          {{ t('catalog.programsCount', programCount ?? 0) }}</span
        >
      </template>
      <template #actions>
        <Button
          :label="t('catalog.tabs.categories')"
          icon="pi pi-tags"
          severity="secondary"
          variant="outlined"
          @click="router.push({ name: 'tenant.services.categories' })"
        />
      </template>
      <template v-if="canCreate" #primary>
        <SplitButton
          :label="t('catalog.newService')"
          icon="pi pi-plus"
          :model="createItems"
          :disabled="!categories.length"
          :menu-button-props="{ 'aria-label': t('catalog.moreCreate') }"
          @click="newService"
        />
      </template>
    </PageHeader>
    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="services"
          >{{ t('catalog.tabs.services') }}
          <span v-if="serviceCount !== null" class="tab-count">{{ serviceCount }}</span></Tab
        >
        <Tab value="programs"
          >{{ t('catalog.tabs.programs') }}
          <span v-if="programCount !== null" class="tab-count">{{ programCount }}</span></Tab
        >
      </TabList>
      <TabPanels>
        <TabPanel value="services">
          <ServicesPanel :categories="categories" @create="newService" />
        </TabPanel>
        <TabPanel value="programs">
          <ProgramsPanel
            v-if="tab === 'programs'"
            ref="programsPanel"
            :categories="categories"
            @changed="loadCounts"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
