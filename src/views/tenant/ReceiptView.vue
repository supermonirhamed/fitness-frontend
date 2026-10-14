<script setup lang="ts">
// A payment's receipt (US-04.15, US-07.04), on its own page so it prints cleanly: 80 mm thermal or
// A4, in the client's language (switchable). "Download PDF" prints A4 to PDF in the browser;
// "Email" sends it to the client (or an address given) in their language.
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import { tenantApi, type Receipt } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { apiMessage } from '@/lib/apiErrors'
import en from '@/i18n/en'
import ar from '@/i18n/ar'

const route = useRoute()
// The receipt has its own language, the client's (not necessarily the staff member's); the
// toolbar stays in the staff member's.
const { t, locale: lang } = useI18n({
  useScope: 'local',
  inheritLocale: false,
  messages: { en, ar },
})
const { t: tu } = useI18n()
const format = useFormat()
const toast = useToast()
const receipt = ref<Receipt | null>(null)
const failed = ref(false)
const paper = ref<'thermal' | 'a4'>('thermal')
const dir = computed(() => (lang.value === 'ar' ? 'rtl' : 'ltr'))

const print = () => window.print()
async function downloadPdf() {
  paper.value = 'a4'
  await nextTick()
  toast.add({ severity: 'info', summary: tu('payments.pdfHint'), life: 5000 })
  window.print()
}

// Email
const emailPanel = ref<InstanceType<typeof Popover>>()
const email = ref('')
const sending = ref(false)
async function send() {
  if (!receipt.value) return
  sending.value = true
  try {
    const { sent_to } = await tenantApi.payments.emailReceipt(
      receipt.value.id,
      email.value.trim() || null,
    )
    emailPanel.value?.hide()
    toast.add({
      severity: 'success',
      summary: sent_to ? tu('payments.emailedTo', { email: sent_to }) : tu('payments.emailed'),
      life: 4000,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: apiMessage(e) ?? tu('common.genericError'),
      life: 5000,
    })
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  try {
    receipt.value = await tenantApi.payments.receipt(Number(route.params.id))
    lang.value = receipt.value.language ?? 'ar'
    email.value = receipt.value.client.email ?? ''
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
          { value: 'thermal', label: tu('payments.paper.thermal') },
          { value: 'a4', label: tu('payments.paper.a4') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
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
      <Button icon="pi pi-print" :label="tu('payments.print')" @click="print" />
      <Button
        icon="pi pi-file-pdf"
        :label="tu('payments.downloadPdf')"
        severity="secondary"
        variant="outlined"
        @click="downloadPdf"
      />
      <Button
        icon="pi pi-envelope"
        :label="tu('payments.email')"
        severity="secondary"
        variant="outlined"
        :disabled="!receipt"
        @click="emailPanel?.toggle($event)"
      />
      <Popover ref="emailPanel">
        <form class="email" @submit.prevent="send">
          <label for="receipt-email" class="email__label">{{ tu('payments.emailTo') }}</label>
          <InputText
            id="receipt-email"
            v-model="email"
            type="email"
            dir="ltr"
            :placeholder="tu('payments.emailPlaceholder')"
          />
          <small class="email__hint">{{ tu('payments.emailHint') }}</small>
          <Button type="submit" :label="tu('payments.send')" icon="pi pi-send" :loading="sending" />
        </form>
      </Popover>
    </div>

    <p v-if="failed" class="no-print">{{ tu('payments.loadError') }}</p>
    <article v-else-if="receipt" class="receipt" :dir="dir" :lang="lang">
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
        <template v-if="receipt.paid_on">
          <dt>{{ t('recordPayment.paidOn') }}</dt>
          <dd dir="ltr">{{ receipt.paid_on }}</dd>
        </template>
      </dl>
      <!-- The invoices it paid (US-07.03). -->
      <dl v-if="(receipt.invoices?.length ?? 0) > 1" class="receipt__rows">
        <template v-for="inv in receipt.invoices" :key="inv.number ?? ''">
          <dt>
            <span class="mono">{{ inv.number }}</span
            ><template v-if="inv.for"> · {{ inv.for }}</template>
          </dt>
          <dd class="num">{{ format.money(inv.amount) }}</dd>
        </template>
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
.email {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
}
.email__label {
  font: 500 14px var(--font-sans);
}
.email__hint {
  font: var(--text-small);
  color: var(--text-muted);
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
