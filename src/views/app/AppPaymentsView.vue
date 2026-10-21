<script setup lang="ts">
// My payments (US-11.14): what is owed, account credit, invoices with their status, due date and
// balance, payments and refunds; each invoice and receipt opens to print or save as PDF.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { clientApi, type MyPayments } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'

const { t, te } = useI18n()
const format = useFormat()
const data = ref<MyPayments | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const tab = ref<'invoices' | 'payments'>('invoices')
const method = (m: string) => (te(`payments.methods.${m}`) ? t(`payments.methods.${m}`) : m)
const route = useRoute()
const router = useRouter()

// Paying by card online (US-07.12): at branches whose gateway is set up; back from the checkout,
// the outcome shows once the gateway has confirmed it.
const cardLocations = ref<number[]>([])
const paying = ref(false)
const outcome = ref<{ severity: 'success' | 'warn' | 'info'; text: string } | null>(null)
const payable = (i: { balance: number; location_id: number }) =>
  i.balance > 0 && cardLocations.value.includes(i.location_id)
const payAll = computed(() => {
  const owing = (data.value?.invoices ?? []).filter(payable)
  return owing.length > 1 && new Set(owing.map((i) => i.location_id)).size === 1 ? owing : []
})
async function payByCard(invoiceIds: number[]) {
  paying.value = true
  try {
    const { url } = await clientApi.online.start({
      invoice_ids: invoiceIds,
      return_path: '/app/payments',
    })
    window.location.assign(url)
  } catch (e) {
    outcome.value = { severity: 'warn', text: firstMessage(e) ?? t('common.genericError') }
    paying.value = false
  }
}
async function checkReturn() {
  const reference = typeof route.query.online === 'string' ? route.query.online : null
  if (!reference) return
  router.replace({ query: {} })
  if (route.query.cancelled) {
    outcome.value = { severity: 'info', text: t('app.payments.cardCancelled') }
    return
  }
  outcome.value = { severity: 'info', text: t('app.payments.cardChecking') }
  for (let tries = 0; tries < 10; tries++) {
    const result = await clientApi.online.status(reference).catch(() => null)
    if (result?.status === 'Succeeded') {
      outcome.value = {
        severity: 'success',
        text: t('app.payments.cardPaid', { receipt: result.receipt_number ?? '' }),
      }
      await load()
      return
    }
    if (result?.status === 'Failed') {
      outcome.value = { severity: 'warn', text: result.error ?? t('app.payments.cardFailed') }
      return
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  outcome.value = { severity: 'info', text: t('app.payments.cardPending') }
}

async function load() {
  state.value = 'loading'
  try {
    data.value = await clientApi.payments()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  checkReturn()
  await load()
  cardLocations.value =
    (await clientApi.online.availability().catch(() => null))?.location_ids ?? []
})
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.account' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.nav.account') }}</RouterLink
    >
    <h1 class="ca-title">{{ t('app.payments.title') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="100px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="data">
      <div class="tiles">
        <div class="ca-card tile">
          <span class="ca-muted ca-small">{{ t('app.payments.owed') }}</span>
          <strong class="ca-num" :class="{ danger: data.owed > 0 }">{{
            format.money(data.owed)
          }}</strong>
        </div>
        <div class="ca-card tile">
          <span class="ca-muted ca-small">{{ t('app.payments.credit') }}</span>
          <strong class="ca-num">{{ format.money(data.account_credit) }}</strong>
        </div>
      </div>
      <Message v-if="outcome" :severity="outcome.severity" :closable="false">{{
        outcome.text
      }}</Message>
      <Button
        v-if="payAll.length"
        :label="
          t('app.payments.payAllByCard', {
            amount: format.money(payAll.reduce((s, i) => s + i.balance, 0)),
          })
        "
        icon="pi pi-credit-card"
        :loading="paying"
        fluid
        @click="payByCard(payAll.map((i) => i.id))"
      />
      <p v-if="data.owed > 0 && !cardLocations.length" class="ca-muted ca-small">
        {{ t('app.payments.payAtDesk') }}
      </p>
      <SelectButton
        v-model="tab"
        :options="[
          { value: 'invoices', label: t('app.payments.invoices') },
          { value: 'payments', label: t('app.payments.payments') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        fluid
      />
      <section v-if="tab === 'invoices'" class="ca-card">
        <EmptyState
          v-if="!data.invoices.length"
          compact
          icon="pi-file"
          :title="t('app.payments.noInvoices')"
        />
        <ul v-else class="ca-list">
          <li v-for="i in data.invoices" :key="i.id" class="row">
            <div class="ca-spread">
              <RouterLink
                :to="{ name: 'app.print.invoice', params: { id: i.id } }"
                target="_blank"
                class="ca-num"
                >{{ i.number }}</RouterLink
              >
              <Tag v-if="i.overdue" severity="danger" :value="t('app.payments.overdue')" />
              <StatusTag v-else :status="i.status" size="sm" />
            </div>
            <div class="ca-spread ca-small">
              <span class="ca-muted"
                >{{ showDay(format, i.issued_on) }} ·
                {{ t('app.payments.due', { date: showDay(format, i.due_on) }) }}</span
              >
              <span class="ca-num">{{ format.money(i.total) }}</span>
            </div>
            <div v-if="i.balance > 0" class="ca-spread">
              <span class="ca-small balance">{{
                t('app.payments.balance', { amount: format.money(i.balance) })
              }}</span>
              <Button
                v-if="payable(i)"
                :label="t('app.payments.payByCard')"
                icon="pi pi-credit-card"
                size="small"
                variant="outlined"
                :loading="paying"
                @click="payByCard([i.id])"
              />
            </div>
          </li>
        </ul>
      </section>
      <section v-else class="ca-card">
        <EmptyState
          v-if="!data.payments.length && !data.refunds.length"
          compact
          icon="pi-wallet"
          :title="t('app.payments.noPayments')"
        />
        <ul v-else class="ca-list">
          <li v-for="p in data.payments" :key="`p${p.id}`" class="ca-spread row">
            <div>
              <RouterLink
                :to="{ name: 'app.print.receipt', params: { id: p.id } }"
                target="_blank"
                class="ca-num"
                >{{ p.receipt_number }}</RouterLink
              >
              <div class="ca-muted ca-small">
                {{ p.date ? format.date(p.date) : '' }} · {{ method(p.method) }}
              </div>
            </div>
            <span class="ca-num" :class="{ voided: p.status === 'Voided' }">{{
              format.money(p.amount)
            }}</span>
          </li>
          <li v-for="r in data.refunds" :key="`r${r.id}`" class="ca-spread row">
            <div>
              <span>{{ t('app.payments.refund') }}</span>
              <div class="ca-muted ca-small">
                {{ r.date ? format.date(r.date) : '' }} ·
                {{
                  r.destination === 'account_credit' ? t('app.payments.credit') : method(r.method)
                }}
              </div>
            </div>
            <span class="ca-num">−{{ format.money(r.amount) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tile strong {
  font-size: 1.25rem;
}
.danger,
.balance {
  color: var(--sev-danger-fg);
}
.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
}
.voided {
  text-decoration: line-through;
  color: var(--text-muted);
}
</style>
