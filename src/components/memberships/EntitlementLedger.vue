<script setup lang="ts">
// A package's credit history (US-06.09): every credit added, used, returned, held, expired or
// adjusted, with the related booking, who did it, the reason and the balance after it.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import { tenantApi, type LedgerEntry } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ clientId: number; entitlementId: number }>()
const { t } = useI18n()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const entries = ref<LedgerEntry[]>([])
async function load() {
  state.value = 'loading'
  try {
    entries.value = await tenantApi.clients.entitlementLedger(props.clientId, props.entitlementId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="ledger">
    <Skeleton v-if="state === 'loading'" height="60px" />
    <ErrorState v-else-if="state === 'error'" compact @retry="load" />
    <p v-else-if="!entries.length" class="muted">{{ t('ledger.empty') }}</p>
    <table v-else class="table">
      <thead>
        <tr>
          <th>{{ t('ledger.when') }}</th>
          <th>{{ t('ledger.what') }}</th>
          <th class="end">{{ t('ledger.change') }}</th>
          <th class="end">{{ t('ledger.balance') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in entries" :key="l.id">
          <td class="muted num">{{ l.at ? format.dateTime(l.at) : '' }}</td>
          <td>
            <strong>{{ t(`ledger.kinds.${l.kind}`) }}</strong>
            <span v-if="l.booking" class="muted">
              · {{ l.booking.service
              }}<template v-if="l.booking.starts_at">
                ({{ format.dateTime(l.booking.starts_at) }})</template
              ></span
            >
            <div v-if="l.reason || l.actor" class="muted">
              {{ [l.reason, l.actor].filter(Boolean).join(' · ') }}
            </div>
          </td>
          <td :class="['end', 'num', l.change > 0 ? 'plus' : 'minus']">
            {{ l.change > 0 ? `+${l.change}` : l.change }}
          </td>
          <td class="end num">{{ l.balance_after }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ledger {
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font: var(--text-small);
}
.table th {
  text-align: start;
  font-weight: 500;
  color: var(--text-muted);
  padding: 4px 6px;
}
.table td {
  padding: 6px;
  border-top: 1px solid var(--border-subtle);
  vertical-align: top;
}
.end {
  text-align: end !important;
}
.muted {
  color: var(--text-muted);
}
.plus {
  color: var(--sev-success-fg, var(--green-700));
}
.minus {
  color: var(--sev-danger-fg, var(--red-600));
}
</style>
