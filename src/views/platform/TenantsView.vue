<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Skeleton from 'primevue/skeleton'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import CreateTenantDrawer from './CreateTenantDrawer.vue'
import { platformApi, type Tenant } from '@/api/platform'

const { t, d } = useI18n()

const tenants = ref<Tenant[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const drawerOpen = ref(false)
const drawerTenant = ref<Tenant | null>(null)

async function load() {
  state.value = 'loading'
  try {
    tenants.value = (await platformApi.tenants()).data
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

function openCreate() {
  drawerTenant.value = null
  drawerOpen.value = true
}

function openProgress(tenant: Tenant) {
  drawerTenant.value = tenant
  drawerOpen.value = true
}

function upsert(tenant: Tenant) {
  const i = tenants.value.findIndex((x) => x.id === tenant.id)
  if (i === -1) tenants.value.unshift(tenant)
  else tenants.value[i] = tenant
}

onMounted(load)
</script>

<template>
  <div class="tenants">
    <PageHeader :title="t('platform.tenants.title')" :subtitle="t('platform.tenants.subtitle')">
      <template #actions>
        <Button icon="pi pi-plus" :label="t('platform.tenants.new')" @click="openCreate" />
      </template>
    </PageHeader>

    <section class="card">
      <div
        v-if="state === 'loading'"
        class="skeleton"
        aria-busy="true"
        :aria-label="t('common.loading')"
      >
        <Skeleton v-for="n in 5" :key="n" height="40px" />
      </div>

      <EmptyState
        v-else-if="state === 'error'"
        icon="pi-exclamation-triangle"
        :title="t('platform.tenants.loadError')"
      >
        <Button
          severity="secondary"
          variant="outlined"
          icon="pi pi-replay pi-dir"
          :label="t('common.retry')"
          @click="load"
        />
      </EmptyState>

      <EmptyState
        v-else-if="tenants.length === 0"
        icon="pi-building"
        :title="t('platform.tenants.empty')"
        :body="t('platform.tenants.emptyHint')"
      >
        <Button icon="pi pi-plus" :label="t('platform.tenants.new')" @click="openCreate" />
      </EmptyState>

      <DataTable v-else :value="tenants" data-key="id" size="small">
        <Column :header="t('platform.tenants.columns.name')">
          <template #body="{ data }"
            ><span class="tenants__name">{{ data.name }}</span></template
          >
        </Column>
        <Column :header="t('platform.tenants.columns.subdomain')">
          <template #body="{ data }">
            <a
              v-if="data.status === 'Active'"
              :href="data.url"
              target="_blank"
              rel="noopener"
              class="ltr-isolate"
              >{{ data.domain }}</a
            >
            <span v-else class="ltr-isolate">{{ data.domain }}</span>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.owner')">
          <template #body="{ data }">
            <div>{{ data.owner_name }}</div>
            <div class="tenants__sub ltr-isolate">{{ data.owner_email }}</div>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.status')">
          <template #body="{ data }">
            <div class="tenants__status">
              <StatusTag :status="data.status" />
              <Button
                v-if="data.status === 'Failed' || data.status === 'Provisioning'"
                size="small"
                variant="text"
                :icon="data.status === 'Failed' ? 'pi pi-replay pi-dir' : 'pi pi-eye'"
                :label="data.status === 'Failed' ? t('common.retry') : undefined"
                :aria-label="data.status === 'Failed' ? t('common.retry') : data.name"
                @click="openProgress(data)"
              />
            </div>
          </template>
        </Column>
        <Column :header="t('platform.tenants.columns.created')">
          <template #body="{ data }"
            ><span class="num">{{ d(new Date(data.created_at), 'short') }}</span></template
          >
        </Column>
      </DataTable>
    </section>

    <CreateTenantDrawer v-model:visible="drawerOpen" :tenant="drawerTenant" @updated="upsert" />
  </div>
</template>

<style scoped>
.tenants {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
}
.tenants__name {
  font-weight: var(--fw-semibold);
}
.tenants__sub {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.tenants__status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
