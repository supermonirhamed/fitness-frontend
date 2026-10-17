<script setup lang="ts">
// A client's account credit (US-07.09): the money balance from overpayments, refunds and plan
// changes, every movement with its reason and who made it, and the credit of guardians who pay
// for this client. Staff with payments.adjust_credit add or take credit with a reason. Account
// credit is money, separate from a package's class credits (EP-06).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import AdjustCreditDialog from '@/components/payments/AdjustCreditDialog.vue'
import { tenantApi, type AccountCreditSummary } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ clientId: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t, te } = useI18n()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const summary = ref<AccountCreditSummary | null>(null)
async function load() {
  state.value = 'loading'
  try {
    summary.value = await tenantApi.clients.accountCredit(props.clientId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
defineExpose({ load })

const adjusting = ref(false)
async function onAdjusted() {
  await load()
  emit('changed')
}
const kindLabel = (kind: string) =>
  te(`accountCredit.kinds.${kind}`) ? t(`accountCredit.kinds.${kind}`) : kind
</script>

<template>
  <section class="card">
    <header class="card__head">
      <div>
        <h3>{{ t('accountCredit.title') }}</h3>
        <p class="muted">{{ t('accountCredit.hint') }}</p>
      </div>
      <span class="head__end">
        <span v-if="summary" class="balance num">{{ format.money(summary.balance) }}</span>
        <Button
          v-if="summary?.can_adjust"
          size="small"
          variant="outlined"
          icon="pi pi-sliders-h"
          :label="t('accountCredit.adjust')"
          @click="adjusting = true"
        />
      </span>
    </header>
    <p v-for="p in summary?.payers ?? []" :key="p.id" class="payer">
      <i class="pi pi-users" aria-hidden="true" />
      {{ t('accountCredit.payer', { name: p.name, amount: format.money(p.balance) }) }}
    </p>
    <ErrorState v-if="state === 'error'" compact @retry="load" />
    <DataTable
      v-else
      :value="summary?.entries ?? []"
      :loading="state === 'loading'"
      data-key="id"
      size="small"
    >
      <template #empty>
        <EmptyState compact icon="pi-wallet" :title="t('accountCredit.empty')" />
      </template>
      <Column :header="t('accountCredit.when')">
        <template #body="{ data }">
          <span class="num">{{ data.at ? format.dateTime(data.at) : '' }}</span>
        </template>
      </Column>
      <Column :header="t('accountCredit.movement')">
        <template #body="{ data }">
          {{ kindLabel(data.kind) }}
          <div v-if="data.reason" class="muted">{{ data.reason }}</div>
        </template>
      </Column>
      <Column :header="t('accountCredit.by')">
        <template #body="{ data }">{{ data.actor ?? t('accountCredit.system') }}</template>
      </Column>
      <Column :header="t('accountCredit.change')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <span :class="['num', data.change < 0 ? 'neg' : 'pos']"
            >{{ data.change > 0 ? '+' : '' }}{{ format.money(data.change) }}</span
          >
        </template>
      </Column>
      <Column :header="t('accountCredit.balanceAfter')" header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <span class="num">{{ format.money(data.balance_after) }}</span>
        </template>
      </Column>
    </DataTable>
  </section>

  <AdjustCreditDialog
    v-if="summary"
    v-model:visible="adjusting"
    :client-id="clientId"
    :balance="summary.balance"
    @saved="onAdjusted"
  />
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.card__head {
  padding: 14px 16px 6px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.card__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.head__end {
  display: inline-flex;
  gap: 12px;
  align-items: center;
}
.balance {
  font: 600 18px var(--font-sans);
}
.muted {
  margin: 2px 0 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.payer {
  margin: 0 16px 8px;
  display: flex;
  gap: 6px;
  align-items: center;
  font: var(--text-small);
  color: var(--text-secondary);
}
.pos {
  color: var(--sev-success-fg, var(--green-700));
}
.neg {
  color: var(--sev-danger-fg, var(--red-600));
}
:deep(.row-end) {
  text-align: end;
}
</style>
