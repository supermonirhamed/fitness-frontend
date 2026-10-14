<script setup lang="ts">
// An invoice to print or save as PDF (US-07.05), A4, with the same legal content as receipts: the
// organization logo, the branch's legal name, address and VAT number, number and dates, lines,
// VAT breakdown and totals. In the client's language, switchable.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { tenantApi, type InvoiceDocument } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import en from '@/i18n/en'
import ar from '@/i18n/ar'

const route = useRoute()
const {
  t,
  te,
  locale: lang,
} = useI18n({ useScope: 'local', inheritLocale: false, messages: { en, ar } })
const { t: tu } = useI18n()
const format = useFormat()
const doc = ref<InvoiceDocument | null>(null)
const failed = ref(false)
const dir = computed(() => (lang.value === 'ar' ? 'rtl' : 'ltr'))
const print = () => window.print()
const kind = (k: string) => (te(`invoices.kinds.${k}`) ? t(`invoices.kinds.${k}`) : k)

onMounted(async () => {
  try {
    doc.value = await tenantApi.invoices.details(Number(route.params.id))
    lang.value = doc.value.language
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="print-page">
    <div class="toolbar no-print">
      <SelectButton
        v-model="lang"
        :options="[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="tu('payments.receiptLanguage')"
      />
      <Button icon="pi pi-print" :label="tu('invoicesPage.printPdf')" @click="print" />
    </div>
    <p v-if="failed" class="no-print">{{ tu('invoicesPage.loadError') }}</p>
    <article v-else-if="doc" class="sheet" :dir="dir" :lang="lang">
      <header class="sheet__head">
        <div>
          <img
            v-if="doc.organization.logo_url"
            :src="doc.organization.logo_url"
            alt=""
            class="logo"
          />
          <strong class="legal">{{ doc.branch.legal_name ?? doc.organization.name }}</strong>
          <div>{{ doc.branch.name }}</div>
          <div v-if="doc.branch.address">{{ doc.branch.address }}</div>
          <div v-if="doc.branch.tax_number">
            {{ t('invoicesPage.taxNumber') }}: <span dir="ltr">{{ doc.branch.tax_number }}</span>
          </div>
        </div>
        <div class="sheet__title">
          <h1>{{ t('invoicesPage.invoice') }}</h1>
          <div class="mono">{{ doc.number }}</div>
          <div v-if="doc.status === 'Void'" class="void">{{ t('status.Void') }}</div>
        </div>
      </header>
      <dl class="meta">
        <div>
          <dt>{{ t('invoices.payer') }}</dt>
          <dd>
            {{ doc.client.name ?? t('pos.walkIn') }}
            <span class="mono">{{ doc.client.member_id }}</span>
          </dd>
        </div>
        <div>
          <dt>{{ t('invoices.issued') }}</dt>
          <dd dir="ltr">{{ doc.issued_on }}</dd>
        </div>
        <div>
          <dt>{{ t('invoices.due') }}</dt>
          <dd dir="ltr">{{ doc.due_on }}</dd>
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
          <tr v-for="l in doc.lines ?? []" :key="l.id">
            <td>
              {{ l.description }}
              <div class="small">
                {{ kind(l.kind)
                }}<template v-if="l.beneficiary">
                  · {{ t('invoices.forWhom', { name: l.beneficiary }) }}</template
                >
              </div>
            </td>
            <td class="end">{{ l.quantity }}</td>
            <td class="end">{{ format.money(l.unit_price) }}</td>
            <td class="end">{{ l.discount ? format.money(l.discount) : '—' }}</td>
            <td class="end">{{ format.money(l.vat) }}</td>
            <td class="end">{{ format.money(l.total) }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="sums">
        <div>
          <dt>{{ t('invoices.subtotal') }}</dt>
          <dd>{{ format.money(doc.subtotal) }}</dd>
        </div>
        <div v-if="doc.discount">
          <dt>{{ t('invoices.discountCol') }}</dt>
          <dd>−{{ format.money(doc.discount) }}</dd>
        </div>
        <div>
          <dt>
            {{
              doc.vat_rate ? t('invoices.vatRate', { rate: doc.vat_rate }) : t('invoices.vatCol')
            }}
          </dt>
          <dd>{{ format.money(doc.vat) }}</dd>
        </div>
        <div class="grand">
          <dt>{{ t('invoices.total') }}</dt>
          <dd>{{ format.money(doc.total) }}</dd>
        </div>
        <div>
          <dt>{{ t('invoices.paid') }}</dt>
          <dd>{{ format.money(doc.paid) }}</dd>
        </div>
        <div class="grand">
          <dt>{{ t('invoices.balance') }}</dt>
          <dd>{{ format.money(doc.balance) }}</dd>
        </div>
      </dl>
      <footer class="foot">{{ t('payments.thanks') }}</footer>
    </article>
  </div>
</template>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #f4f4f5;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
}
.sheet {
  background: #fff;
  color: #111;
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  padding: 20mm 18mm;
  font: 13px/1.5 var(--font-sans);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
}
.sheet__head {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 2px solid #111;
  padding-bottom: 12px;
}
.logo {
  max-height: 48px;
  display: block;
  margin-bottom: 6px;
}
.legal {
  font-size: 15px;
}
.sheet__title {
  text-align: end;
}
.sheet__title h1 {
  margin: 0;
  font-size: 22px;
}
.void {
  margin-top: 6px;
  font-weight: 700;
  color: #b91c1c;
  border: 2px solid #b91c1c;
  display: inline-block;
  padding: 2px 10px;
}
.meta {
  margin: 16px 0;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
}
.meta dt {
  font-size: 11px;
  color: #555;
}
.meta dd {
  margin: 2px 0 0;
  font-weight: 600;
}
.lines {
  width: 100%;
  border-collapse: collapse;
}
.lines th {
  text-align: start;
  font-size: 11px;
  color: #555;
  border-bottom: 1px solid #999;
  padding: 6px 4px;
}
.lines td {
  border-bottom: 1px solid #ddd;
  padding: 8px 4px;
  vertical-align: top;
}
.end {
  text-align: end !important;
}
.small {
  font-size: 11px;
  color: #555;
}
.sums {
  margin: 16px 0 0;
  margin-inline-start: auto;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sums > div {
  display: flex;
  justify-content: space-between;
}
.sums dd {
  margin: 0;
}
.sums .grand {
  font-weight: 700;
  border-top: 1px solid #999;
  padding-top: 4px;
}
.mono {
  font-family: var(--font-mono);
}
.foot {
  margin-top: 32px;
  text-align: center;
  color: #555;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-page {
    background: none;
    padding: 0;
  }
  .sheet {
    box-shadow: none;
    width: auto;
    min-height: 0;
    padding: 0;
  }
}
</style>
