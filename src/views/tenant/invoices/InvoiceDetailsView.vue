<script setup lang="ts">
// An invoice's page (US-07.05): status, payer, branch, dates; each line with what it was for, for
// whom, its discount and VAT; totals, paid and balance; the payments applied (each opening its
// receipt); refunds and credit notes; and what happened to it. Record a payment, print or download
// it as PDF, or email it to the client.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Popover from 'primevue/popover'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import RecordPaymentDialog from '@/components/payments/RecordPaymentDialog.vue'
import VoidInvoiceDialog from '@/components/payments/VoidInvoiceDialog.vue'
import VoidPaymentDialog from '@/components/payments/VoidPaymentDialog.vue'
import { tenantApi, type InvoiceDocument, type Payment } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()

const id = computed(() => Number(route.params.id))
const doc = ref<InvoiceDocument | null>(null)
const state = ref<'loading' | 'ready' | 'error' | 'forbidden' | 'missing'>('loading')
async function load() {
  state.value = 'loading'
  try {
    doc.value = await tenantApi.invoices.details(id.value)
    state.value = 'ready'
  } catch (e) {
    const status = statusOf(e)
    state.value = status === 403 ? 'forbidden' : status === 404 ? 'missing' : 'error'
  }
}
onMounted(load)

const isOpen = computed(() => doc.value?.status === 'Due' || doc.value?.status === 'PartiallyPaid')
const kind = (k: string) => (te(`invoices.kinds.${k}`) ? t(`invoices.kinds.${k}`) : k)
const action = (a: string) => {
  const key = `timeline.actions.${a.replace(/\./g, '_')}`
  return te(key) ? t(key) : a
}

// Payment
const paying = ref(false)

// Voiding (US-07.06)
const voidingInvoice = ref(false)
const voidingPayment = ref<Payment | null>(null)
const voidPaymentOpen = ref(false)
function voidPayment(p: Payment) {
  voidingPayment.value = p
  voidPaymentOpen.value = true
}
function onVoided() {
  toast.add({ severity: 'success', summary: t('voiding.done'), life: 3000 })
  load()
}

// Print / PDF, in a page of its own.
function print() {
  window.open(
    router.resolve({ name: 'tenant.invoice.print', params: { id: id.value } }).href,
    '_blank',
  )
}

