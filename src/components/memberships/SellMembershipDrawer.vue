<script setup lang="ts">
// Sell a membership or package at the desk (US-06.08): client (a child is paid for by a guardian
// allowed to pay, US-05.09) → product on sale at the branch → start date when the product lets
// staff choose it → discount with a reason → payment now (in part or in full) or later. The total
// is quoted live with the branch's VAT. An intro offer the client already had (US-06.06) needs an
// override reason. The sale creates the invoice and the membership or package in one go.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type Client,
  type ClientEntitlement,
  type Invoice,
  type MembershipPlan,
  type MembershipSaleInput,
  type MembershipSaleQuote,
  type PaymentMethod,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePlanSummary } from '@/composables/usePlanSummary'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId?: number | null; planId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sold: [sale: { entitlement: ClientEntitlement; invoice: Invoice }] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const format = useFormat()
const summary = usePlanSummary()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const canPay = computed(() => auth.can('payments.create'))

// Branch: the one picked in the header, or the user's only one.
const branches = computed(() => auth.user?.switchable_locations ?? [])
const locationId = ref<number | null>(null)

const plans = ref<MembershipPlan[]>([])
const loading = ref(false)
const client = ref<Client | null>(null)
const query = ref('')
const suggestions = ref<Client[]>([])
const payers = ref<{ id: number; name: string }[]>([])
const payerId = ref<number | null>(null)
const planId = ref<number | null>(null)
const startsOn = ref<Date | null>(null)
const discountOn = ref(false)
const discount = ref({
  type: 'percent' as 'percent' | 'amount',
  value: null as number | null,
  reason: '',
})
const introOverride = ref('')
const payNow = ref(true)
const payment = ref({
  amount: null as number | null,
  method: 'cash' as PaymentMethod,
  reference: '',
  note: '',
})
const quote = ref<MembershipSaleQuote | null>(null)
const quoting = ref(false)
const quoteError = ref<string | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})
const done = ref<{ entitlement: ClientEntitlement; invoice: Invoice } | null>(null)

watch(visible, async (open) => {
  if (!open) return
  locationId.value =
    auth.currentLocation?.id ?? (branches.value.length === 1 ? branches.value[0]!.id : null)
  client.value = null
  query.value = ''
  planId.value = props.planId ?? null
  startsOn.value = new Date()
  discountOn.value = false
  discount.value = { type: 'percent', value: null, reason: '' }
  introOverride.value = ''
  payNow.value = true
  payment.value = { amount: null, method: 'cash', reference: '', note: '' }
  quote.value = null
  error.value = null
  errors.value = {}
  done.value = null
  loading.value = true
  try {
    const [list, picked] = await Promise.all([
      tenantApi.membershipPlans.list(),
      props.clientId ? tenantApi.clients.get(props.clientId) : Promise.resolve(null),
    ])
    plans.value = list.filter((p) => p.status === 'Published')
    if (picked) await choose(picked)
  } catch {
    error.value = t('sell.loadError')
  } finally {
    loading.value = false
  }
})

async function search(event: AutoCompleteCompleteEvent) {
  try {
    suggestions.value = (await tenantApi.clients.list({ q: event.query, per_page: 8 })).data
  } catch {
    suggestions.value = []
  }
}
// A child is paid for by a guardian allowed to pay (US-05.09); anyone else pays for themselves.
async function choose(picked: Client) {
  client.value = picked
  payers.value = []
  payerId.value = null
  const family = await tenantApi.clients.family(picked.id).catch(() => null)
  if (client.value?.id !== picked.id) return
  payers.value = (family?.guardians ?? [])
    .filter((g) => g.can_pay && g.client)
    .map((g) => ({ id: g.client!.id, name: g.client!.name }))
  payerId.value = family?.is_child && payers.value.length ? payers.value[0]!.id : null
}
function change() {
  client.value = null
  query.value = ''
  payers.value = []
  payerId.value = null
}
const payerOptions = computed(() => [
  { value: null, label: client.value?.name ?? '' },
  ...payers.value.map((p) => ({ value: p.id, label: t('sell.guardianPays', { name: p.name }) })),
])

