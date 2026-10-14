<script setup lang="ts">
// The editor page for a product (EP-06): basics (AR/EN name, description, status); for a membership
// plan (US-06.01) access (unlimited or N visits a week/month) and billing (recurring with a minimum
// commitment, or one-time for a duration) with a joining fee; for a credit package (US-06.02) credits
// and validity, or a single-service drop-in; when it starts (US-06.03); a price per branch (VAT from
// the branch); and the entitlement rules — services covered with exclusions (US-06.04), branches
// (US-06.05), limits per day / week and off-peak hours. A live summary shows it as it will be listed.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormField from '@/components/patterns/FormField.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import {
  tenantApi,
  type FreezePolicy,
  type MembershipPlan,
  type MembershipPlanInput,
  type PlanKind,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { usePlanSummary } from '@/composables/usePlanSummary'
import { statusOf, validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useOrganization } from '@/stores/organization'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()
const org = useOrganization()
const format = useFormat()
const currency = computed(() => org.organization?.currency ?? 'SAR')
const planId = computed(() => (route.params.id ? Number(route.params.id) : null))
const kind = computed<PlanKind>(() =>
  plan.value ? plan.value.kind : route.meta.kind === 'package' ? 'package' : 'membership',
)
const isPackage = computed(() => kind.value === 'package')

const blank = (): MembershipPlanInput => ({
  kind: route.meta.kind === 'package' ? 'package' : 'membership',
  name: { ar: '', en: '' },
  description: { ar: '', en: '' },
  status: 'Draft',
  type: 'Unlimited',
  visit_limit: null,
  visit_period: 'week',
  billing: 'recurring',
  duration_value: null,
  duration_unit: 'months',
  billing_interval: 'month',
  min_commitment_months: null,
  joining_fee: null,
  credits: 10,
  validity_mode: 'days',
  validity_days: 60,
  valid_until: null,
  drop_in_service_id: null,
  activation: 'purchase',
  activation_max_wait_days: 30,
  intro_offer: null,
  requires_payment: false,
  freeze_policy: null,
  prices: [],
  rules: {
    services: {
      mode: 'all',
      category_ids: [],
      service_ids: [],
      program_ids: [],
      exclude_service_ids: [],
    },
    locations: { mode: 'all', location_ids: [], include_future: true },
    limits: { per_day: null, per_week: null, hours: null },
  },
})

const state = ref<'loading' | 'ready' | 'error' | 'forbidden' | 'missing'>('loading')
const plan = ref<MembershipPlan | null>(null)
const form = ref<MembershipPlanInput>(blank())
const priceAt = ref<Record<number, { on: boolean; price: number | null }>>({})
const samePrice = ref<number | null>(null)
const offPeak = ref(false)
const hours = ref({ from: '06:00', to: '16:00' })
const categories = ref<{ id: number; name: string }[]>([])
const services = ref<{ id: number; name: string }[]>([])
const programs = ref<{ id: number; name: string }[]>([])
const dropIn = ref(false)
// Freezing (US-06.11), memberships only.
const freezeOn = ref(false)
const freeze = ref<FreezePolicy>({ min_days: 7, max_days: 60, max_per_year: 2, fee: null })
const { freezeSummary } = usePlanSummary()
const branches = computed(() => auth.user?.switchable_locations ?? [])
const errors = ref<Record<string, string[]>>({})
const error = ref<string | null>(null)
const saving = ref(false)

async function load() {
  state.value = 'loading'
  try {
    const [p, cats, svcs, progs] = await Promise.all([
      planId.value ? tenantApi.membershipPlans.get(planId.value) : Promise.resolve(null),
      tenantApi.serviceCategories.list().catch(() => []),
      tenantApi.services.list().catch(() => []),
      tenantApi.programs.list().catch(() => []),
    ])
    categories.value = cats.map((c) => ({ id: c.id, name: c.display_name ?? '' }))
    services.value = svcs.map((s) => ({ id: s.id, name: s.display_name ?? '' }))
    programs.value = progs.map((x) => ({ id: x.id, name: x.display_name ?? '' }))
    plan.value = p
    const base = blank()
    form.value = p
      ? {
          ...base,
          ...JSON.parse(JSON.stringify(p)),
          description: p.description ?? { ar: '', en: '' },
          type: p.type ?? 'Unlimited',
          billing: p.billing ?? 'recurring',
          visit_period: p.visit_period ?? 'week',
          duration_unit: p.duration_unit ?? 'months',
          billing_interval: p.billing_interval ?? 'month',
          validity_mode: p.validity_mode ?? 'days',
          activation_max_wait_days: p.activation_max_wait_days ?? 30,
          rules: {
            ...p.rules,
            services: { ...base.rules.services, ...p.rules.services },
            locations: {
              ...p.rules.locations,
              // Saved before include_future existed: it covered every branch.
              include_future: p.rules.locations.include_future ?? true,
            },
          },
        }
      : base
    dropIn.value = !!p?.drop_in_service_id
    priceAt.value = Object.fromEntries(
      branches.value.map((b) => {
        const price = p?.prices.find((x) => x.location_id === b.id)
        // A new plan starts on sale at every branch the user can see.
        return [b.id, { on: p ? !!price : true, price: price?.price ?? null }]
      }),
    )
    offPeak.value = !!p?.rules.limits.hours
    freezeOn.value = !!p?.freeze_policy
    if (p?.freeze_policy) freeze.value = { ...p.freeze_policy }
    hours.value = p?.rules.limits.hours ?? { from: '06:00', to: '16:00' }
    state.value = 'ready'
  } catch (e) {
    const status = statusOf(e)
    state.value = status === 403 ? 'forbidden' : status === 404 ? 'missing' : 'error'
  }
}
onMounted(load)

