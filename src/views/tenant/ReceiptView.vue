<script setup lang="ts">
// A desk payment's receipt (US-04.15, brief 05 §6), on its own page so it prints cleanly: 80 mm
// thermal or A4, in the page's language. "Download PDF" is the browser's print to PDF.
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { tenantApi, type Receipt } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const route = useRoute()
const { t } = useI18n()
const format = useFormat()
const receipt = ref<Receipt | null>(null)
const failed = ref(false)
const paper = ref<'thermal' | 'a4'>('thermal')

const print = () => window.print()

onMounted(async () => {
  try {
    receipt.value = await tenantApi.payments.receipt(Number(route.params.id))
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div :class="['receipt-page', `receipt-page--${paper}`]">
    <div class="toolbar no-print">
      <SelectButton
        v-model="paper"
        :options="[
          { value: 'thermal', label: t('payments.paper.thermal') },
          { value: 'a4', label: t('payments.paper.a4') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
      <Button icon="pi pi-print" :label="t('payments.print')" @click="print" />
    </div>

    <p v-if="failed" class="no-print">{{ t('payments.loadError') }}</p>
    <article v-else-if="receipt" class="receipt">
      <header class="receipt__head">
        <img
          v-if="receipt.organization.logo_url"
          :src="receipt.organization.logo_url"
          alt=""
          class="receipt__logo"
        />
        <strong>{{ receipt.branch.legal_name ?? receipt.organization.name }}</strong>
        <span>{{ receipt.branch.name }}</span>
        <span v-if="receipt.branch.address">{{ receipt.branch.address }}</span>
        <span v-if="receipt.branch.tax_number"
          >{{ t('payments.taxNumber') }}:
          <span dir="ltr">{{ receipt.branch.tax_number }}</span></span
        >
      </header>

      <h1 class="receipt__title">{{ t('payments.receiptTitle') }}</h1>
      <dl class="receipt__rows">
        <dt>{{ t('payments.receiptNumber') }}</dt>
        <dd class="mono">{{ receipt.receipt_number }}</dd>
        <dt>{{ t('payments.date') }}</dt>
        <dd dir="ltr">{{ receipt.recorded_local }}</dd>
        <dt>{{ t('bookings.columns.client') }}</dt>
        <dd>
          {{ receipt.client.name }} <span class="mono">{{ receipt.client.member_id }}</span>
        </dd>
        <dt>{{ t('payments.item') }}</dt>
        <dd>
          {{ receipt.item.service }}
          <span v-if="receipt.item.session" dir="ltr">· {{ receipt.item.session }}</span>
        </dd>
      </dl>
      <dl class="receipt__rows receipt__sums">
        <dt>{{ t('payments.subtotal') }}</dt>
        <dd class="num">{{ format.money(receipt.net) }}</dd>
        <template v-if="receipt.vat_rate">
          <dt>{{ t('payments.vat', { rate: Number(receipt.vat_rate) }) }}</dt>
          <dd class="num">{{ format.money(receipt.vat) }}</dd>
        </template>
        <dt class="strong">{{ t('payments.total') }}</dt>
        <dd class="num strong">{{ format.money(receipt.amount) }}</dd>
        <dt>{{ t('payments.method') }}</dt>
        <dd>
          {{ t(`payments.methods.${receipt.method}`) }}
          <span v-if="receipt.reference" dir="ltr">({{ receipt.reference }})</span>
        </dd>
        <dt>{{ t('payments.staff') }}</dt>
        <dd>{{ receipt.recorded_by }}</dd>
      </dl>
      <p v-if="receipt.status === 'Voided'" class="receipt__void">
        {{ t('payments.voidedStamp', { reason: receipt.void_reason }) }}
      </p>
      <footer class="receipt__foot">{{ t('payments.thanks') }}</footer>
    </article>
  </div>
</template>

<style scoped>
.receipt-page {
  min-height: 100vh;
  background: var(--surface-ground, #f4f4f5);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.receipt {
  background: #fff;
  color: #111;
  padding: 16px;
  font: 13px/1.5 var(--font-sans);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
}
.receipt-page--thermal .receipt {
  width: 80mm;
  max-width: 100%;
}
.receipt-page--a4 .receipt {
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  padding: 24mm 20mm;
  font-size: 14px;
}
.receipt__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.receipt__logo {
  max-height: 48px;
  max-width: 60%;
  margin-bottom: 6px;
}
.receipt__title {
  font-size: 15px;
  text-align: center;
  margin: 12px 0 8px;
  border-block: 1px dashed #999;
  padding: 6px 0;
}
.receipt__rows {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0 0 10px;
}
.receipt__rows dd {
  margin: 0;
  text-align: end;
}
.receipt__sums {
  border-top: 1px dashed #999;
  padding-top: 8px;
}
.strong {
  font-weight: 700;
}
.mono {
  font-family: var(--font-mono, monospace);
}
.receipt__void {
  text-align: center;
  font-weight: 700;
  color: #b91c1c;
  border: 2px solid #b91c1c;
  padding: 4px;
}
.receipt__foot {
  text-align: center;
  margin-top: 12px;
  color: #555;
}
@media print {
  .no-print {
    display: none !important;
  }
  .receipt-page {
    background: none;
    padding: 0;
  }
  .receipt {
    box-shadow: none;
  }
}
@page {
  margin: 0;
}
</style>
