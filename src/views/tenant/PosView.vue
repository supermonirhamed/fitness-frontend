<script setup lang="ts">
// Point of sale (US-07.02), made for a tablet at the front desk: pick the client (or a walk-in),
// tap memberships, packages or a custom item into the cart, set quantities and discounts (with a
// reason), see subtotal, VAT and total for the current branch, then take payment in one or more
// methods (or leave a balance due) and complete the sale. One sale makes the invoice, the payments
// and the memberships/packages together. A walk-in buys custom items only, paid in full.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type Client,
  type MembershipPlan,
  type PaymentMethod,
  type PosItemInput,
  type PosQuote,
  type PosSale,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { usePlanSummary } from '@/composables/usePlanSummary'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const org = useOrganization()
const format = useFormat()
const summary = usePlanSummary()
const currency = computed(() => org.organization?.currency ?? 'SAR')
const canSellPlans = computed(() => auth.can('memberships.create'))

// Branch: the one picked in the header, or the user's only one.
const branches = computed(() => auth.user?.switchable_locations ?? [])
const locationId = ref<number | null>(
  auth.currentLocation?.id ?? (branches.value.length === 1 ? branches.value[0]!.id : null),
)
watch(
  () => auth.currentLocation?.id,
  (id) => id && (locationId.value = id),
)

// Catalog: published products on sale at the branch.
const plans = ref<MembershipPlan[]>([])
const loadingPlans = ref(true)
onMounted(async () => {
  try {
    plans.value = canSellPlans.value
      ? (await tenantApi.membershipPlans.list()).filter((p) => p.status === 'Published')
      : []
  } finally {
    loadingPlans.value = false
  }
})
type Shelf = 'membership' | 'package' | 'custom'
const shelf = ref<Shelf>(canSellPlans.value ? 'membership' : 'custom')
const shelfOptions = computed(() =>
  (canSellPlans.value
    ? (['membership', 'package', 'custom'] as Shelf[])
    : (['custom'] as Shelf[])
  ).map((v) => ({ value: v, label: t(`pos.shelves.${v}`) })),
)
const priceAt = (p: MembershipPlan) =>
  p.prices.find((x) => x.location_id === locationId.value)?.price ?? null
const onShelf = computed(() =>
  plans.value.filter((p) => p.kind === shelf.value && priceAt(p) !== null),
)

// Client: a payer from the clients list, or a walk-in.
const client = ref<Client | null>(null)
const walkIn = ref(false)
const query = ref('')
const suggestions = ref<Client[]>([])
const children = ref<{ id: number; name: string }[]>([])
async function search(event: AutoCompleteCompleteEvent) {
  suggestions.value = (
    await tenantApi.clients.list({ q: event.query, per_page: 8 }).catch(() => ({ data: [] }))
  ).data
}
async function choose(picked: Client) {
  client.value = picked
  walkIn.value = false
  children.value = []
  const family = await tenantApi.clients.family(picked.id).catch(() => null)
  if (client.value?.id !== picked.id) return
  children.value = (family?.dependents ?? [])
    .filter((d) => d.can_pay && d.client)
    .map((d) => ({ id: d.client!.id, name: d.client!.name }))
}
function useWalkIn() {
  client.value = null
  walkIn.value = true
  children.value = []
  query.value = ''
  cart.value = cart.value.filter((i) => i.type === 'custom')
}
function changeClient() {
  client.value = null
  walkIn.value = false
  children.value = []
  query.value = ''
}

