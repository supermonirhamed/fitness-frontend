<script setup lang="ts">
// A membership plan's editor (US-06.01): name and description (AR/EN) and status; unlimited or
// limited (N visits a week/month); one-time for a duration or recurring monthly/yearly with a
// minimum commitment; joining fee; a price per branch (VAT from the branch); and the entitlement
// rules — services covered, branches, and limits per day / week / hours (off-peak).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import { tenantApi, type MembershipPlan, type MembershipPlanInput } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ plan: MembershipPlan | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [plan: MembershipPlan] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const org = useOrganization()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const currency = computed(() => org.organization?.currency ?? 'SAR')

const blank = (): MembershipPlanInput => ({
  name: { ar: '', en: '' },
  description: { ar: '', en: '' },
  status: 'Draft',
  type: 'Unlimited',
  visit_limit: null,
  visit_period: null,
  billing: 'recurring',
  duration_value: null,
  duration_unit: null,
  billing_interval: 'month',
  min_commitment_months: null,
  joining_fee: null,
  prices: [],
  rules: {
    services: { mode: 'all', category_ids: [], service_ids: [] },
    locations: { mode: 'all', location_ids: [] },
    limits: { per_day: null, per_week: null, hours: null },
  },
})
const form = ref<MembershipPlanInput>(blank())
const priceAt = ref<Record<number, { on: boolean; price: number | null }>>({})
const offPeak = ref(false)
const hours = ref({ from: '06:00', to: '16:00' })
const categories = ref<{ id: number; name: string }[]>([])
const services = ref<{ id: number; name: string }[]>([])
const branches = computed(() => auth.user?.switchable_locations ?? [])
const errors = ref<Record<string, string[]>>({})
const error = ref<string | null>(null)
const saving = ref(false)

watch(visible, async (open) => {
  if (!open) return
  const p = props.plan
  form.value = p
    ? JSON.parse(JSON.stringify({ ...p, description: p.description ?? { ar: '', en: '' } }))
    : blank()
  priceAt.value = Object.fromEntries(
    branches.value.map((b) => {
      const price = p?.prices.find((x) => x.location_id === b.id)
      return [b.id, { on: !!price, price: price?.price ?? null }]
    }),
  )
  offPeak.value = !!p?.rules.limits.hours
  hours.value = p?.rules.limits.hours ?? { from: '06:00', to: '16:00' }
  errors.value = {}
  error.value = null
  if (!categories.value.length) {
    const [cats, svcs] = await Promise.all([
      tenantApi.serviceCategories.list().catch(() => []),
      tenantApi.services.list().catch(() => []),
    ])
    categories.value = cats.map((c) => ({ id: c.id, name: c.display_name ?? '' }))
    services.value = svcs.map((s) => ({ id: s.id, name: s.display_name ?? '' }))
  }
})

const err = (key: string) => errors.value[key]?.[0]
const options = (keys: string[], prefix: string) =>
  keys.map((k) => ({ value: k, label: t(`${prefix}.${k}`) }))