const sellable = computed(() =>
  plans.value.filter((p) => p.prices.some((x) => x.location_id === locationId.value)),
)
const plan = computed(() => plans.value.find((p) => p.id === planId.value) ?? null)
const priceHere = (p: MembershipPlan) =>
  p.prices.find((x) => x.location_id === locationId.value)?.price ?? null
const planOptions = computed(() =>
  sellable.value.map((p) => ({
    id: p.id,
    label: p.display_name,
    kind: p.kind,
    detail: [summary.access(p), summary.billing(p)].join(' · '),
    price: priceHere(p),
    intro: summary.intro(p),
  })),
)
watch(locationId, () => {
  if (plan.value && priceHere(plan.value) === null) planId.value = null
})

const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null
const discountValue = computed(() =>
  discountOn.value && discount.value.value ? discount.value.value : 0,
)
const input = computed<MembershipSaleInput | null>(() => {
  if (!client.value || !plan.value || !locationId.value) return null
  return {
    client_id: client.value.id,
    payer_client_id: payerId.value,
    plan_id: plan.value.id,
    location_id: locationId.value,
    starts_on: plan.value.activation === 'chosen_date' ? ymd(startsOn.value) : null,
    discount: discountValue.value
      ? {
          type: discount.value.type,
          value: discountValue.value,
          reason: discount.value.reason.trim() || null,
        }
      : null,
    intro_override: introOverride.value.trim() || null,
  }
})

// The total, quoted as staff fill in the sale.
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(
  () => JSON.stringify(input.value && { ...input.value, intro_override: null }),
  () => {
    clearTimeout(timer)
    if (!input.value) {
      quote.value = null
      return
    }
    timer = setTimeout(loadQuote, 250)
  },
)
async function loadQuote() {
  if (!input.value) return
  const mine = ++seq
  quoting.value = true
  quoteError.value = null
  try {
    const q = await tenantApi.sales.quote(input.value)
    if (mine !== seq) return
    const previousTotal = quote.value?.total
    quote.value = q
    if (payment.value.amount === null || payment.value.amount === previousTotal)
      payment.value.amount = q.total
  } catch (e) {
    if (mine !== seq) return
    quote.value = null
    quoteError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    if (mine === seq) quoting.value = false
  }
}

const needsReference = computed(() =>
  ['bank_transfer', 'card_terminal'].includes(payment.value.method),
)
const methodOptions = computed(() =>
  (['cash', 'bank_transfer', 'card_terminal', 'other'] as PaymentMethod[]).map((m) => ({
    value: m,
    label: t(`payments.methods.${m}`),
  })),
)
const takesPayment = computed(
  () => canPay.value && payNow.value && !!quote.value && quote.value.total > 0,
)
const ready = computed(
  () =>
    !!input.value &&
    !!quote.value &&
    !quoting.value &&
    (plan.value?.activation !== 'chosen_date' || !!startsOn.value) &&
    (!discountValue.value || !!discount.value.reason.trim()) &&
    (!quote.value.intro_refusal || !!introOverride.value.trim()) &&
    (!takesPayment.value ||
      (!!payment.value.amount &&
        payment.value.amount > 0 &&
        payment.value.amount <= quote.value.total &&
        (!needsReference.value || !!payment.value.reference.trim()))),
)