// Email
const emailPanel = ref<InstanceType<typeof Popover>>()
const email = ref('')
const sending = ref(false)
async function send() {
  sending.value = true
  try {
    const { sent_to } = await tenantApi.invoices.email(id.value, email.value.trim() || null)
    emailPanel.value?.hide()
    toast.add({
      severity: 'success',
      summary: sent_to
        ? t('invoicesPage.emailedTo', { email: sent_to })
        : t('invoicesPage.emailed'),
      life: 4000,
    })
    load()
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 5000 })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="doc ? t('invoices.detailsTitle', { number: doc.number }) : t('invoicesPage.title')"
      :breadcrumb="[
        { label: t('invoicesPage.title'), to: { name: 'tenant.invoices' } },
        { label: doc?.number ?? '…' },
      ]"
    >
      <template v-if="doc" #status>
        <StatusTag :status="doc.status" />
        <Tag v-if="doc.overdue" severity="danger" :value="t('invoices.overdue')" />
      </template>
      <template v-if="doc" #actions>
        <Button
          icon="pi pi-print"
          :label="t('invoicesPage.printPdf')"
          severity="secondary"
          variant="outlined"
          @click="print"
        />
        <Button
          icon="pi pi-envelope"
          :label="t('payments.email')"
          severity="secondary"
          variant="outlined"
          @click="emailPanel?.toggle($event)"
        />
        <Button
          v-if="doc.can_void"
          icon="pi pi-ban"
          :label="t('voiding.voidInvoice')"
          severity="danger"
          variant="outlined"
          @click="voidingInvoice = true"
        />
        <Popover ref="emailPanel">
          <form class="email" @submit.prevent="send">
            <label for="inv-email" class="label">{{ t('payments.emailTo') }}</label>
            <InputText
              id="inv-email"
              v-model="email"
              type="email"
              dir="ltr"
              :placeholder="t('payments.emailPlaceholder')"
            />
            <small class="muted">{{ t('invoicesPage.emailHint') }}</small>
            <Button
              type="submit"
              :label="t('payments.send')"
              icon="pi pi-send"
              :loading="sending"
            />
          </form>
        </Popover>
      </template>
      <template v-if="doc && isOpen && doc.client.id && auth.can('payments.create')" #primary>
        <Button icon="pi pi-wallet" :label="t('recordPayment.title')" @click="paying = true" />
      </template>
    </PageHeader>

    <div v-if="state === 'loading'" class="card pad"><Skeleton height="220px" /></div>
    <NoPermission v-else-if="state === 'forbidden'" class="card" />
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-file"
      :title="t('invoicesPage.missing')"
    />
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('invoicesPage.loadError')"
      @retry="load"
    />
    <template v-else-if="doc">
      <Message v-if="doc.void" severity="error" :closable="false" icon="pi pi-ban">{{
        t('voiding.voidBanner', {
          reason: doc.void.reason,
          by: doc.void.by ?? '—',
          date: format.dateTime(doc.void.at),
        })
      }}</Message>
      <section class="card pad">
        <dl class="facts">
          <div>
            <dt>{{ t('invoices.payer') }}</dt>
            <dd>
              <RouterLink
                v-if="doc.client.id"
                :to="{ name: 'tenant.client', params: { id: doc.client.id } }"
                >{{ doc.client.name }}</RouterLink
              >
              <template v-else>{{ t('pos.walkIn') }}</template>
            </dd>
          </div>
          <div>
            <dt>{{ t('invoices.branch') }}</dt>
            <dd>{{ doc.branch.name }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.issued') }}</dt>
            <dd>{{ format.date(doc.issued_on) }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.due') }}</dt>
            <dd :class="{ overdue: doc.overdue }">{{ format.date(doc.due_on) }}</dd>
          </div>
          <div v-if="doc.created_by">
            <dt>{{ t('invoices.issuedBy') }}</dt>
            <dd>{{ doc.created_by }}</dd>
          </div>
          <div v-if="doc.branch.tax_number">
            <dt>{{ t('invoicesPage.taxNumber') }}</dt>
            <dd dir="ltr">{{ doc.branch.tax_number }}</dd>
          </div>
        </dl>
      </section>

      <section class="card">
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
            <tr v-for="l in doc.lines ?? []" :key="l.id">
              <td>
                <div class="strong">{{ l.description }}</div>
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
        <dl class="totals">
          <div>
            <dt>{{ t('invoices.subtotal') }}</dt>
            <dd class="num">{{ format.money(doc.subtotal) }}</dd>
          </div>
          <div v-if="doc.discount">
            <dt>{{ t('invoices.discountCol') }}</dt>
            <dd class="num">−{{ format.money(doc.discount) }}</dd>
          </div>
          <div>
            <dt>
              {{
                doc.vat_rate ? t('invoices.vatRate', { rate: doc.vat_rate }) : t('invoices.vatCol')
              }}
            </dt>
            <dd class="num">{{ format.money(doc.vat) }}</dd>
          </div>
          <div class="grand">
            <dt>{{ t('invoices.total') }}</dt>
            <dd class="num">{{ format.money(doc.total) }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.paid') }}</dt>
            <dd class="num">{{ format.money(doc.paid) }}</dd>
          </div>
          <div :class="{ due: doc.balance > 0 && doc.status !== 'Void' }">
            <dt>{{ t('invoices.balance') }}</dt>
            <dd class="num">{{ format.money(doc.balance) }}</dd>
          </div>
        </dl>
      </section>

      <div class="cols">
        <section class="card pad">
          <h3>{{ t('invoices.paymentsTitle') }}</h3>
          <p v-if="!doc.payments?.length" class="muted">{{ t('invoices.noPayments') }}</p>
          <ul v-else class="rows">
            <li v-for="p in doc.payments" :key="p.id">
              <a :href="`/receipts/${p.id}`" target="_blank" rel="noopener" class="mono">{{
                p.receipt_number
              }}</a>
              <span class="muted">{{ p.paid_on ? format.date(p.paid_on) : '' }}</span>
              <span class="muted">{{ t(`payments.methods.${p.method}`) }}</span>
              <span :class="['num', 'grow', { voided: p.status === 'Voided' }]">{{
                format.money(p.amount)
              }}</span>
              <Tag
                v-if="p.status === 'Voided'"
                class="tag-sm"
                severity="secondary"
                :value="t('clientProfile.payment.Voided')"
              />
              <Button
                v-if="p.can_void"
                icon="pi pi-ban"
                size="small"
                variant="text"
                severity="danger"
                :aria-label="t('voiding.voidPayment')"
                @click="voidPayment(p)"
              />
            </li>
          </ul>
          <h3 class="spaced">{{ t('invoicesPage.refundsTitle') }}</h3>
          <p class="muted">{{ t('invoicesPage.noRefunds') }}</p>
        </section>
        <section class="card pad">
          <h3>{{ t('invoicesPage.activity') }}</h3>
          <ol class="activity">
            <li v-for="(a, i) in doc.activity" :key="i">
              <strong>{{ action(a.action) }}</strong>
              <small class="muted"
                >{{ a.at ? format.dateTime(a.at) : ''
                }}<template v-if="a.user"> · {{ a.user }}</template
                ><template v-if="a.values.receipt_number"> · {{ a.values.receipt_number }}</template
                ><template v-if="typeof a.values.reason === 'string'">
                  · {{ a.values.reason }}</template
                ></small
              >
            </li>
          </ol>
        </section>
      </div>

      <VoidInvoiceDialog v-model:visible="voidingInvoice" :invoice="doc" @voided="onVoided" />
      <VoidPaymentDialog
        v-model:visible="voidPaymentOpen"
        :payment="voidingPayment"
        @voided="onVoided"
      />
      <RecordPaymentDialog
        v-if="doc.client.id"
        v-model:visible="paying"
        :client-id="doc.client.id"
        :invoices="[doc]"
        :invoice-id="doc.id"
        :credit="0"
        @saved="load"
      />
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.pad {
  padding: 16px;
}
.facts {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.facts dt,
.label {
  font: var(--text-caption);
  color: var(--text-muted);
}
.facts dd {
  margin: 2px 0 0;
  font: 500 14px var(--font-sans);
}
.lines {
  width: 100%;
  border-collapse: collapse;
}
.lines th {
  font: var(--text-caption);
  color: var(--text-muted);
  text-align: start;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-default);
}
.lines td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}
.end {
  text-align: end !important;
}
.strong {
  font-weight: 600;
}
.block {
  display: block;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
  margin: 0;
}
.mono {
  font-family: var(--font-mono);
}
.totals {
  margin: 0;
  margin-inline-start: auto;
  padding: 12px 16px 16px;
  width: min(320px, 100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.totals > div {
  display: flex;
  justify-content: space-between;
  font: var(--text-small);
}
.totals dd {
  margin: 0;
}
.totals .grand {
  font: 600 16px var(--font-sans);
  border-top: 1px solid var(--border-default);
  padding-top: 6px;
}
.due dd,
.overdue {
  color: var(--sev-danger-fg, var(--red-600));
  font-weight: 600;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
h3 {
  margin: 0 0 10px;
  font: var(--text-h4);
}
.spaced {
  margin-top: 18px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rows li {
  display: flex;
  gap: 10px;
  align-items: center;
}
.grow {
  margin-inline-start: auto;
}
.voided {
  text-decoration: line-through;
  color: var(--text-muted);
}
.activity {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.activity li {
  display: flex;
  flex-direction: column;
  padding-inline-start: 12px;
  border-inline-start: 2px solid var(--border-default);
}
.email {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
}
@media (max-width: 860px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