// Cart.
type CartItem = {
  key: number
  type: 'plan' | 'custom'
  planId?: number
  name: string
  forClientId: number | null
  activation?: MembershipPlan['activation']
  startsOn: Date | null
  description: string
  unitPrice: number | null
  quantity: number
  discountOn: boolean
  discount: { type: 'percent' | 'amount'; value: number | null; reason: string }
  introOverride: string
}
const cart = ref<CartItem[]>([])
let nextKey = 1
const blankDiscount = () => ({ type: 'percent' as const, value: null, reason: '' })
function addPlan(p: MembershipPlan) {
  cart.value.push({
    key: nextKey++,
    type: 'plan',
    planId: p.id,
    name: p.display_name ?? '',
    forClientId: null,
    activation: p.activation,
    startsOn: new Date(),
    description: '',
    unitPrice: null,
    quantity: 1,
    discountOn: false,
    discount: blankDiscount(),
    introOverride: '',
  })
}
const custom = ref({ description: '', price: null as number | null, quantity: 1 })
function addCustom() {
  if (!custom.value.description.trim() || custom.value.price === null) return
  cart.value.push({
    key: nextKey++,
    type: 'custom',
    name: custom.value.description.trim(),
    forClientId: null,
    startsOn: null,
    description: custom.value.description.trim(),
    unitPrice: custom.value.price,
    quantity: custom.value.quantity,
    discountOn: false,
    discount: blankDiscount(),
    introOverride: '',
  })
  custom.value = { description: '', price: null, quantity: 1 }
}
function remove(item: CartItem) {
  cart.value = cart.value.filter((i) => i !== item)
}
const forOptions = computed(() => [
  ...(client.value ? [{ id: client.value.id, name: client.value.name }] : []),
  ...children.value,
])
const hasPlans = computed(() => cart.value.some((i) => i.type === 'plan'))

const items = computed<PosItemInput[]>(() =>
  cart.value.map((i) => {
    const discount =
      i.discountOn && i.discount.value
        ? {
            type: i.discount.type,
            value: i.discount.value,
            reason: i.discount.reason.trim() || null,
          }
        : null
    return i.type === 'plan'
      ? {
          type: 'plan',
          plan_id: i.planId!,
          for_client_id: i.forClientId,
          starts_on: i.activation === 'chosen_date' && i.startsOn ? isoDay(i.startsOn) : null,
          intro_override: i.introOverride.trim() || null,
          discount,
        }
      : {
          type: 'custom',
          description: i.description,
          unit_price: i.unitPrice ?? 0,
          quantity: i.quantity,
          discount,
        }
  }),
)

// Live quote.
const quote = ref<PosQuote | null>(null)
const quoting = ref(false)
const quoteError = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(
  [items, locationId, () => client.value?.id],
  () => {
    clearTimeout(timer)
    // Memberships and packages are priced once there is a client to sell them to.
    if (!cart.value.length || !locationId.value || (hasPlans.value && !client.value)) {
      quote.value = null
      quoteError.value = null
      return
    }
    timer = setTimeout(async () => {
      const mine = ++seq
      quoting.value = true
      try {
        const q = await tenantApi.pos.quote({
          location_id: locationId.value!,
          client_id: client.value?.id ?? null,
          items: items.value,
        })
        if (mine !== seq) return
        quote.value = q
        quoteError.value = null
      } catch (e) {
        if (mine !== seq) return
        quote.value = null
        quoteError.value = apiMessage(e) ?? Object.values(validationErrors(e))[0]?.[0] ?? null
      } finally {
        if (mine === seq) quoting.value = false
      }
    }, 300)
  },
  { deep: true },
)
const refusalFor = (index: number) => quote.value?.intro_refusals.find((r) => r.item === index)
const lineTotal = (index: number) =>
  (quote.value?.lines ?? []).filter((l) => l.item === index).reduce((sum, l) => sum + l.total, 0)

// Payments, split across methods.
type PayRow = { method: PaymentMethod; amount: number | null; reference: string }
const payRows = ref<PayRow[]>([{ method: 'cash', amount: null, reference: '' }])
const methods: PaymentMethod[] = ['cash', 'card_terminal', 'bank_transfer', 'other']
const methodOptions = computed(() =>
  methods.map((m) => ({ value: m, label: t(`payments.methods.${m}`) })),
)
const needsReference = (m: PaymentMethod) => m === 'bank_transfer' || m === 'card_terminal'
const paying = computed(() => payRows.value.reduce((sum, r) => sum + (r.amount ?? 0), 0))
const total = computed(() => quote.value?.total ?? 0)
// The first payment follows the total until staff type another amount.
watch(total, (now, before) => {
  const first = payRows.value[0]
  if (payRows.value.length === 1 && first && (first.amount === null || first.amount === before)) {
    first.amount = now || null
  }
})
const remaining = computed(() => Math.round((total.value - paying.value) * 1000) / 1000)
function addPayRow() {
  payRows.value.push({
    method: 'card_terminal',
    amount: remaining.value > 0 ? remaining.value : null,
    reference: '',
  })
}
function payRest(row: PayRow) {
  row.amount = Math.round(((row.amount ?? 0) + remaining.value) * 1000) / 1000
}