const err = (key: string) => errors.value[key]?.[0]
const options = (keys: string[], prefix: string) =>
  keys.map((k) => ({ value: k, label: t(`${prefix}.${k}`) }))
const choices = (keys: string[], prefix: string, icons: Record<string, string>) =>
  keys.map((k) => ({
    value: k,
    label: t(`${prefix}.${k}`),
    hint: t(`plans.hints.${k}`),
    icon: icons[k],
  }))

const statusChoices = computed(() =>
  choices(['Draft', 'Published', 'Archived'], 'plans.statuses', {
    Draft: 'pi-pencil',
    Published: 'pi-shopping-cart',
    Archived: 'pi-inbox',
  }),
)
const typeChoices = computed(() =>
  choices(['Unlimited', 'Limited'], 'plans.types', {
    Unlimited: 'pi-star',
    Limited: 'pi-ticket',
  }),
)
const validityChoices = computed(() =>
  choices(['days', 'fixed_date'], 'plans.validityModes', {
    days: 'pi-hourglass',
    fixed_date: 'pi-calendar-times',
  }),
)
const activationChoices = computed(() =>
  choices(['purchase', 'chosen_date', 'first_use'], 'plans.activations', {
    purchase: 'pi-shopping-bag',
    chosen_date: 'pi-calendar',
    first_use: 'pi-sign-in',
  }),
)
// Intro offers and free trials (US-06.06).
const introChoices = computed(() =>
  (['none', 'new_clients', 'first_time'] as const).map((k) => ({
    value: k === 'none' ? null : k,
    key: k,
    label: t(`plans.intros.${k}`),
    hint: t(`plans.introHints.${k}`),
    icon: { none: 'pi-users', new_clients: 'pi-user-plus', first_time: 'pi-gift' }[k],
  })),
)
const freeTrial = computed(
  () => pricedBranches.value.length > 0 && pricedBranches.value.every((b) => b.price === 0),
)
// A drop-in is one credit for one service (US-06.02).
function toggleDropIn(on: boolean) {
  dropIn.value = on
  if (on) form.value.credits = 1
  else form.value.drop_in_service_id = null
}
const minDate = new Date()
const validUntil = computed({
  get: () => (form.value.valid_until ? new Date(`${form.value.valid_until}T00:00:00`) : null),
  set: (d: Date | null) => {
    form.value.valid_until = d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null
  },
})
const billingChoices = computed(() =>
  choices(['recurring', 'one_time'], 'plans.billings', {
    recurring: 'pi-refresh',
    one_time: 'pi-calendar',
  }),
)

function applySamePrice() {
  if (samePrice.value === null) return
  for (const b of branches.value) priceAt.value[b.id] = { on: true, price: samePrice.value }
}
const pricedBranches = computed(() =>
  branches.value
    .filter((b) => priceAt.value[b.id]?.on && priceAt.value[b.id]?.price !== null)
    .map((b) => ({ name: b.name, price: priceAt.value[b.id]!.price! })),
)

