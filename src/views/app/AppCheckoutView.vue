<script setup lang="ts">
// Checkout (US-11.13): the branch, a start date when the product asks for one, a coupon, the
// subtotal, VAT and total, and the terms. Without online payment the order leaves an invoice to
// pay at the desk; a product that needs payment first starts once it is paid.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormField from '@/components/patterns/FormField.vue'
import { clientApi, type ShopProduct, type ShopQuote } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { productSummary } from '@/lib/clientApp'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const route = useRoute()
const format = useFormat()
const app = useClientApp()
const product = ref<ShopProduct | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const locationId = ref<number | null>(null)
const startsOn = ref<Date | null>(null)
const coupon = ref('')
const appliedCoupon = ref<string | null>(null)
const quote = ref<ShopQuote | null>(null)
const couponError = ref<string | null>(null)
const accept = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const done = ref<Awaited<ReturnType<typeof clientApi.shop.buy>> | null>(null)
const ymd = (d: Date | null) =>
  d
    ? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
        .join('-')
    : null
const needsDate = computed(() => product.value?.activation === 'chosen_date')
const canBuy = computed(
  () => !!quote.value && accept.value && (!needsDate.value || !!startsOn.value),
)

onMounted(async () => {
  try {
    product.value =
      (await clientApi.shop.list()).find((p) => p.id === Number(route.params.id)) ?? null
    if (!product.value) throw new Error('missing')
    const home = app.config?.locations.find((l) =>
      product.value!.prices.some((p) => p.location_id === l.id),
    )
    locationId.value =
      product.value.prices.length === 1
        ? product.value.prices[0]!.location_id
        : (home?.id ?? product.value.prices[0]!.location_id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})
async function loadQuote() {
  if (!product.value || !locationId.value) return
  couponError.value = null
  try {
    quote.value = await clientApi.shop.quote(product.value.id, {
      location_id: locationId.value,
      coupon: appliedCoupon.value,
    })
  } catch (e) {
    couponError.value = firstMessage(e) ?? t('common.genericError')
    appliedCoupon.value = null
    quote.value = await clientApi.shop
      .quote(product.value.id, { location_id: locationId.value })
      .catch(() => null)
  }
}
watch(locationId, loadQuote)
function applyCoupon() {
  appliedCoupon.value = coupon.value.trim() || null
  loadQuote()
}

async function buy() {
  if (!product.value || !locationId.value) return
  busy.value = true
  error.value = null
  try {
    done.value = await clientApi.shop.buy(product.value.id, {
      location_id: locationId.value,
      coupon: appliedCoupon.value,
      starts_on: ymd(startsOn.value),
      accept_terms: accept.value,
    })
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.shop' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.shop.title') }}</RouterLink
    >
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="140px" /></div>
    <ErrorState v-else-if="state === 'error'" />
    <div v-else-if="done" class="ca-card ca-stack done">
      <span class="done__icon"><i class="pi pi-check" aria-hidden="true" /></span>
      <h1 class="ca-title">{{ t('app.shop.ordered') }}</h1>
      <p>{{ done.entitlement.name }}</p>
      <Message severity="info" :closable="false">
        {{
          t('app.shop.payAtDesk', {
            amount: format.money(done.invoice.balance),
            branch: done.pay_at.location,
          })
        }}
        <template v-if="done.entitlement.awaiting_payment">
          {{ t('app.shop.startsWhenPaid') }}</template
        >
      </Message>
      <RouterLink
        :to="{ name: 'app.print.invoice', params: { id: done.invoice.id } }"
        target="_blank"
        >{{ t('app.payments.invoice', { number: done.invoice.number }) }}</RouterLink
      >
      <RouterLink :to="{ name: 'app.memberships' }">{{ t('app.account.memberships') }}</RouterLink>
    </div>
    <template v-else-if="product">
      <div class="ca-card">
        <h1 class="ca-title">{{ product.name }}</h1>
        <p class="ca-small">{{ productSummary(t, product) }}</p>
      </div>
      <div class="ca-card ca-form">
        <FormField
          v-if="product.prices.length > 1"
          :label="t('app.schedule.branch')"
          for="co-branch"
        >
          <Select
            v-model="locationId"
            input-id="co-branch"
            :options="product.prices"
            option-label="location"
            option-value="location_id"
            fluid
          />
        </FormField>
        <FormField v-if="needsDate" :label="t('app.shop.startsOn')" for="co-start">
          <DatePicker
            v-model="startsOn"
            input-id="co-start"
            :min-date="new Date()"
            date-format="yy-mm-dd"
            show-icon
            fluid
          />
        </FormField>
        <FormField :label="t('app.shop.coupon')" for="co-coupon" :error="couponError">
          <div class="ca-row">
            <InputText id="co-coupon" v-model="coupon" dir="ltr" class="grow" />
            <Button :label="t('app.shop.apply')" variant="outlined" @click="applyCoupon" />
          </div>
        </FormField>
      </div>
      <div v-if="quote" class="ca-card">
        <table class="totals">
          <tbody>
            <tr v-for="(l, i) in quote.lines" :key="i">
              <th>{{ l.description }}</th>
              <td class="ca-num">{{ format.money(l.unit_price) }}</td>
            </tr>
            <tr v-if="quote.discount">
              <th>
                {{
                  quote.coupon
                    ? t('app.shop.couponLine', { code: quote.coupon.code })
                    : t('app.shop.discount')
                }}
              </th>
              <td class="ca-num">−{{ format.money(quote.discount) }}</td>
            </tr>
            <tr v-if="quote.vat">
              <th>{{ t('app.shop.vat', { rate: quote.vat_rate ?? '' }) }}</th>
              <td class="ca-num">{{ format.money(quote.vat) }}</td>
            </tr>
            <tr class="total">
              <th>{{ t('app.shop.total') }}</th>
              <td class="ca-num">{{ format.money(quote.total) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="quote.requires_payment" class="ca-muted ca-small">
          {{ t('app.shop.requiresPayment') }}
        </p>
        <p v-else class="ca-muted ca-small">{{ t('app.shop.payLater') }}</p>
      </div>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <label class="ca-row ca-small">
        <Checkbox v-model="accept" binary input-id="co-terms" />
        <span>
          {{ t('app.signUp.accept') }}
          <a
            v-if="app.config?.terms_url"
            :href="app.config.terms_url"
            target="_blank"
            rel="noopener"
            >{{ t('app.signUp.terms') }}</a
          >
          <template v-else>{{ t('app.signUp.terms') }}</template>
        </span>
      </label>
      <Button
        :label="t('app.shop.order')"
        :disabled="!canBuy"
        :loading="busy"
        size="large"
        fluid
        @click="buy"
      />
      <p v-if="needsDate && startsOn" class="ca-muted ca-small">
        {{ t('app.shop.startsLine', { date: showDay(format, ymd(startsOn)!) }) }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.grow {
  flex: 1;
}
.totals {
  width: 100%;
  border-collapse: collapse;
}
.totals th,
.totals td {
  padding: 6px 0;
  text-align: start;
  font-weight: 400;
}
.totals td {
  text-align: end;
}
.totals .total th,
.totals .total td {
  font-weight: 600;
  border-top: 1px solid var(--border-default);
}
.done {
  align-items: center;
  text-align: center;
}
.done p {
  margin: 0;
}
.done__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
  font-size: 24px;
}
</style>