const ready = computed(
  () =>
    !!quote.value &&
    !quoting.value &&
    !!locationId.value &&
    (!!client.value || (walkIn.value && !hasPlans.value)) &&
    (!walkIn.value || remaining.value <= 0) &&
    remaining.value >= 0 &&
    cart.value.every(
      (i, index) =>
        (!i.discountOn || !i.discount.value || !!i.discount.reason.trim()) &&
        (!refusalFor(index) || !!i.introOverride.trim()),
    ) &&
    payRows.value.every((r) => !r.amount || !needsReference(r.method) || !!r.reference.trim()),
)

const saving = ref(false)
const error = ref<string | null>(null)
const sale = ref<PosSale | null>(null)
async function checkout() {
  if (!ready.value) return
  saving.value = true
  error.value = null
  try {
    sale.value = await tenantApi.pos.checkout({
      location_id: locationId.value!,
      client_id: client.value?.id ?? null,
      items: items.value,
      payments: payRows.value
        .filter((r) => (r.amount ?? 0) > 0)
        .map((r) => ({
          method: r.method,
          amount: r.amount!,
          reference: r.reference.trim() || null,
        })),
    })
  } catch (e) {
    error.value =
      apiMessage(e) ?? Object.values(validationErrors(e))[0]?.[0] ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
function newSale() {
  sale.value = null
  cart.value = []
  quote.value = null
  payRows.value = [{ method: 'cash', amount: null, reference: '' }]
  changeClient()
  custom.value = { description: '', price: null, quantity: 1 }
}
</script>

<template>
  <div class="pos">
    <PageHeader :title="t('pos.title')">
      <template #meta>
        <span>{{ t('pos.subtitle') }}</span>
      </template>
      <template v-if="branches.length > 1" #actions>
        <Select
          v-model="locationId"
          :options="branches"
          option-label="name"
          option-value="id"
          :placeholder="t('pos.pickBranch')"
          :aria-label="t('pos.branch')"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="!auth.can('payments.create')" class="card" />

    <!-- Done -->
    <section v-else-if="sale" class="card done">
      <span class="done__icon"><i class="pi pi-check" aria-hidden="true" /></span>
      <h2>{{ t('pos.done', { number: sale.invoice.number }) }}</h2>
      <p class="muted">
        {{
          t('pos.doneTotals', {
            total: format.money(sale.invoice.total),
            paid: format.money(sale.invoice.paid),
          })
        }}
        <template v-if="sale.invoice.balance > 0">
          ·
          <strong class="due">{{
            t('pos.balanceDue', { amount: format.money(sale.invoice.balance) })
          }}</strong>
        </template>
      </p>
      <div v-if="sale.payments.length" class="receipts">
        <a
          v-for="p in sale.payments"
          :key="p.id"
          :href="`/receipts/${p.id}`"
          target="_blank"
          rel="noopener"
          class="receipt"
          ><i class="pi pi-print" aria-hidden="true" />{{ p.receipt_number }} ·
          {{ t(`payments.methods.${p.method}`) }} · {{ format.money(p.amount) }}</a
        >
      </div>
      <ul v-if="sale.entitlements.length" class="sold">
        <li v-for="e in sale.entitlements" :key="e.id">
          <i
            :class="['pi', e.kind === 'package' ? 'pi-ticket' : 'pi-id-card']"
            aria-hidden="true"
          />
          {{ e.name }} <span class="muted">· {{ e.holder.name }}</span>
          <StatusTag :status="e.status" size="sm" />
        </li>
      </ul>
      <div class="done__actions">
        <Button
          v-if="sale.invoice.client.id"
          :label="t('pos.openClient')"
          icon="pi pi-user"
          severity="secondary"
          variant="outlined"
          size="large"
          @click="
            router.push({
              name: 'tenant.client',
              params: { id: sale.invoice.client.id },
              query: { tab: 'payments' },
            })
          "
        />
        <Button :label="t('pos.newSale')" icon="pi pi-plus" size="large" @click="newSale" />
      </div>
    </section>

    <div v-else class="grid">
      <!-- Catalog -->
      <section class="card catalog">
        <SelectButton
          v-model="shelf"
          :options="shelfOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          class="shelves"
          :aria-label="t('pos.catalog')"
        />
        <template v-if="shelf !== 'custom'">
          <div v-if="loadingPlans" class="tiles">
            <Skeleton v-for="n in 6" :key="n" height="104px" />
          </div>
          <EmptyState
            v-else-if="!locationId"
            compact
            icon="pi-building"
            :title="t('pos.pickBranch')"
          />
          <EmptyState
            v-else-if="!onShelf.length"
            compact
            icon="pi-inbox"
            :title="t('pos.nothingOnSale')"
          />
          <div v-else class="tiles">
            <button
              v-for="p in onShelf"
              :key="p.id"
              type="button"
              class="tile"
              :disabled="walkIn"
              @click="addPlan(p)"
            >
              <span class="tile__name">{{ p.display_name }}</span>
              <span class="tile__meta">{{ summary.access(p) }} · {{ summary.billing(p) }}</span>
              <span class="tile__price num">{{ format.money(priceAt(p)!) }}</span>
              <i class="pi pi-plus tile__add" aria-hidden="true" />
            </button>
          </div>
          <Message v-if="walkIn" severity="secondary" :closable="false" size="small">{{
            t('pos.walkInNoPlans')
          }}</Message>
        </template>
        <form v-else class="custom" @submit.prevent="addCustom">
          <label class="field">
            <span class="field__label">{{ t('pos.itemDescription') }}</span>
            <InputText v-model="custom.description" size="large" maxlength="255" fluid />
          </label>
          <div class="custom__row">
            <label class="field">
              <span class="field__label">{{ t('pos.unitPrice') }}</span>
              <InputNumber
                v-model="custom.price"
                mode="currency"
                :currency="currency"
                :min="0"
                :max-fraction-digits="3"
                size="large"
                fluid
              />
            </label>
            <label class="field">
              <span class="field__label">{{ t('pos.quantity') }}</span>
              <InputNumber
                v-model="custom.quantity"
                :min="1"
                :max="99"
                show-buttons
                size="large"
                fluid
              />
            </label>
          </div>
          <Button
            type="submit"
            icon="pi pi-plus"
            :label="t('pos.addItem')"
            size="large"
            :disabled="!custom.description.trim() || custom.price === null"
          />
        </form>
      </section>

      <!-- Cart -->
      <section class="card cart">
        <div class="who">
          <template v-if="client">
            <PersonAvatar :name="client.name" :image="client.photo_url" />
            <div class="who__name">
              <strong>{{ client.name }}</strong>
              <small class="muted">{{ client.member_id }}</small>
            </div>
            <Button :label="t('pos.change')" variant="text" size="small" @click="changeClient" />
          </template>
          <template v-else-if="walkIn">
            <span class="walk-in"
              ><i class="pi pi-user" aria-hidden="true" />{{ t('pos.walkIn') }}</span
            >
            <Button :label="t('pos.change')" variant="text" size="small" @click="changeClient" />
          </template>
          <template v-else>
            <AutoComplete
              v-model="query"
              :suggestions="suggestions"
              option-label="name"
              :placeholder="t('pos.findClient')"
              :delay="250"
              size="large"
              fluid
              class="who__search"
              @complete="search"
              @option-select="choose($event.value)"
            >
              <template #option="{ option }">
                <span class="opt"
                  ><strong>{{ option.name }}</strong
                  ><small class="muted">{{ option.member_id }}</small></span
                >
              </template>
            </AutoComplete>
            <Button
              :label="t('pos.walkIn')"
              severity="secondary"
              variant="outlined"
              @click="useWalkIn"
            />
          </template>
        </div>

        <EmptyState
          v-if="!cart.length"
          compact
          icon="pi-shopping-cart"
          :title="t('pos.emptyCart')"
        />
        <ul v-else class="lines">
          <li v-for="(item, index) in cart" :key="item.key" class="line">
            <div class="line__head">
              <span class="line__name">{{ item.name }}</span>
              <span class="num line__total">{{ quote ? format.money(lineTotal(index)) : '' }}</span>
              <Button
                icon="pi pi-trash"
                severity="secondary"
                variant="text"
                size="small"
                :aria-label="t('pos.remove', { name: item.name })"
                @click="remove(item)"
              />
            </div>
            <div class="line__body">
              <Select
                v-if="item.type === 'plan' && forOptions.length > 1"
                v-model="item.forClientId"
                :options="forOptions"
                option-label="name"
                option-value="id"
                :placeholder="t('pos.forClient', { name: client?.name })"
                show-clear
                size="small"
                :aria-label="t('pos.for')"
              />
              <DatePicker
                v-if="item.type === 'plan' && item.activation === 'chosen_date'"
                v-model="item.startsOn"
                :min-date="new Date()"
                size="small"
                show-icon
                icon-display="input"
                :aria-label="t('pos.startsOn')"
              />
              <InputNumber
                v-if="item.type === 'custom'"
                v-model="item.quantity"
                :min="1"
                :max="99"
                show-buttons
                size="small"
                class="qty"
                :aria-label="t('pos.quantity')"
              />
              <Button
                :label="item.discountOn ? t('pos.noDiscount') : t('pos.discount')"
                icon="pi pi-percentage"
                variant="text"
                size="small"
                severity="secondary"
                @click="item.discountOn = !item.discountOn"
              />
            </div>
            <div v-if="item.discountOn" class="line__discount">
              <SelectButton
                v-model="item.discount.type"
                :options="[
                  { value: 'percent', label: '%' },
                  { value: 'amount', label: currency },
                ]"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
              />
              <InputNumber
                v-model="item.discount.value"
                :min="0"
                :max="item.discount.type === 'percent' ? 100 : undefined"
                :max-fraction-digits="3"
                size="small"
                class="disc-value"
                :aria-label="t('pos.discount')"
              />
              <InputText
                v-model="item.discount.reason"
                :placeholder="t('pos.discountReason')"
                size="small"
                maxlength="255"
                class="disc-reason"
                :invalid="!!item.discount.value && !item.discount.reason.trim()"
              />
            </div>
            <div v-if="refusalFor(index)" class="line__intro">
              <Message severity="warn" :closable="false" size="small">{{
                t(`pos.intro.${refusalFor(index)!.code}`, {
                  plan: refusalFor(index)!.plan ?? item.name,
                })
              }}</Message>
              <InputText
                v-model="item.introOverride"
                :placeholder="t('pos.introOverride')"
                size="small"
                maxlength="500"
                fluid
              />
            </div>
          </li>
        </ul>

        <Message
          v-if="hasPlans && !client"
          severity="secondary"
          :closable="false"
          icon="pi pi-user"
          size="small"
          >{{ t('pos.chooseClientFirst') }}</Message
        >
        <Message v-if="quoteError" severity="error" :closable="false" size="small">{{
          quoteError
        }}</Message>
        <dl v-if="quote" class="totals">
          <div>
            <dt>{{ t('invoices.subtotal') }}</dt>
            <dd class="num">{{ format.money(quote.subtotal) }}</dd>
          </div>
          <div v-if="quote.discount">
            <dt>{{ t('invoices.discountCol') }}</dt>
            <dd class="num">−{{ format.money(quote.discount) }}</dd>
          </div>
          <div>
            <dt>
              {{
                quote.vat_rate
                  ? t('invoices.vatRate', { rate: quote.vat_rate })
                  : t('invoices.vatCol')
              }}
            </dt>
            <dd class="num">{{ format.money(quote.vat) }}</dd>
          </div>
          <div class="grand">
            <dt>{{ t('invoices.total') }}</dt>
            <dd class="num">{{ format.money(quote.total) }}</dd>
          </div>
        </dl>

        <div v-if="quote && quote.total > 0" class="pay">
          <span class="pay__title">{{ t('pos.payment') }}</span>
          <div v-for="(row, i) in payRows" :key="i" class="pay__row">
            <Select
              v-model="row.method"
              :options="methodOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="pay__method"
              :aria-label="t('payments.method')"
            />
            <InputNumber
              v-model="row.amount"
              mode="currency"
              :currency="currency"
              :min="0"
              :max-fraction-digits="3"
              size="small"
              class="pay__amount"
              :placeholder="t('payments.amount')"
              :aria-label="t('payments.amount')"
            />
            <InputText
              v-if="needsReference(row.method)"
              v-model="row.reference"
              :placeholder="t('payments.reference')"
              size="small"
              dir="ltr"
              class="pay__ref"
              :invalid="!!row.amount && !row.reference.trim()"
            />
            <Button
              v-if="remaining > 0"
              :label="t('pos.payRest')"
              variant="text"
              size="small"
              @click="payRest(row)"
            />
            <Button
              v-if="payRows.length > 1"
              icon="pi pi-times"
              variant="text"
              severity="secondary"
              size="small"
              :aria-label="t('pos.removePayment')"
              @click="payRows.splice(i, 1)"
            />
          </div>
          <Button
            v-if="payRows.length < 5 && remaining > 0"
            :label="t('pos.splitPayment')"
            icon="pi pi-plus"
            variant="text"
            size="small"
            @click="addPayRow"
          />
          <p :class="['pay__left', { due: remaining > 0, over: remaining < 0 }]">
            {{
              remaining > 0
                ? walkIn
                  ? t('pos.walkInFull', { amount: format.money(remaining) })
                  : t('pos.leftDue', { amount: format.money(remaining) })
                : remaining < 0
                  ? t('pos.overpaid', { amount: format.money(-remaining) })
                  : t('pos.paidInFull')
            }}
          </p>
        </div>

        <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
        <Button
          :label="
            quote ? t('pos.complete', { total: format.money(quote.total) }) : t('pos.completeEmpty')
          "
          icon="pi pi-check"
          size="large"
          class="complete"
          :loading="saving"
          :disabled="!ready"
          @click="checkout"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.pos {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(340px, 1fr);
  gap: 16px;
  align-items: start;
}
.catalog {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 104px;
  padding: 14px;
  text-align: start;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--surface-card);
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition:
    border-color 0.12s,
    box-shadow 0.12s,
    transform 0.08s;
}
.tile:hover:not(:disabled) {
  border-color: var(--primary-400, var(--p-primary-color));
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.06);
}
.tile:active:not(:disabled) {
  transform: scale(0.98);
}
.tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tile__name {
  font: 600 15px/1.3 var(--font-sans);
  padding-inline-end: 24px;
}
.tile__meta {
  font: var(--text-small);
  color: var(--text-muted);
}
.tile__price {
  margin-top: auto;
  font: 600 16px var(--font-sans);
}
.tile__add {
  position: absolute;
  top: 14px;
  inset-inline-end: 14px;
  color: var(--primary-600, var(--p-primary-color));
}
.custom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
}
.custom__row {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font: 500 14px var(--font-sans);
}
.cart {
  position: sticky;
  top: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.who {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.who__search {
  flex: 1;
}
.who__name {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.walk-in {
  flex: 1;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-weight: 600;
}
.opt {
  display: flex;
  flex-direction: column;
}
.lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.line {
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.line__head {
  display: flex;
  gap: 8px;
  align-items: center;
}
.line__name {
  flex: 1;
  font-weight: 600;
}
.line__total {
  font-weight: 600;
}
.line__body,
.line__discount {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.qty {
  width: 96px;
  flex: none;
}
.disc-value {
  width: 110px;
}
.disc-reason {
  flex: 1;
  min-width: 140px;
}
.line__intro {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  font: 700 18px var(--font-sans);
  border-top: 1px solid var(--border-default);
  padding-top: 8px;
}
.pay {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}
.pay__title {
  font: 600 14px var(--font-sans);
}
.pay__row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.pay__method {
  width: 150px;
}
.pay__amount {
  width: 140px;
}
.pay__ref {
  width: 130px;
}
.pay__left {
  margin: 0;
  font: var(--text-small);
  color: var(--sev-success-fg, var(--text-secondary));
}
.pay__left.due {
  color: var(--sev-warn-fg);
}
.pay__left.over {
  color: var(--sev-danger-fg, var(--red-600));
}
.complete {
  width: 100%;
  min-height: 52px;
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
}
.done {
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.done__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--sev-success-bg, var(--green-50));
  color: var(--sev-success-fg, var(--green-700));
  font-size: 22px;
}
.done h2 {
  margin: 0;
  font: var(--text-h2);
}
.done p {
  margin: 0;
}
.due {
  color: var(--sev-warn-fg);
}
.receipts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.receipt {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-mono);
  color: var(--text-link, var(--primary-700));
  text-decoration: none;
}
.sold {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sold li {
  display: flex;
  gap: 8px;
  align-items: center;
}
.done__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .cart {
    position: static;
  }
}
</style>