// Live summary
const previewName = computed(
  () =>
    (locale.value === 'ar' ? form.value.name.ar : form.value.name.en) ||
    form.value.name.en ||
    form.value.name.ar ||
    t('plans.untitled'),
)
const previewPrice = computed(() => {
  const prices = pricedBranches.value.map((x) => x.price)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? format.money(min) : `${format.money(min)} – ${format.money(max)}`
})
const previewAccess = computed(() =>
  isPackage.value
    ? dropIn.value
      ? t('plans.dropInSummary', {
          service: services.value.find((x) => x.id === form.value.drop_in_service_id)?.name ?? '–',
        })
      : t('plans.creditsSummary', { n: form.value.credits ?? '–' })
    : form.value.type === 'Unlimited'
      ? t('plans.types.Unlimited')
      : t('plans.limitedSummary', {
          n: form.value.visit_limit ?? '–',
          per: t(`plans.per.${form.value.visit_period ?? 'week'}`),
        }),
)
const previewBilling = computed(() =>
  isPackage.value
    ? form.value.validity_mode === 'fixed_date'
      ? t('plans.validUntilSummary', {
          date: form.value.valid_until ? format.date(form.value.valid_until) : '–',
        })
      : t('plans.validDaysSummary', { n: form.value.validity_days ?? '–' })
    : form.value.billing === 'recurring'
      ? [
          t(`plans.intervals.${form.value.billing_interval ?? 'month'}`),
          form.value.min_commitment_months
            ? t('plans.commitmentSummary', { n: form.value.min_commitment_months })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('plans.durationSummary', {
          n: form.value.duration_value ?? '–',
          unit: t(`plans.units.${form.value.duration_unit ?? 'months'}`),
        }),
)
const previewCovers = computed(() => {
  const s = form.value.rules.services
  if (s.mode === 'categories') return t('plans.coversCategories', { n: s.category_ids.length })
  if (s.mode === 'services') return t('plans.coversServices', { n: s.service_ids.length })
  if (s.mode === 'programs') return t('plans.coversPrograms', { n: s.program_ids.length })
  return s.exclude_service_ids.length
    ? t('plans.coversAllExcept', { n: s.exclude_service_ids.length })
    : t('plans.coverModes.all')
})
const previewActivation = computed(() =>
  form.value.activation === 'first_use'
    ? t('plans.activationSummary.first_use', { n: form.value.activation_max_wait_days ?? 30 })
    : t(`plans.activationSummary.${form.value.activation}`),
)
const previewWhere = computed(() => {
  const l = form.value.rules.locations
  if (l.mode === 'selected') return t('plans.validAtCount', { n: l.location_ids.length })
  if (l.mode === 'all' && !l.include_future) return t('plans.allCurrentBranches')
  return t(`plans.locationModes.${l.mode}`)
})
const checklist = computed(() => [
  {
    done: !!(form.value.name.en?.trim() || form.value.name.ar?.trim()),
    label: t('plans.check.name'),
  },
  isPackage.value
    ? {
        done: !!form.value.credits && (!dropIn.value || !!form.value.drop_in_service_id),
        label: t('plans.check.credits'),
      }
    : {
        done:
          form.value.type === 'Unlimited' ||
          (!!form.value.visit_limit && form.value.visit_limit > 0),
        label: t('plans.check.access'),
      },
  isPackage.value
    ? {
        done:
          form.value.validity_mode === 'days'
            ? !!form.value.validity_days
            : !!form.value.valid_until,
        label: t('plans.check.validity'),
      }
    : {
        done: form.value.billing === 'recurring' || !!form.value.duration_value,
        label: t('plans.check.billing'),
      },
  { done: pricedBranches.value.length > 0, label: t('plans.check.price') },
])

async function save() {
  saving.value = true
  errors.value = {}
  error.value = null
  const f = form.value
  const pkg = isPackage.value
  const limited = !pkg && f.type === 'Limited'
  const oneTime = !pkg && f.billing === 'one_time'
  const input: MembershipPlanInput = {
    ...f,
    kind: kind.value,
    type: pkg ? null : f.type,
    billing: pkg ? null : f.billing,
    joining_fee: pkg ? null : f.joining_fee,
    credits: pkg ? f.credits : null,
    validity_mode: pkg ? f.validity_mode : null,
    validity_days: pkg && f.validity_mode === 'days' ? f.validity_days : null,
    valid_until: pkg && f.validity_mode === 'fixed_date' ? f.valid_until : null,
    drop_in_service_id: pkg && dropIn.value ? f.drop_in_service_id : null,
    activation_max_wait_days: f.activation === 'first_use' ? f.activation_max_wait_days : null,
    visit_limit: limited ? f.visit_limit : null,
    visit_period: limited ? (f.visit_period ?? 'week') : null,
    duration_value: oneTime ? f.duration_value : null,
    duration_unit: oneTime ? (f.duration_unit ?? 'months') : null,
    billing_interval: pkg || oneTime ? null : (f.billing_interval ?? 'month'),
    min_commitment_months: pkg || oneTime ? null : f.min_commitment_months,
    freeze_policy: !pkg && freezeOn.value ? freeze.value : null,
    prices: Object.entries(priceAt.value)
      .filter(([, v]) => v.on && v.price !== null)
      .map(([id, v]) => ({ location_id: Number(id), price: v.price! })),
    rules: { ...f.rules, limits: { ...f.rules.limits, hours: offPeak.value ? hours.value : null } },
  }
  try {
    const saved = plan.value
      ? await tenantApi.membershipPlans.update(plan.value.id, input)
      : await tenantApi.membershipPlans.create(input)
    toast.add({
      severity: 'success',
      summary: t('plans.saved', { name: saved.display_name }),
      life: 3000,
    })
    router.push({ name: 'tenant.memberships.show', params: { id: saved.id } })
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = Object.keys(errors.value).length
      ? t('plans.checkFields')
      : (apiMessage(e) ?? t('common.genericError'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } finally {
    saving.value = false
  }
}
const cancel = () =>
  router.push(
    plan.value
      ? { name: 'tenant.memberships.show', params: { id: plan.value.id } }
      : { name: 'tenant.memberships' },
  )
const title = computed(() =>
  plan.value ? plan.value.display_name : isPackage.value ? t('plans.newPackage') : t('plans.new'),
)
</script>

<template>
  <div class="page">
    <PageHeader
      :title="title"
      :breadcrumb="[
        { label: t('plans.title'), to: { name: 'tenant.memberships' } },
        { label: plan ? t('plans.edit') : title },
      ]"
    >
      <template v-if="plan" #status><StatusTag :status="plan.status" /></template>
      <template v-if="state === 'ready'" #actions>
        <Button :label="t('common.cancel')" severity="secondary" variant="text" @click="cancel" />
      </template>
      <template v-if="state === 'ready'" #primary>
        <Button
          icon="pi pi-check"
          :label="plan ? t('common.saveChanges') : t('plans.create')"
          :loading="saving"
          @click="save"
        />
      </template>
    </PageHeader>

    <div v-if="state === 'loading'" class="layout">
      <div class="main">
        <Skeleton v-for="n in 3" :key="n" height="180px" />
      </div>
      <Skeleton height="320px" />
    </div>
    <NoPermission v-else-if="state === 'forbidden'" class="card" />
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-id-card"
      :title="t('plans.notFound')"
    >
      <Button :label="t('plans.backToPlans')" icon="pi pi-arrow-left pi-dir" @click="cancel" />
    </EmptyState>
    <ErrorState
      v-else-if="state === 'error'"
      class="card"
      :title="t('plans.loadError')"
      @retry="load"
    />

    <form v-else class="layout" novalidate @submit.prevent="save">
      <div class="main">
        <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
        <Message
          v-if="plan?.status === 'Published'"
          severity="info"
          :closable="false"
          icon="pi pi-info-circle"
          >{{ t('plans.editPublished') }}</Message
        >

        <!-- 1. Basics -->
        <section class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-id-card" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.basics') }}</h2>
              <p>{{ t('plans.sectionHints.basics') }}</p>
            </div>
          </header>
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
            <div class="choices choices--3" role="radiogroup" aria-labelledby="plan-status">
              <button
                v-for="c in statusChoices"
                :key="c.value"
                type="button"
                role="radio"
                :aria-checked="form.status === c.value"
                :class="['choice', { 'choice--on': form.status === c.value }]"
                @click="form.status = c.value as MembershipPlan['status']"
              >
                <i :class="['pi', c.icon]" aria-hidden="true" />
                <span class="choice__title">{{ c.label }}</span>
                <span class="choice__hint">{{ c.hint }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 2a. Package: credits and validity (US-06.02) -->
        <section v-if="isPackage" class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-ticket" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.credits') }}</h2>
              <p>{{ t('plans.sectionHints.credits') }}</p>
            </div>
          </header>
          <div class="toggle">
            <ToggleSwitch
              :model-value="dropIn"
              input-id="plan-dropin"
              @update:model-value="toggleDropIn"
            />
            <label for="plan-dropin">{{ t('plans.dropIn') }}</label>
          </div>
          <div class="grid2">
            <FormField
              v-if="dropIn"
              :label="t('plans.dropInService')"
              for="plan-dropin-service"
              required
              :help="t('plans.dropInHelp')"
              :error="err('drop_in_service_id')"
            >
              <Select
                v-model="form.drop_in_service_id"
                input-id="plan-dropin-service"
                :options="services"
                option-label="name"
                option-value="id"
                filter
                fluid
                :placeholder="t('plans.pickService')"
                :invalid="!!err('drop_in_service_id')"
              />
            </FormField>
            <FormField
              v-else
              :label="t('plans.credits')"
              for="plan-credits"
              required
              :help="t('plans.creditsHelp')"
              :error="err('credits')"
            >
              <InputNumber
                v-model="form.credits"
                input-id="plan-credits"
                :min="1"
                :max="500"
                show-buttons
                :invalid="!!err('credits')"
                fluid
              />
            </FormField>
          </div>
          <div class="field">
            <span id="plan-validity" class="label">{{ t('plans.validity') }}</span>
            <div class="choices" role="radiogroup" aria-labelledby="plan-validity">
              <button
                v-for="c in validityChoices"
                :key="c.value"
                type="button"
                role="radio"
                :aria-checked="form.validity_mode === c.value"
                :class="['choice', { 'choice--on': form.validity_mode === c.value }]"
                @click="form.validity_mode = c.value as 'days' | 'fixed_date'"
              >
                <i :class="['pi', c.icon]" aria-hidden="true" />
                <span class="choice__title">{{ c.label }}</span>
                <span class="choice__hint">{{ c.hint }}</span>
              </button>
            </div>
          </div>
          <div class="grid2">
            <FormField
              v-if="form.validity_mode === 'days'"
              :label="t('plans.validityDays')"
              for="plan-validity-days"
              required
              :error="err('validity_days')"
            >
              <InputNumber
                v-model="form.validity_days"
                input-id="plan-validity-days"
                :min="1"
                :max="3650"
                :suffix="` ${t('plans.units.days')}`"
                :invalid="!!err('validity_days')"
                fluid
              />
            </FormField>
            <FormField
              v-else
              :label="t('plans.validUntil')"
              for="plan-valid-until"
              required
              :error="err('valid_until')"
            >
              <DatePicker
                v-model="validUntil"
                input-id="plan-valid-until"
                date-format="yy-mm-dd"
                :min-date="minDate"
                show-icon
                icon-display="input"
                :invalid="!!err('valid_until')"
                fluid
              />
            </FormField>
          </div>
        </section>

        <!-- 2. Access -->
        <section v-if="!isPackage" class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-ticket" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.access') }}</h2>
              <p>{{ t('plans.sectionHints.access') }}</p>
            </div>
          </header>
          <div class="choices" role="radiogroup" :aria-label="t('plans.sections.access')">
            <button
              v-for="c in typeChoices"
              :key="c.value"
              type="button"
              role="radio"
              :aria-checked="form.type === c.value"
              :class="['choice', { 'choice--on': form.type === c.value }]"
              @click="form.type = c.value as MembershipPlan['type']"
            >
              <i :class="['pi', c.icon]" aria-hidden="true" />
              <span class="choice__title">{{ c.label }}</span>
              <span class="choice__hint">{{ c.hint }}</span>
            </button>
          </div>
          <div v-if="form.type === 'Limited'" class="grid2">
            <FormField
              :label="t('plans.visits')"
              for="plan-visits"
              required
              :error="err('visit_limit')"
            >
              <InputNumber
                v-model="form.visit_limit"
                input-id="plan-visits"
                :min="1"
                :max="100"
                show-buttons
                :invalid="!!err('visit_limit')"
                fluid
              />
            </FormField>
            <FormField :label="t('plans.period')" for="plan-period">
              <Select
                v-model="form.visit_period"
                input-id="plan-period"
                :options="options(['week', 'month'], 'plans.per')"
                option-label="label"
                option-value="value"
                fluid
              />
            </FormField>
          </div>
        </section>

        <!-- 3. Billing -->
        <section v-if="!isPackage" class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-wallet" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.billing') }}</h2>
              <p>{{ t('plans.sectionHints.billing') }}</p>
            </div>
          </header>
          <div class="choices" role="radiogroup" :aria-label="t('plans.sections.billing')">
            <button
              v-for="c in billingChoices"
              :key="c.value"
              type="button"
              role="radio"
              :aria-checked="form.billing === c.value"
              :class="['choice', { 'choice--on': form.billing === c.value }]"
              @click="form.billing = c.value as MembershipPlan['billing']"
            >
              <i :class="['pi', c.icon]" aria-hidden="true" />
              <span class="choice__title">{{ c.label }}</span>
              <span class="choice__hint">{{ c.hint }}</span>
            </button>
          </div>
          <div v-if="form.billing === 'one_time'" class="grid2">
            <FormField
              :label="t('plans.duration')"
              for="plan-duration"
              required
              :error="err('duration_value')"
            >
              <InputNumber
                v-model="form.duration_value"
                input-id="plan-duration"
                :min="1"
                :max="1000"
                show-buttons
                :invalid="!!err('duration_value')"
                fluid
              />
            </FormField>
            <FormField :label="t('plans.unit')" for="plan-unit">
              <Select
                v-model="form.duration_unit"
                input-id="plan-unit"
                :options="options(['days', 'weeks', 'months', 'years'], 'plans.units')"
                option-label="label"
                option-value="value"
                fluid
              />
            </FormField>
          </div>
          <div v-else class="grid2">
            <FormField :label="t('plans.interval')" for="plan-interval">
              <Select
                v-model="form.billing_interval"
                input-id="plan-interval"
                :options="options(['month', 'year'], 'plans.intervals')"
                option-label="label"
                option-value="value"
                fluid
              />
            </FormField>
            <FormField
              :label="t('plans.commitment')"
              for="plan-commit"
              :help="t('plans.commitmentHelp')"
              :error="err('min_commitment_months')"
            >
              <InputNumber
                v-model="form.min_commitment_months"
                input-id="plan-commit"
                :min="1"
                :max="60"
                :suffix="` ${t('plans.months')}`"
                :placeholder="t('plans.noCommitment')"
                fluid
              />
            </FormField>
          </div>
          <div class="grid2">
            <FormField
              :label="t('plans.joiningFee')"
              for="plan-fee"
              :help="t('plans.joiningFeeHelp')"
              :error="err('joining_fee')"
            >
              <InputNumber
                v-model="form.joining_fee"
                input-id="plan-fee"
                mode="currency"
                :currency="currency"
                :min="0"
                :max-fraction-digits="3"
                :placeholder="t('plans.noFee')"
                fluid
              />
            </FormField>
          </div>
        </section>

        <!-- Activation (US-06.03) -->
        <section class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-play" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.activation') }}</h2>
              <p>{{ t('plans.sectionHints.activation') }}</p>
            </div>
          </header>
          <div
            class="choices choices--3"
            role="radiogroup"
            :aria-label="t('plans.sections.activation')"
          >
            <button
              v-for="c in activationChoices"
              :key="c.value"
              type="button"
              role="radio"
              :aria-checked="form.activation === c.value"
              :class="['choice', { 'choice--on': form.activation === c.value }]"
              @click="form.activation = c.value as MembershipPlan['activation']"
            >
              <i :class="['pi', c.icon]" aria-hidden="true" />
              <span class="choice__title">{{ c.label }}</span>
              <span class="choice__hint">{{ c.hint }}</span>
            </button>
          </div>
          <div v-if="form.activation === 'first_use'" class="grid2">
            <FormField
              :label="t('plans.maxWait')"
              for="plan-max-wait"
              :help="t('plans.maxWaitHelp')"
              :error="err('activation_max_wait_days')"
            >
              <InputNumber
                v-model="form.activation_max_wait_days"
                input-id="plan-max-wait"
                :min="1"
                :max="365"
                :suffix="` ${t('plans.units.days')}`"
                fluid
              />
            </FormField>
          </div>
          <div class="toggle">
            <ToggleSwitch v-model="form.requires_payment" input-id="plan-requires-payment" />
            <label for="plan-requires-payment"
              >{{ t('plans.requiresPayment') }}
              <small class="toggle__hint">{{ t('plans.requiresPaymentHint') }}</small></label
            >
          </div>
          <Message severity="secondary" :closable="false" icon="pi pi-info-circle" size="small">{{
            t('plans.expiryFromActivation')
          }}</Message>
        </section>

        <!-- Intro offer (US-06.06) -->
        <section class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-gift" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.intro') }}</h2>
              <p>{{ t('plans.sectionHints.intro') }}</p>
            </div>
          </header>
          <div class="choices choices--3" role="radiogroup" :aria-label="t('plans.sections.intro')">
            <button
              v-for="c in introChoices"
              :key="c.key"
              type="button"
              role="radio"
              :aria-checked="form.intro_offer === c.value"
              :class="['choice', { 'choice--on': form.intro_offer === c.value }]"
              @click="form.intro_offer = c.value"
            >
              <i :class="['pi', c.icon]" aria-hidden="true" />
              <span class="choice__title">{{ c.label }}</span>
              <span class="choice__hint">{{ c.hint }}</span>
            </button>
          </div>
          <Message
            v-if="freeTrial"
            severity="info"
            :closable="false"
            icon="pi pi-gift"
            size="small"
            >{{ form.intro_offer ? t('plans.freeTrialNote') : t('plans.freeNoIntroNote') }}</Message
          >
        </section>

        <!-- Freezing (US-06.11) -->
        <section v-if="!isPackage" class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-pause-circle" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.freeze') }}</h2>
              <p>{{ t('plans.sectionHints.freeze') }}</p>
            </div>
          </header>
          <div class="toggle">
            <ToggleSwitch v-model="freezeOn" input-id="plan-freeze" />
            <label for="plan-freeze"
              >{{ t('plans.freezeAllowed') }}
              <small class="toggle__hint">{{ t('plans.freezeAllowedHint') }}</small></label
            >
          </div>
          <div v-if="freezeOn" class="grid2">
            <FormField
              :label="t('plans.freezeMin')"
              for="plan-freeze-min"
              :error="err('freeze_policy.min_days')"
            >
              <InputNumber
                v-model="freeze.min_days"
                input-id="plan-freeze-min"
                :min="1"
                :max="365"
                :suffix="` ${t('plans.units.days')}`"
                :placeholder="t('plans.noLimit')"
                fluid
              />
            </FormField>
            <FormField
              :label="t('plans.freezeMax')"
              for="plan-freeze-max"
              :error="err('freeze_policy.max_days')"
            >
              <InputNumber
                v-model="freeze.max_days"
                input-id="plan-freeze-max"
                :min="1"
                :max="365"
                :suffix="` ${t('plans.units.days')}`"
                :placeholder="t('plans.noLimit')"
                fluid
              />
            </FormField>
            <FormField
              :label="t('plans.freezePerYear')"
              for="plan-freeze-year"
              :help="t('plans.freezePerYearHelp')"
              :error="err('freeze_policy.max_per_year')"
            >
              <InputNumber
                v-model="freeze.max_per_year"
                input-id="plan-freeze-year"
                :min="1"
                :max="12"
                :placeholder="t('plans.noLimit')"
                fluid
              />
            </FormField>
            <FormField
              :label="t('plans.freezeFee')"
              for="plan-freeze-fee"
              :help="t('plans.freezeFeeHelp')"
              :error="err('freeze_policy.fee')"
            >
              <InputNumber
                v-model="freeze.fee"
                input-id="plan-freeze-fee"
                mode="currency"
                :currency="currency"
                :min="0"
                :max-fraction-digits="3"
                :placeholder="t('plans.noFee')"
                fluid
              />
            </FormField>
          </div>
        </section>

        <!-- 4. Prices -->
        <section class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-building" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.prices') }}</h2>
              <p>{{ t('plans.vatNote') }}</p>
            </div>
          </header>
          <div v-if="branches.length > 1" class="same">
            <FormField :label="t('plans.samePrice')" for="plan-same">
              <InputNumber
                v-model="samePrice"
                input-id="plan-same"
                mode="currency"
                :currency="currency"
                :min="0"
                :max-fraction-digits="3"
                fluid
              />
            </FormField>
            <Button
              :label="t('plans.applyAll')"
              icon="pi pi-copy"
              severity="secondary"
              :disabled="samePrice === null"
              @click="applySamePrice"
            />
          </div>
          <Message v-if="err('prices')" severity="error" :closable="false" size="small">{{
            t('plans.priceNeeded')
          }}</Message>
          <table class="prices">
            <thead>
              <tr>
                <th>{{ t('plans.branch') }}</th>
                <th>{{ t('plans.onSale') }}</th>
                <th class="end">{{ t('plans.price') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in branches" :key="b.id" :class="{ off: !priceAt[b.id]!.on }">
                <td>
                  <label :for="`plan-on-${b.id}`" class="branch">
                    <i class="pi pi-map-marker" aria-hidden="true" />{{ b.name }}
                  </label>
                </td>
                <td>
                  <ToggleSwitch v-model="priceAt[b.id]!.on" :input-id="`plan-on-${b.id}`" />
                </td>
                <td class="end">
                  <InputNumber
                    v-model="priceAt[b.id]!.price"
                    mode="currency"
                    :currency="currency"
                    :min="0"
                    :max-fraction-digits="3"
                    :disabled="!priceAt[b.id]!.on"
                    :invalid="priceAt[b.id]!.on && priceAt[b.id]!.price === null && !!err('prices')"
                    :aria-label="t('plans.priceAt', { branch: b.name })"
                    class="price-input"
                    fluid
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 5. Rules -->
        <section class="card section">
          <header class="section__head">
            <span class="section__icon"><i class="pi pi-shield" aria-hidden="true" /></span>
            <div>
              <h2>{{ t('plans.sections.rules') }}</h2>
              <p>{{ t('plans.sectionHints.rules') }}</p>
            </div>
          </header>
          <Message
            v-if="isPackage && dropIn"
            severity="secondary"
            :closable="false"
            icon="pi pi-info-circle"
            size="small"
            >{{ t('plans.dropInCovers') }}</Message
          >
          <div v-else class="field">
            <span id="plan-covers" class="label">{{ t('plans.covers') }}</span>
            <SelectButton
              v-model="form.rules.services.mode"
              :options="options(['all', 'categories', 'services', 'programs'], 'plans.coverModes')"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              aria-labelledby="plan-covers"
            />
            <MultiSelect
              v-if="form.rules.services.mode === 'categories'"
              v-model="form.rules.services.category_ids"
              :options="categories"
              option-label="name"
              option-value="id"
              display="chip"
              filter
              fluid
              :placeholder="t('plans.pickCategories')"
              :invalid="!!err('rules.services.category_ids')"
              :aria-label="t('plans.coverModes.categories')"
            />
            <MultiSelect
              v-if="form.rules.services.mode === 'services'"
              v-model="form.rules.services.service_ids"
              :options="services"
              option-label="name"
              option-value="id"
              display="chip"
              filter
              fluid
              :placeholder="t('plans.pickServices')"
              :invalid="!!err('rules.services.service_ids')"
              :aria-label="t('plans.coverModes.services')"
            />
            <MultiSelect
              v-if="form.rules.services.mode === 'programs'"
              v-model="form.rules.services.program_ids"
              :options="programs"
              option-label="name"
              option-value="id"
              display="chip"
              filter
              fluid
              :placeholder="t('plans.pickPrograms')"
              :invalid="!!err('rules.services.program_ids')"
              :aria-label="t('plans.coverModes.programs')"
            />
            <FormField
              v-if="form.rules.services.mode === 'all' || form.rules.services.mode === 'categories'"
              :label="t('plans.exclude')"
              for="plan-exclude"
              :help="t('plans.excludeHelp')"
            >
              <MultiSelect
                v-model="form.rules.services.exclude_service_ids"
                input-id="plan-exclude"
                :options="services"
                option-label="name"
                option-value="id"
                display="chip"
                filter
                fluid
                :placeholder="t('plans.noExclusions')"
              />
            </FormField>
          </div>
          <div class="field">
            <span id="plan-where" class="label">{{ t('plans.validAt') }}</span>
            <SelectButton
              v-model="form.rules.locations.mode"
              :options="options(['all', 'home', 'selected'], 'plans.locationModes')"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              aria-labelledby="plan-where"
            />
            <MultiSelect
              v-if="form.rules.locations.mode === 'selected'"
              v-model="form.rules.locations.location_ids"
              :options="branches"
              option-label="name"
              option-value="id"
              display="chip"
              fluid
              :placeholder="t('plans.pickBranches')"
              :invalid="!!err('rules.locations.location_ids')"
              :aria-label="t('plans.locationModes.selected')"
            />
            <div v-if="form.rules.locations.mode === 'all'" class="toggle">
              <ToggleSwitch
                v-model="form.rules.locations.include_future"
                input-id="plan-include-future"
              />
              <label for="plan-include-future">{{ t('plans.includeFuture') }}</label>
            </div>
          </div>
          <h3 class="sub">{{ t('plans.usageLimits') }}</h3>
          <div class="grid2">
            <FormField :label="t('plans.perDay')" for="plan-per-day">
              <InputNumber
                v-model="form.rules.limits.per_day"
                input-id="plan-per-day"
                :min="1"
                :max="20"
                :placeholder="t('plans.noLimit')"
                fluid
              />
            </FormField>
            <FormField :label="t('plans.perWeek')" for="plan-per-week">
              <InputNumber
                v-model="form.rules.limits.per_week"
                input-id="plan-per-week"
                :min="1"
                :max="100"
                :placeholder="t('plans.noLimit')"
                fluid
              />
            </FormField>
          </div>
          <div class="toggle">
            <ToggleSwitch v-model="offPeak" input-id="plan-offpeak" />
            <label for="plan-offpeak">{{ t('plans.offPeak') }}</label>
          </div>
          <div v-if="offPeak" class="grid2">
            <FormField :label="t('plans.from')" :error="err('rules.limits.hours.from')">
              <TimeField v-model="hours.from" :invalid="!!err('rules.limits.hours.from')" />
            </FormField>
            <FormField :label="t('plans.to')" :error="err('rules.limits.hours.to')">
              <TimeField v-model="hours.to" :invalid="!!err('rules.limits.hours.to')" />
            </FormField>
          </div>
        </section>
      </div>

      <!-- Live summary -->
      <aside class="side">
        <div class="card preview">
          <span class="eyebrow">{{ t('plans.preview') }}</span>
          <div class="preview__head">
            <h3>{{ previewName }}</h3>
            <StatusTag :status="form.status" size="sm" />
          </div>
          <div class="preview__price num">
            {{ previewPrice ?? t('plans.noPriceYet') }}
            <small v-if="previewPrice && !isPackage && form.billing === 'recurring'">{{
              t(`plans.perInterval.${form.billing_interval ?? 'month'}`)
            }}</small>
          </div>
          <ul class="facts">
            <li><i class="pi pi-ticket" aria-hidden="true" />{{ previewAccess }}</li>
            <li><i class="pi pi-refresh" aria-hidden="true" />{{ previewBilling }}</li>
            <li v-if="!isPackage && form.joining_fee">
              <i class="pi pi-plus-circle" aria-hidden="true" />{{
                t('plans.feeSummary', { fee: format.money(form.joining_fee) })
              }}
            </li>
            <li><i class="pi pi-th-large" aria-hidden="true" />{{ previewCovers }}</li>
            <li><i class="pi pi-map-marker" aria-hidden="true" />{{ previewWhere }}</li>
            <li><i class="pi pi-play" aria-hidden="true" />{{ previewActivation }}</li>
            <li v-if="form.intro_offer">
              <i class="pi pi-gift" aria-hidden="true" />{{
                freeTrial ? t('plans.freeTrial') : t(`plans.intros.${form.intro_offer}`)
              }}
            </li>
            <li v-if="!isPackage && freezeOn">
              <i class="pi pi-pause-circle" aria-hidden="true" />{{ freezeSummary(freeze) }}
            </li>
            <li v-if="offPeak">
              <i class="pi pi-clock" aria-hidden="true" />{{ t('plans.hoursSummary', hours) }}
            </li>
          </ul>
          <div v-if="pricedBranches.length" class="preview__branches">
            <div v-for="b in pricedBranches" :key="b.name" class="preview__branch">
              <span>{{ b.name }}</span>
              <span class="num">{{ format.money(b.price) }}</span>
            </div>
          </div>
        </div>
        <div class="card checklist">
          <span class="eyebrow">{{ t('plans.readyToSell') }}</span>
          <ul>
            <li v-for="c in checklist" :key="c.label" :class="{ done: c.done }">
              <i :class="['pi', c.done ? 'pi-check-circle' : 'pi-circle']" aria-hidden="true" />
              {{ c.label }}
            </li>
          </ul>
        </div>
      </aside>
    </form>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.section {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.section__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}
.section__head h2 {
  margin: 0;
  font: var(--text-h4);
}
.section__head p {
  margin: 2px 0 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.section__icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--primary-50);
  color: var(--primary-700);
}
.sub {
  margin: 4px 0 0;
  font: 600 14px var(--font-sans);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font: var(--text-small);
  font-weight: 500;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.choices--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  text-align: start;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-primary);
  font: inherit;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.choice:hover {
  border-color: var(--border-strong);
}
.choice:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.choice--on {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 1px var(--primary-500);
  background: var(--primary-50);
}
.choice .pi {
  color: var(--primary-600);
  font-size: 18px;
  margin-bottom: 4px;
}
.choice__title {
  font: 600 14px var(--font-sans);
}
.choice__hint {
  font: var(--text-caption);
  color: var(--text-muted);
}
.same {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 12px 16px;
  background: var(--surface-sunken);
  border-radius: 8px;
}
.same > :first-child {
  flex: 1;
  max-width: 260px;
}
.prices {
  width: 100%;
  border-collapse: collapse;
}
.prices th {
  text-align: start;
  font: var(--text-caption);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-default);
}
.prices td {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.prices tr:last-child td {
  border-bottom: 0;
}
.prices .end {
  text-align: end;
}
.prices tr.off .branch {
  color: var(--text-muted);
}
.branch {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font: 500 14px var(--font-sans);
}
.branch .pi {
  color: var(--text-muted);
}
.price-input {
  width: 180px;
  display: inline-flex;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toggle__hint {
  display: block;
  font: var(--text-small);
  color: var(--text-muted);
}
.side {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.eyebrow {
  font: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.preview {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.preview__head h3 {
  margin: 0;
  font: var(--text-h4);
  word-break: break-word;
}
.preview__price {
  font: 600 22px var(--font-sans);
}
.preview__price small {
  font: var(--text-small);
  color: var(--text-muted);
}
.facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.facts .pi {
  margin-inline-end: 8px;
  color: var(--text-muted);
}
.preview__branches {
  border-top: 1px solid var(--border-subtle);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: var(--text-small);
}
.preview__branch {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.checklist {
  padding: 16px 18px;
}
.checklist ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.checklist .pi {
  margin-inline-end: 8px;
  color: var(--text-muted);
}
.checklist li.done .pi {
  color: var(--sev-success-fg);
}
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
    order: -1;
  }
  .checklist {
    display: none;
  }
}
@media (max-width: 640px) {
  .section {
    padding: 16px;
  }
  .grid2,
  .choices,
  .choices--3 {
    grid-template-columns: minmax(0, 1fr);
  }
  .price-input {
    width: 130px;
  }
}
</style>
