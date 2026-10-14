<script setup lang="ts">
// An invoice (US-07.01): number, status, payer, branch, issue and due dates; each line with what it
// was for, for whom, its discount (with the reason) and VAT; the totals, what was paid and the
// balance; and the payments against it, each opening its receipt. Read-only: an issued invoice is
// never edited.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type Invoice } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ invoiceId: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, te } = useI18n()
const format = useFormat()

const invoice = ref<Invoice | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
async function load() {
  if (!props.invoiceId) return
  state.value = 'loading'
  try {
    invoice.value = await tenantApi.invoices.get(props.invoiceId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(visible, (open) => open && load())

const kind = (k: string) => (te(`invoices.kinds.${k}`) ? t(`invoices.kinds.${k}`) : k)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="invoice ? t('invoices.detailsTitle', { number: invoice.number }) : t('invoices.title')"
    :style="{ width: '760px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div v-if="state === 'loading'" class="stack">
      <Skeleton height="48px" />
      <Skeleton height="120px" />
    </div>
    <ErrorState v-else-if="state === 'error'" compact @retry="load" />
    <div v-else-if="invoice" class="stack">
      <dl class="facts">
        <div>
          <dt>{{ t('bookings.columns.status') }}</dt>
          <dd>
            <StatusTag :status="invoice.status" size="sm" />
            <small v-if="invoice.overdue" class="overdue">{{ t('invoices.overdue') }}</small>
          </dd>
        </div>
        <div>
          <dt>{{ t('invoices.payer') }}</dt>
          <dd>{{ invoice.client.name ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('invoices.branch') }}</dt>
          <dd>{{ invoice.location ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('invoices.issued') }}</dt>
          <dd>{{ format.date(invoice.issued_on) }}</dd>
        </div>
        <div>
          <dt>{{ t('invoices.due') }}</dt>
          <dd>{{ format.date(invoice.due_on) }}</dd>
        </div>
        <div v-if="invoice.created_by">
          <dt>{{ t('invoices.issuedBy') }}</dt>
          <dd>{{ invoice.created_by }}</dd>
        </div>
      </dl>

      <table class="lines">
        <thead>
          <tr>
            <th>{{ t('invoices.item') }}</th>
            <th class="end">{{ t('invoices.qty') }}</th>
            <th class="end">{{ t('invoices.unitPrice') }}</th>
            <th class="end">{{ t('invoices.discountCol') }}</th>
            <th class="end">{{ t('invoices.vatCol') }}</th>
            <th class="end">{{ t('invoices.total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in invoice.lines ?? []" :key="l.id">
            <td>
              <div class="item">{{ l.description }}</div>
              <small class="muted"
                >{{ kind(l.kind)
                }}<template v-if="l.beneficiary">
                  · {{ t('invoices.forWhom', { name: l.beneficiary }) }}</template
                ><template v-if="l.period_starts_on && l.period_ends_on">
                  · {{ format.date(l.period_starts_on) }} –
                  {{ format.date(l.period_ends_on) }}</template
                ></small
              >
              <small v-if="l.discount_reason" class="muted block">{{
                t('invoices.discountReason', { reason: l.discount_reason })
              }}</small>
            </td>
            <td class="end num">{{ l.quantity }}</td>
            <td class="end num">{{ format.money(l.unit_price) }}</td>
            <td class="end num">{{ l.discount ? `−${format.money(l.discount)}` : '—' }}</td>
            <td class="end num">{{ format.money(l.vat) }}</td>
            <td class="end num strong">{{ format.money(l.total) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="bottom">
        <div class="payments">
          <span class="label">{{ t('invoices.paymentsTitle') }}</span>
          <p v-if="!invoice.payments?.length" class="muted">{{ t('invoices.noPayments') }}</p>
          <ul v-else>
            <li v-for="p in invoice.payments" :key="p.id">
              <a :href="`/receipts/${p.id}`" target="_blank" rel="noopener" class="mono">{{
                p.receipt_number
              }}</a>
              <span class="muted">{{ p.recorded_at ? format.date(p.recorded_at) : '' }}</span>
              <span class="muted">{{ t(`payments.methods.${p.method}`) }}</span>
              <span :class="['num', { voided: p.status === 'Voided' }]">{{
                format.money(p.amount)
              }}</span>
            </li>
          </ul>
        </div>
        <dl class="totals">
          <div>
            <dt>{{ t('invoices.subtotal') }}</dt>
            <dd class="num">{{ format.money(invoice.subtotal) }}</dd>
          </div>
          <div v-if="invoice.discount">
            <dt>{{ t('invoices.discountCol') }}</dt>
            <dd class="num">−{{ format.money(invoice.discount) }}</dd>
          </div>
          <div>
            <dt>
              {{
                invoice.vat_rate
                  ? t('invoices.vatRate', { rate: invoice.vat_rate })
                  : t('invoices.vatCol')
              }}
            </dt>
            <dd class="num">{{ format.money(invoice.vat) }}</dd>
          </div>
          <div class="grand">
            <dt>{{ t('invoices.total') }}</dt>
            <dd class="num">{{ format.money(invoice.total) }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.paid') }}</dt>
            <dd class="num">{{ format.money(invoice.paid) }}</dd>
          </div>
          <div :class="{ due: invoice.balance > 0 && invoice.status !== 'Void' }">
            <dt>{{ t('invoices.balance') }}</dt>
            <dd class="num">{{ format.money(invoice.balance) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.facts dt,
.label {
  font: var(--text-caption);
  color: var(--text-muted);
}
.facts dd {
  margin: 2px 0 0;
  font: 500 14px var(--font-sans);
  display: flex;
  gap: 6px;
  align-items: center;
}
.overdue {
  color: var(--sev-danger-fg, var(--red-600));
  font: var(--text-caption);
}
.lines {
  width: 100%;
  border-collapse: collapse;
}
.lines th {
  font: var(--text-caption);
  color: var(--text-muted);
  text-align: start;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-default);
}
.lines td {
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}
.lines .end {
  text-align: end;
}
.item {
  font-weight: 500;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.block {
  display: block;
}
.strong {
  font-weight: 600;
}
.mono {
  font-family: var(--font-mono);
}
.bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 24px;
}
.payments ul {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.payments li {
  display: flex;
  gap: 10px;
  align-items: baseline;
}
.payments p {
  margin: 6px 0 0;
}
.voided {
  text-decoration: line-through;
  color: var(--text-muted);
}
.totals {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.totals > div {
  display: flex;
  justify-content: space-between;
  font: var(--text-small);
}
.totals dt {
  color: var(--text-secondary);
}
.totals dd {
  margin: 0;
}
.totals .grand {
  font: 600 15px var(--font-sans);
  border-top: 1px solid var(--border-default);
  padding-top: 6px;
}
.totals .due dd {
  color: var(--sev-danger-fg, var(--red-600));
  font-weight: 600;
}
@media (max-width: 640px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bottom {
    grid-template-columns: 1fr;
  }
}
</style>
