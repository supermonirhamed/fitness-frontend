<script setup lang="ts">
// Account deletion requests from the client app (US-11.06): who asked, why and by when staff must
// act; completing one anonymizes the client (US-05.13: personal data removed, financial records
// kept) and closes their app account.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type ClientDeletionRequest } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const status = ref<'Pending' | 'Completed' | 'Cancelled'>('Pending')
const requests = ref<ClientDeletionRequest[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const confirming = ref<ClientDeletionRequest | null>(null)
const busy = ref(false)

async function load() {
  state.value = 'loading'
  try {
    requests.value = await tenantApi.clientApp.deletionRequests(status.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch([visible, status], ([open]) => open && load(), { immediate: true })

async function complete() {
  if (!confirming.value) return
  busy.value = true
  try {
    await tenantApi.clientApp.completeDeletion(confirming.value.id)
    toast.add({ severity: 'success', summary: t('deletionRequests.completed'), life: 3000 })
    confirming.value = null
    load()
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :header="t('deletionRequests.title')"
    class="drawer"
  >
    <p class="muted">{{ t('deletionRequests.hint') }}</p>
    <SelectButton
      v-model="status"
      :options="
        ['Pending', 'Completed', 'Cancelled'].map((s) => ({
          value: s,
          label: t(`deletionRequests.statuses.${s}`),
        }))
      "
      option-label="label"
      option-value="value"
      :allow-empty="false"
      class="filter"
    />
    <Skeleton v-if="state === 'loading'" height="64px" />
    <ErrorState v-else-if="state === 'error'" compact @retry="load" />
    <EmptyState
      v-else-if="!requests.length"
      compact
      icon="pi-inbox"
      :title="t('deletionRequests.none')"
    />
    <ul v-else class="list">
      <li v-for="r in requests" :key="r.id" class="item">
        <div class="head">
          <RouterLink :to="{ name: 'tenant.client', params: { id: r.client.id } }">{{
            r.client.name
          }}</RouterLink>
          <Tag v-if="r.overdue" severity="danger" :value="t('deletionRequests.overdue')" />
        </div>
        <span class="muted small"
          >{{ r.client.member_id }} ·
          {{ t('deletionRequests.due', { date: showDay(format, r.due_on) }) }}</span
        >
        <p v-if="r.reason" class="reason">“{{ r.reason }}”</p>
        <span v-if="r.processed_by" class="muted small"
          >{{ r.processed_by }} · {{ r.processed_at ? format.dateTime(r.processed_at) : '' }}</span
        >
        <Button
          v-if="r.status === 'Pending'"
          :label="t('deletionRequests.complete')"
          icon="pi pi-eraser"
          severity="danger"
          variant="outlined"
          size="small"
          @click="confirming = r"
        />
      </li>
    </ul>
    <ConfirmActionDialog
      v-if="confirming"
      :visible="!!confirming"
      :title="t('deletionRequests.confirmTitle', { name: confirming.client.name })"
      :description="t('deletionRequests.confirmBody')"
      :confirm-label="t('deletionRequests.complete')"
      :loading="busy"
      destructive
      @update:visible="(v: boolean) => !v && (confirming = null)"
      @confirm="complete"
    />
  </Drawer>
</template>

<style scoped>
.drawer {
  width: min(100vw, 480px);
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
.filter {
  margin: 8px 0 16px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 0;
  border-top: 1px solid var(--border-default);
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.reason {
  margin: 0;
  white-space: pre-line;
}
</style>