async function sell() {
  if (!ready.value || !input.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const sale = await tenantApi.sales.sell({
      ...input.value,
      payment: takesPayment.value
        ? {
            amount: payment.value.amount!,
            method: payment.value.method,
            reference: payment.value.reference.trim() || null,
            note: payment.value.note.trim() || null,
          }
        : null,
    })
    done.value = sale
    emit('sold', sale)
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
const receiptId = computed(() => done.value?.invoice.payments?.[0]?.id ?? null)
</script>

<template>
  <Drawer v-model:visible="visible" :position="position" :block-scroll="true" class="sell-drawer">
    <template #header>
      <div>
        <div class="head__title">{{ t('sell.title') }}</div>
        <div class="head__sub">{{ t('sell.subtitle') }}</div>
      </div>
    </template>

    <div v-if="loading" class="body">
      <Skeleton v-for="n in 4" :key="n" height="44px" />
    </div>

    <div v-else-if="done" class="body">
      <Message severity="success" :closable="false" icon="pi pi-check-circle">{{
        t('sell.done', { name: done.entitlement.name, client: client?.name ?? '' })
      }}</Message>
      <dl class="result">
        <dt>{{ t('sell.invoice') }}</dt>
        <dd class="num">{{ done.invoice.number }}</dd>
        <dt>{{ t('sell.total') }}</dt>
        <dd class="num">{{ format.money(done.invoice.total) }}</dd>
        <dt>{{ t('sell.paid') }}</dt>
        <dd class="num">{{ format.money(done.invoice.paid) }}</dd>
        <dt>{{ t('sell.balance') }}</dt>
        <dd>
          <span class="num">{{ format.money(done.invoice.balance) }}</span>
          <StatusTag :status="done.invoice.status" size="sm" class="result__tag" />
        </dd>
        <dt>{{ t('sell.access') }}</dt>
        <dd>
          <StatusTag :status="done.entitlement.status" size="sm" />
          <small v-if="done.entitlement.awaiting_payment" class="muted">
            {{ t('sell.awaitingPayment') }}</small
          >
        </dd>
      </dl>
      <RouterLink
        v-if="receiptId"
        :to="{ name: 'tenant.receipt', params: { id: receiptId } }"
        target="_blank"
        class="receipt-link"
        ><i class="pi pi-print" aria-hidden="true" /> {{ t('sell.printReceipt') }}</RouterLink
      >
    </div>

    <div v-else class="body">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <div v-if="!auth.currentLocation && branches.length > 1" class="field">
        <label for="sell-branch" class="field__label">{{ t('sell.branch') }} *</label>
        <Select
          v-model="locationId"
          input-id="sell-branch"
          :options="branches"
          option-label="name"
          option-value="id"
          :placeholder="t('sell.pickBranch')"
          fluid
        />
      </div>

      <div class="field">
        <label for="sell-client" class="field__label">{{ t('sell.client') }} *</label>
        <div v-if="client" class="picked">
          <PersonAvatar :name="client.name" :image="client.photo_url" />
          <span class="picked__text">
            <span class="picked__name">{{ client.name }}</span>
            <span class="picked__sub">{{ client.member_id }}</span>
          </span>
          <Button
            v-if="!props.clientId"
            size="small"
            variant="text"
            severity="secondary"
            :label="t('booking.change')"
            @click="change"
          />
        </div>
        <AutoComplete
          v-else
          v-model="query"
          input-id="sell-client"
          :suggestions="suggestions"
          option-label="name"
          :placeholder="t('booking.search')"
          :min-length="2"
          :delay="250"
          fluid
          @complete="search"
          @option-select="choose($event.value)"
        >
          <template #option="{ option }">
            <div class="option">
              <PersonAvatar :name="option.name" :image="option.photo_url" />
              <span class="option__text">
                <span>{{ option.name }}</span>
                <span class="option__sub" dir="ltr">{{
                  [option.member_id, option.mobile].filter(Boolean).join(' · ')
                }}</span>
              </span>
            </div>
          </template>
          <template #empty>{{ t('booking.noResults') }}</template>
        </AutoComplete>
      </div>

      <div v-if="client && payers.length" class="field">
        <span id="sell-payer" class="field__label">{{ t('sell.payer') }}</span>
        <SelectButton
          v-model="payerId"
          :options="payerOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="sell-payer"
        />
      </div>

      <div class="field">
        <label for="sell-plan" class="field__label">{{ t('sell.product') }} *</label>
        <Select
          v-model="planId"
          input-id="sell-plan"
          :options="planOptions"
          option-label="label"
          option-value="id"
          :placeholder="locationId ? t('sell.pickProduct') : t('sell.pickBranchFirst')"
          :disabled="!locationId"
          :empty-message="t('sell.nothingOnSale')"
          filter
          fluid
        >
          <template #option="{ option }">
            <div class="plan-option">
              <i
                :class="['pi', option.kind === 'package' ? 'pi-ticket' : 'pi-id-card']"
                aria-hidden="true"
              />
              <span class="option__text">
                <span>{{ option.label }}</span>
                <span class="option__sub"
                  >{{ option.detail
                  }}<template v-if="option.intro"> · {{ option.intro }}</template></span
                >
              </span>
              <span class="num">{{ option.price !== null ? format.money(option.price) : '' }}</span>
            </div>
          </template>
        </Select>
      </div>

      <div v-if="plan?.activation === 'chosen_date'" class="field">
        <label for="sell-start" class="field__label">{{ t('sell.startsOn') }} *</label>
        <DatePicker
          v-model="startsOn"
          input-id="sell-start"
          :min-date="new Date()"
          show-icon
          icon-display="input"
          fluid
          :invalid="!!errors.starts_on"
        />
      </div>
      <Message
        v-else-if="plan?.activation === 'first_use'"
        severity="secondary"
        :closable="false"
        icon="pi pi-info-circle"
        size="small"
        >{{
          t('plans.activationSummary.first_use', { n: plan.activation_max_wait_days ?? 30 })
        }}</Message
      >

      <div class="discount">
        <div class="toggle">
          <ToggleSwitch v-model="discountOn" input-id="sell-discount" />
          <label for="sell-discount">{{ t('sell.discount') }}</label>
        </div>
        <template v-if="discountOn">
          <div class="discount__row">
            <SelectButton
              v-model="discount.type"
              :options="[
                { value: 'percent', label: '%' },
                { value: 'amount', label: t('sell.amount') },
              ]"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              :aria-label="t('sell.discountType')"
            />
            <InputNumber
              v-model="discount.value"
              :aria-label="t('sell.discountValue')"
              :min="0"
              :max="discount.type === 'percent' ? 100 : undefined"
              :max-fraction-digits="discount.type === 'percent' ? 2 : 3"
              :suffix="discount.type === 'percent' ? ' %' : undefined"
              fluid
            />
          </div>
          <div class="field">
            <label for="sell-discount-reason" class="field__label"
              >{{ t('sell.discountReason') }} *</label
            >
            <InputText
              id="sell-discount-reason"
              v-model="discount.reason"
              maxlength="255"
              :placeholder="t('sell.discountReasonHint')"
              :invalid="!!errors['discount.reason']"
            />
          </div>
        </template>
      </div>

      <Message v-if="quoteError" severity="warn" :closable="false" size="small">{{
        quoteError
      }}</Message>
      <div v-else-if="quote" :class="['quote', { 'quote--busy': quoting }]" aria-live="polite">
        <div v-for="(l, i) in quote.lines" :key="i" class="quote__row">
          <span>{{ l.description }}</span>
          <span class="num">{{ format.money(l.unit_price) }}</span>
        </div>
        <div v-if="quote.discount" class="quote__row quote__row--muted">
          <span>{{ t('sell.discount') }}</span>
          <span class="num">−{{ format.money(quote.discount) }}</span>
        </div>
        <div v-if="quote.vat_rate" class="quote__row quote__row--muted">
          <span>{{
            t(quote.prices_include_vat ? 'sell.vatIncluded' : 'sell.vatAdded', {
              rate: quote.vat_rate,
            })
          }}</span>
          <span class="num">{{ format.money(quote.vat) }}</span>
        </div>
        <div class="quote__row quote__total">
          <span>{{ t('sell.total') }}</span>
          <span class="num">{{ format.money(quote.total) }}</span>
        </div>
      </div>

      <template v-if="quote?.intro_refusal">
        <Message severity="warn" :closable="false" icon="pi pi-gift">{{
          t(`sell.intro.${quote.intro_refusal.code}`, { plan: quote.intro_refusal.plan })
        }}</Message>
        <div class="field">
          <label for="sell-intro-override" class="field__label"
            >{{ t('sell.overrideReason') }} *</label
          >
          <Textarea
            id="sell-intro-override"
            v-model="introOverride"
            rows="2"
            maxlength="500"
            auto-resize
          />
        </div>
      </template>
      <Message
        v-if="quote?.requires_payment"
        severity="info"
        :closable="false"
        icon="pi pi-lock"
        size="small"
        >{{ t('sell.requiresPayment') }}</Message
      >

      <div v-if="canPay && quote && quote.total > 0" class="pay">
        <div class="toggle">
          <ToggleSwitch v-model="payNow" input-id="sell-pay-now" />
          <label for="sell-pay-now">{{ t('sell.payNow') }}</label>
        </div>
        <template v-if="payNow">
          <div class="pay__row">
            <div class="field">
              <label for="sell-amount" class="field__label">{{ t('payments.amount') }} *</label>
              <InputNumber
                v-model="payment.amount"
                input-id="sell-amount"
                mode="currency"
                :currency="quote.currency"
                :locale="locale"
                :min="0"
                :max="quote.total"
                fluid
                :invalid="!!errors['payment.amount']"
              />
              <small
                v-if="payment.amount !== null && payment.amount < quote.total"
                class="field__hint"
                >{{
                  t('sell.leftDue', { amount: format.money(quote.total - payment.amount) })
                }}</small
              >
            </div>
            <div class="field">
              <span id="sell-method" class="field__label">{{ t('payments.method') }}</span>
              <Select
                v-model="payment.method"
                :options="methodOptions"
                option-label="label"
                option-value="value"
                aria-labelledby="sell-method"
                fluid
              />
            </div>
          </div>
          <div v-if="needsReference" class="field">
            <label for="sell-reference" class="field__label">{{ t('payments.reference') }} *</label>
            <InputText
              id="sell-reference"
              v-model="payment.reference"
              maxlength="100"
              dir="ltr"
              :invalid="!!errors['payment.reference']"
            />
          </div>
        </template>
        <small v-else class="field__hint">{{ t('sell.payLater') }}</small>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <span class="footer__spacer" />
        <Button v-if="done" :label="t('sell.close')" @click="visible = false" />
        <template v-else>
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            variant="text"
            @click="visible = false"
          />
          <Button
            icon="pi pi-check"
            :label="
              quote
                ? t('sell.confirmTotal', { total: format.money(quote.total) })
                : t('sell.confirm')
            "
            :loading="saving"
            :disabled="!ready"
            @click="sell"
          />
        </template>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font: 500 14px var(--font-sans);
}
.field__hint,
.muted {
  font: var(--text-small);
  color: var(--text-secondary);
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.picked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.picked__text,
.option__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.picked__name {
  font: 500 14px/1.4 var(--font-sans);
}
.picked__sub,
.option__sub {
  font: var(--text-small);
  color: var(--text-muted);
}
.option,
.plan-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.plan-option .pi {
  color: var(--text-muted);
}
.discount,
.pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-sunken);
}
.discount__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}
.pay__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.quote {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  transition: opacity 0.15s;
}
.quote--busy {
  opacity: 0.6;
}
.quote__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font: var(--text-small);
}
.quote__row--muted {
  color: var(--text-secondary);
}
.quote__total {
  padding-top: 8px;
  margin-top: 2px;
  border-top: 1px solid var(--border-subtle);
  font: 600 16px var(--font-sans);
}
.result {
  margin: 0;
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 10px 12px;
}
.result dt {
  color: var(--text-muted);
  font: var(--text-small);
}
.result dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.receipt-link {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.footer__spacer {
  flex: 1;
}
</style>