async function save() {
  saving.value = true
  errors.value = {}
  error.value = null
  const f = form.value
  const limited = f.type === 'Limited'
  const oneTime = f.billing === 'one_time'
  const input: MembershipPlanInput = {
    ...f,
    visit_limit: limited ? f.visit_limit : null,
    visit_period: limited ? (f.visit_period ?? 'week') : null,
    duration_value: oneTime ? f.duration_value : null,
    duration_unit: oneTime ? (f.duration_unit ?? 'months') : null,
    billing_interval: oneTime ? null : (f.billing_interval ?? 'month'),
    min_commitment_months: oneTime ? null : f.min_commitment_months,
    prices: Object.entries(priceAt.value)
      .filter(([, v]) => v.on && v.price !== null)
      .map(([id, v]) => ({ location_id: Number(id), price: v.price! })),
    rules: { ...f.rules, limits: { ...f.rules.limits, hours: offPeak.value ? hours.value : null } },
  }
  try {
    const plan = props.plan
      ? await tenantApi.membershipPlans.update(props.plan.id, input)
      : await tenantApi.membershipPlans.create(input)
    emit('saved', plan)
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length
      ? t('plans.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer v-model:visible="visible" :position="position" :block-scroll="true" class="plan-drawer">
    <template #header>
      <div class="title">{{ plan ? plan.display_name : t('plans.new') }}</div>
    </template>
    <div class="form">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <Message v-if="plan?.status === 'Published'" severity="info" :closable="false">{{
        t('plans.editPublished')
      }}</Message>

      <TranslatedField
        id="plan-name"
        v-model="form.name"
        :label="t('plans.name')"
        required
        :maxlength="120"
        :errors="{ any: err('name') ?? err('name.en') ?? err('name.ar') }"
      />
      <TranslatedField
        id="plan-desc"
        v-model="form.description!"
        :label="t('plans.description')"
        multiline
        :maxlength="2000"
      />
      <div class="field">
        <span id="plan-status" class="label">{{ t('plans.status') }}</span>
        <SelectButton
          v-model="form.status"
          :options="options(['Draft', 'Published', 'Archived'], 'plans.statuses')"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="plan-status"
        />
      </div>

      <h3 class="section">{{ t('plans.sections.access') }}</h3>
      <SelectButton
        v-model="form.type"
        :options="options(['Unlimited', 'Limited'], 'plans.types')"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('plans.sections.access')"
      />
      <div v-if="form.type === 'Limited'" class="row">
        <InputNumber
          v-model="form.visit_limit"
          :min="1"
          :max="100"
          :invalid="!!err('visit_limit')"
          :aria-label="t('plans.visits')"
          :suffix="` ${t('plans.visitsUnit')}`"
        />
        <Select
          :model-value="form.visit_period ?? 'week'"
          :options="options(['week', 'month'], 'plans.per')"
          option-label="label"
          option-value="value"
          @update:model-value="form.visit_period = $event"
        />
      </div>

      <h3 class="section">{{ t('plans.sections.billing') }}</h3>
      <SelectButton
        v-model="form.billing"
        :options="options(['recurring', 'one_time'], 'plans.billings')"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('plans.sections.billing')"
      />
      <div v-if="form.billing === 'one_time'" class="row">
        <InputNumber
          v-model="form.duration_value"
          :min="1"
          :max="1000"
          :invalid="!!err('duration_value')"
          :aria-label="t('plans.duration')"
        />
        <Select
          :model-value="form.duration_unit ?? 'months'"
          :options="options(['days', 'weeks', 'months', 'years'], 'plans.units')"
          option-label="label"
          option-value="value"
          @update:model-value="form.duration_unit = $event"
        />
      </div>
      <template v-else>
        <Select
          :model-value="form.billing_interval ?? 'month'"
          :options="options(['month', 'year'], 'plans.intervals')"
          option-label="label"
          option-value="value"
          :aria-label="t('plans.interval')"
          @update:model-value="form.billing_interval = $event"
        />
        <div class="field">
          <label for="plan-commit" class="label">{{ t('plans.commitment') }}</label>
          <InputNumber
            v-model="form.min_commitment_months"
            input-id="plan-commit"
            :min="1"
            :max="60"
            :suffix="` ${t('plans.months')}`"
            :placeholder="t('plans.noCommitment')"
          />
        </div>
      </template>
      <div class="field">
        <label for="plan-fee" class="label">{{ t('plans.joiningFee') }}</label>
        <InputNumber
          v-model="form.joining_fee"
          input-id="plan-fee"
          mode="currency"
          :currency="currency"
          :min="0"
          :max-fraction-digits="3"
          :placeholder="t('plans.noFee')"
        />
      </div>

      <h3 class="section">{{ t('plans.sections.prices') }}</h3>
      <small class="muted">{{ t('plans.vatNote') }}</small>
      <small v-if="err('prices')" class="error">{{ t('plans.priceNeeded') }}</small>
      <div v-for="b in branches" :key="b.id" class="price">
        <label class="check"><Checkbox v-model="priceAt[b.id]!.on" binary /> {{ b.name }}</label>
        <InputNumber
          v-model="priceAt[b.id]!.price"
          mode="currency"
          :currency="currency"
          :min="0"
          :max-fraction-digits="3"
          :disabled="!priceAt[b.id]!.on"
          :aria-label="t('plans.priceAt', { branch: b.name })"
        />
      </div>

      <h3 class="section">{{ t('plans.sections.rules') }}</h3>
      <div class="field">
        <span class="label">{{ t('plans.covers') }}</span>
        <SelectButton
          v-model="form.rules.services.mode"
          :options="options(['all', 'categories', 'services'], 'plans.coverModes')"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <MultiSelect
          v-if="form.rules.services.mode === 'categories'"
          v-model="form.rules.services.category_ids"
          :options="categories"
          option-label="name"
          option-value="id"
          display="chip"
          :invalid="!!err('rules.services.category_ids')"
        />
        <MultiSelect
          v-if="form.rules.services.mode === 'services'"
          v-model="form.rules.services.service_ids"
          :options="services"
          option-label="name"
          option-value="id"
          display="chip"
          filter
          :invalid="!!err('rules.services.service_ids')"
        />
      </div>
      <div class="field">
        <span class="label">{{ t('plans.validAt') }}</span>
        <SelectButton
          v-model="form.rules.locations.mode"
          :options="options(['all', 'home', 'selected'], 'plans.locationModes')"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <MultiSelect
          v-if="form.rules.locations.mode === 'selected'"
          v-model="form.rules.locations.location_ids"
          :options="branches"
          option-label="name"
          option-value="id"
          display="chip"
          :invalid="!!err('rules.locations.location_ids')"
        />
      </div>
      <div class="row">
        <div class="field">
          <label for="plan-per-day" class="label">{{ t('plans.perDay') }}</label>
          <InputNumber
            v-model="form.rules.limits.per_day"
            input-id="plan-per-day"
            :min="1"
            :max="20"
            :placeholder="t('plans.noLimit')"
          />
        </div>
        <div class="field">
          <label for="plan-per-week" class="label">{{ t('plans.perWeek') }}</label>
          <InputNumber
            v-model="form.rules.limits.per_week"
            input-id="plan-per-week"
            :min="1"
            :max="100"
            :placeholder="t('plans.noLimit')"
          />
        </div>
      </div>
      <label class="check"><Checkbox v-model="offPeak" binary /> {{ t('plans.offPeak') }}</label>
      <div v-if="offPeak" class="row">
        <InputText
          v-model="hours.from"
          type="time"
          :aria-label="t('plans.from')"
          :invalid="!!err('rules.limits.hours.from')"
        />
        <InputText
          v-model="hours.to"
          type="time"
          :aria-label="t('plans.to')"
          :invalid="!!err('rules.limits.hours.to')"
        />
      </div>
    </div>
    <template #footer>
      <div class="footer">
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button :label="t('common.save')" :loading="saving" @click="save" />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.title {
  font: var(--text-h3);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section {
  font: var(--text-h4);
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font: 500 14px var(--font-sans);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.price {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 10px;
  align-items: center;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
}
.error {
  color: var(--sev-danger-fg);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
