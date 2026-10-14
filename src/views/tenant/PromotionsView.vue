<script setup lang="ts">
// Promotions (US-07.07): discounts staff pick at the point of sale and coupons with a code. Each
// is a percentage or amount, on the whole sale or some products, between dates, at some branches,
// with total and per-client limits and a minimum purchase. Uses are counted.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormField from '@/components/patterns/FormField.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import { tenantApi, type Discount, type DiscountInput, type MembershipPlan } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const org = useOrganization()
const currency = computed(() => org.organization?.currency ?? 'SAR')
const branches = computed(() => auth.user?.switchable_locations ?? [])

const state = ref<'loading' | 'ready' | 'error'>('loading')
const rows = ref<Discount[]>([])
const archived = ref(false)
const plans = ref<MembershipPlan[]>([])
async function load() {
  state.value = 'loading'
  try {
    rows.value = await tenantApi.discounts.list({ archived: archived.value })
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(async () => {
  load()
  plans.value = await tenantApi.membershipPlans.list().catch(() => [])
})
watch(archived, load)

const valueLabel = (d: Discount) => (d.type === 'percent' ? `${d.value}%` : format.money(d.value))
const appliesLabel = (d: Discount) =>
  d.applies_to.mode === 'cart'
    ? t('promotions.wholeSale')
    : d.applies_to.mode === 'kinds'
      ? d.applies_to.kinds
          .map((k) => t(`promotions.kinds.${k}`))
          .join(locale.value === 'ar' ? '، ' : ', ')
      : plans.value
          .filter((p) => d.applies_to.plan_ids.includes(p.id))
          .map((p) => p.display_name)
          .join(locale.value === 'ar' ? '، ' : ', ')
const datesLabel = (d: Discount) =>
  d.starts_on || d.ends_on
    ? `${d.starts_on ? format.date(d.starts_on) : '…'} – ${d.ends_on ? format.date(d.ends_on) : '…'}`
    : t('promotions.always')

// Form
const open = ref(false)
const editing = ref<Discount | null>(null)
const blank = (): DiscountInput => ({
  name: { ar: '', en: '' },
  code: null,
  type: 'percent',
  value: 10,
  applies_to: { mode: 'cart', plan_ids: [], kinds: [] },
  starts_on: null,
  ends_on: null,
  location_ids: null,
  max_uses: null,
  max_uses_per_client: null,
  min_purchase: null,
})
const form = ref<DiscountInput>(blank())
const isCoupon = ref(false)
const dates = ref<(Date | null)[] | null>(null)
const errors = ref<Record<string, string[]>>({})
const error = ref<string | null>(null)
const saving = ref(false)
function edit(d: Discount | null) {
  editing.value = d
  form.value = d ? JSON.parse(JSON.stringify(d)) : blank()
  isCoupon.value = !!d?.code
  dates.value = d?.starts_on
    ? [new Date(`${d.starts_on}T00:00:00`), d.ends_on ? new Date(`${d.ends_on}T00:00:00`) : null]
    : null
  errors.value = {}
  error.value = null
  open.value = true
}
async function save() {
  saving.value = true
  errors.value = {}
  error.value = null
  const input: DiscountInput = {
    ...form.value,
    code: isCoupon.value ? (form.value.code ?? '').trim() || null : null,
    starts_on: dates.value?.[0] ? isoDay(dates.value[0]) : null,
    ends_on: dates.value?.[1]
      ? isoDay(dates.value[1])
      : dates.value?.[0]
        ? isoDay(dates.value[0])
        : null,
    location_ids: form.value.location_ids?.length ? form.value.location_ids : null,
  }
  try {
    if (editing.value) await tenantApi.discounts.update(editing.value.id, input)
    else await tenantApi.discounts.create(input)
    open.value = false
    toast.add({ severity: 'success', summary: t('promotions.saved'), life: 3000 })
    load()
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length
      ? t('plans.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
async function archive(d: Discount) {
  try {
    await tenantApi.discounts.archive(d.id)
    toast.add({ severity: 'info', summary: t('promotions.archived'), life: 3000 })
    load()
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  }
}
const err = (key: string) => errors.value[key]?.[0]
const modeOptions = computed(() =>
  (['cart', 'plans', 'kinds'] as const).map((v) => ({
    value: v,
    label: t(`promotions.modes.${v}`),
  })),
)
const kindOptions = computed(() =>
  (['membership', 'package', 'product'] as const).map((v) => ({
    value: v,
    label: t(`promotions.kinds.${v}`),
  })),
)
const planOptions = computed(() =>
  plans.value
    .filter((p) => p.status !== 'Archived')
    .map((p) => ({ value: p.id, label: p.display_name })),
)
</script>

<template>
  <div class="page">
    <PageHeader :title="t('promotions.title')" :subtitle="t('promotions.subtitle')">
      <template #actions><ArchiveFilter v-model="archived" /></template>
      <template v-if="auth.can('marketing.create')" #primary>
        <Button icon="pi pi-plus" :label="t('promotions.new')" @click="edit(null)" />
      </template>
    </PageHeader>

    <ErrorState
      v-if="state === 'error'"
      class="card"
      :title="t('promotions.loadError')"
      @retry="load"
    />
    <DataTable v-else :value="rows" :loading="state === 'loading'" data-key="id">
      <template #empty>
        <EmptyState
          compact
          icon="pi-percentage"
          :title="t('promotions.empty')"
          :body="t('promotions.emptyHint')"
        />
      </template>
      <Column :header="t('promotions.name')">
        <template #body="{ data }">
          <strong>{{ data.display_name }}</strong>
          <div v-if="data.code" class="code">
            <i class="pi pi-ticket" aria-hidden="true" />{{ data.code }}
          </div>
        </template>
      </Column>
      <Column :header="t('promotions.value')">
        <template #body="{ data }"
          ><span class="num strong">{{ valueLabel(data) }}</span></template
        >
      </Column>
      <Column :header="t('promotions.appliesTo')">
        <template #body="{ data }">{{ appliesLabel(data) }}</template>
      </Column>
      <Column :header="t('promotions.valid')">
        <template #body="{ data }"
          ><span class="muted">{{ datesLabel(data) }}</span></template
        >
      </Column>
      <Column :header="t('promotions.uses')">
        <template #body="{ data }">
          <span class="num"
            >{{ data.uses }}<template v-if="data.max_uses"> / {{ data.max_uses }}</template></span
          >
        </template>
      </Column>
      <Column :header="t('bookings.columns.status')">
        <template #body="{ data }">
          <Tag
            class="tag-sm"
            :severity="data.status === 'Active' ? 'success' : 'secondary'"
            :value="t(`promotions.status.${data.status}`)"
          />
        </template>
      </Column>
      <Column header-class="row-end" body-class="row-end">
        <template #body="{ data }">
          <Button
            v-if="auth.can('marketing.update')"
            icon="pi pi-pencil"
            variant="text"
            severity="secondary"
            size="small"
            :aria-label="t('promotions.edit')"
            @click="edit(data)"
          />
          <Button
            v-if="auth.can('marketing.delete') && data.status === 'Active'"
            v-tooltip.top="t('archive.archive')"
            icon="pi pi-inbox"
            variant="text"
            severity="secondary"
            size="small"
            :aria-label="t('archive.archive')"
            @click="archive(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Drawer
      v-model:visible="open"
      :position="locale === 'ar' ? 'left' : 'right'"
      :header="editing ? t('promotions.edit') : t('promotions.new')"
      class="drawer"
    >
      <form class="form" @submit.prevent="save">
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <TranslatedField
          id="promo-name"
          v-model="form.name"
          :label="t('promotions.name')"
          required
          :maxlength="120"
          :errors="{ any: err('name') ?? err('name.en') ?? err('name.ar') }"
        />
        <div class="toggle">
          <SelectButton
            v-model="isCoupon"
            :options="[
              { value: false, label: t('promotions.kindDiscount') },
              { value: true, label: t('promotions.kindCoupon') },
            ]"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
        </div>
        <FormField
          v-if="isCoupon"
          :label="t('promotions.code')"
          for="promo-code"
          required
          :error="err('code')"
          :help="t('promotions.codeHelp')"
        >
          <InputText
            id="promo-code"
            v-model="form.code"
            dir="ltr"
            maxlength="40"
            class="upper"
            fluid
          />
        </FormField>
        <div class="grid2">
          <FormField :label="t('promotions.type')" for="promo-type">
            <SelectButton
              v-model="form.type"
              :options="[
                { value: 'percent', label: '%' },
                { value: 'amount', label: currency },
              ]"
              option-label="label"
              option-value="value"
              :allow-empty="false"
            />
          </FormField>
          <FormField
            :label="t('promotions.value')"
            for="promo-value"
            required
            :error="err('value')"
          >
            <InputNumber
              v-model="form.value"
              input-id="promo-value"
              :min="0"
              :max="form.type === 'percent' ? 100 : undefined"
              :max-fraction-digits="3"
              fluid
            />
          </FormField>
        </div>
        <FormField :label="t('promotions.appliesTo')" for="promo-mode">
          <SelectButton
            v-model="form.applies_to.mode"
            :options="modeOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
        </FormField>
        <FormField
          v-if="form.applies_to.mode === 'plans'"
          :label="t('promotions.products')"
          for="promo-plans"
          :error="err('applies_to.plan_ids')"
        >
          <MultiSelect
            v-model="form.applies_to.plan_ids"
            input-id="promo-plans"
            :options="planOptions"
            option-label="label"
            option-value="value"
            filter
            fluid
          />
        </FormField>
        <FormField
          v-if="form.applies_to.mode === 'kinds'"
          :label="t('promotions.productTypes')"
          for="promo-kinds"
          :error="err('applies_to.kinds')"
        >
          <MultiSelect
            v-model="form.applies_to.kinds"
            input-id="promo-kinds"
            :options="kindOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
        <FormField
          :label="t('promotions.valid')"
          for="promo-dates"
          :help="t('promotions.validHelp')"
          :error="err('ends_on')"
        >
          <DatePicker
            v-model="dates"
            input-id="promo-dates"
            selection-mode="range"
            :manual-input="false"
            show-icon
            icon-display="input"
            show-button-bar
            fluid
          />
        </FormField>
        <FormField
          v-if="branches.length > 1"
          :label="t('promotions.branches')"
          for="promo-branches"
          :help="t('promotions.branchesHelp')"
        >
          <MultiSelect
            :model-value="form.location_ids ?? []"
            input-id="promo-branches"
            :options="branches"
            option-label="name"
            option-value="id"
            fluid
            @update:model-value="(v: number[]) => (form.location_ids = v)"
          />
        </FormField>
        <div class="grid2">
          <FormField :label="t('promotions.maxUses')" for="promo-max">
            <InputNumber
              v-model="form.max_uses"
              input-id="promo-max"
              :min="1"
              :placeholder="t('plans.noLimit')"
              fluid
            />
          </FormField>
          <FormField :label="t('promotions.maxPerClient')" for="promo-per-client">
            <InputNumber
              v-model="form.max_uses_per_client"
              input-id="promo-per-client"
              :min="1"
              :placeholder="t('plans.noLimit')"
              fluid
            />
          </FormField>
        </div>
        <FormField
          :label="t('promotions.minPurchase')"
          for="promo-min"
          :help="t('promotions.minPurchaseHelp')"
        >
          <InputNumber
            v-model="form.min_purchase"
            input-id="promo-min"
            mode="currency"
            :currency="currency"
            :min="0"
            :max-fraction-digits="3"
            :placeholder="t('plans.noLimit')"
            fluid
          />
        </FormField>
      </form>
      <template #footer>
        <div class="footer">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            variant="text"
            @click="open = false"
          />
          <Button :label="t('common.save')" :loading="saving" @click="save" />
        </div>
      </template>
    </Drawer>
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
}
.code {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  margin-top: 2px;
  font: 600 12px var(--font-mono);
  color: var(--primary-700, var(--p-primary-color));
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
}
.strong {
  font-weight: 600;
}
:deep(.drawer) {
  width: min(520px, 100vw);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.upper :deep(input),
.upper {
  text-transform: uppercase;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
