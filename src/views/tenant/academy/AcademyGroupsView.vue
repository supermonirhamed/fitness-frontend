<script setup lang="ts">
// The Academy (EP-10): every group of every program at the user's branches, filtered by program,
// branch and status. Coaches only see the groups they coach (US-10.05).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import GroupFormDrawer from '@/components/academy/GroupFormDrawer.vue'
import GroupsTable from '@/components/academy/GroupsTable.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { tenantApi, type AcademyGroup, type AcademyGroupStatus, type Program } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const auth = useStaffAuth()
const branches = computed(() => auth.user?.switchable_locations ?? [])

const state = ref<'loading' | 'ready' | 'error'>('loading')
const groups = ref<AcademyGroup[]>([])
const programs = ref<Program[]>([])
const programId = ref<number | null>(null)
const locationId = ref<number | null>(null)
const status = ref<AcademyGroupStatus | null>(null)
const q = ref('')
const statusOptions = computed(() =>
  (['Draft', 'Published', 'Full', 'Archived'] as const).map((s) => ({
    value: s,
    label: t(`academy.groups.status.${s}`),
  })),
)

async function load() {
  state.value = 'loading'
  try {
    groups.value = await tenantApi.academy.groups.list({
      program_id: programId.value ?? undefined,
      location_id: locationId.value ?? undefined,
      status: status.value ?? undefined,
    })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  load()
  if (auth.can('services.view')) programs.value = await tenantApi.programs.list().catch(() => [])
})
watch([programId, locationId, status], load)

const shown = computed(() => {
  const term = q.value.trim().toLowerCase()
  return term
    ? groups.value.filter((g) =>
        [g.name.ar, g.name.en, g.program?.display_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : groups.value
})

const formOpen = ref(false)
function onSaved(group: AcademyGroup) {
  toast.add({
    severity: 'success',
    summary: t('academy.groups.saved', { name: group.display_name }),
    life: 3000,
  })
  router.push({ name: 'tenant.academy.group', params: { id: group.id } })
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('academy.title')" :subtitle="t('academy.subtitle')">
      <template v-if="auth.can('academy.create') && programs.length" #primary>
        <Button :label="t('academy.groups.new')" icon="pi pi-plus" @click="formOpen = true" />
      </template>
    </PageHeader>

    <div class="toolbar">
      <InputText
        v-model="q"
        :placeholder="t('academy.groups.search')"
        :aria-label="t('academy.groups.search')"
        class="search"
      />
      <Select
        v-if="programs.length > 1"
        v-model="programId"
        :options="programs"
        option-label="display_name"
        option-value="id"
        :placeholder="t('academy.groups.anyProgram')"
        show-clear
      />
      <Select
        v-if="branches.length > 1"
        v-model="locationId"
        :options="branches"
        option-label="name"
        option-value="id"
        :placeholder="t('clients.filters.anyBranch')"
        show-clear
      />
      <Select
        v-model="status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('academy.groups.currentStatus')"
        show-clear
      />
    </div>

    <ErrorState v-if="state === 'error'" class="card" @retry="load" />
    <EmptyState
      v-else-if="state === 'ready' && !groups.length"
      class="card"
      icon="pi-sitemap"
      :title="t('academy.groups.none')"
      :body="
        auth.can('academy.create') ? t('academy.groups.noneHint') : t('academy.groups.noneCoach')
      "
    >
      <RouterLink
        v-if="auth.can('services.view')"
        :to="{ name: 'tenant.services', query: { tab: 'programs' } }"
        >{{ t('academy.groups.toPrograms') }}</RouterLink
      >
    </EmptyState>
    <div v-else class="card">
      <GroupsTable :groups="shown" :loading="state === 'loading'" show-program />
    </div>

    <GroupFormDrawer
      v-model:visible="formOpen"
      :group="null"
      :programs="programs"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.search {
  flex: 1 1 220px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
</style>
