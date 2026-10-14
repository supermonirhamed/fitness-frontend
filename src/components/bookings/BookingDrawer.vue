<script setup lang="ts">
// New booking (US-04.02), as the design's BookingDrawer (ui_kits/admin/BookingDrawer.jsx): find the
// client by name, mobile, email or member ID (or create one inline), see the eligibility checks
// (US-04.01) and the payment source that will be used, then confirm. Permitted staff can override
// capacity, the booking window or payment with a reason. "Guest of a member" (US-04.07) books a
// member's guest instead: the member, the guest's name and contact, and a guest pass or drop-in.
// For a session in a series, "Book every session of this series" (US-04.08) makes a recurring
// booking and shows what was booked and skipped.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import EligibilityChecklist from '@/components/bookings/EligibilityChecklist.vue'
import NewClientDrawer from '@/components/clients/NewClientDrawer.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import WhyNotMessage from '@/components/patterns/WhyNotMessage.vue'
import {
  tenantApi,
  type Booking,
  type BookingEligibility,
  type CalendarSession,
  type Client,
  type EntitlementOption,
  type EntitlementSource,
  type GuestOptions,
  type OverridableCheck,
  type RecurringBooking,
  type WaitlistEntry,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ session: CalendarSession | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  booked: [booking: Booking]
  recurring: [recurring: RecurringBooking]
  waitlisted: [entry: WaitlistEntry]
}>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const mode = ref<'client' | 'guest'>('client')
const blankGuest = () => ({
  first_name: '',
  last_name: '',
  mobile: '',
  email: '',
  gender: null as 'female' | 'male' | null,
  dob: null as Date | null,
})
const guest = ref(blankGuest())
// The service's restrictions: the guest form asks for what they need (gender, date of birth).
const restrictions = ref<GuestOptions['restrictions'] | null>(null)
const needsGender = computed(
  () => !!restrictions.value?.gender && restrictions.value.gender !== 'Any',
)
const needsDob = computed(
  () => restrictions.value?.age_min != null || restrictions.value?.age_max != null,
)
const genderOptions = computed(() => [
  { value: 'female', label: t('clients.gender.female') },
  { value: 'male', label: t('clients.gender.male') },
])
const maxDob = new Date()
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null
const guestSources = ref<EntitlementSource[]>([])
const errors = ref<Record<string, string[]>>({})
// Recurring booking (US-04.08)
const repeat = ref(false)
const repeatFrom = ref<Date | null>(null)
const untilMode = ref<'entitlement' | 'date'>('entitlement')
const repeatUntil = ref<Date | null>(null)
const recurring = ref<RecurringBooking | null>(null)
const canRepeat = computed(() => mode.value === 'client' && !!props.session?.series_id)
const untilOptions = computed(() => [
  { value: 'entitlement', label: t('recurring.untilEntitlement') },
  { value: 'date', label: t('recurring.untilDate') },
])
const today = new Date()
// Starts from the picked session's date unless another one was chosen.
watch(repeat, (on) => {
  if (on && !repeatFrom.value && props.session)
    repeatFrom.value = new Date(`${props.session.local.date}T00:00:00`)
})
const query = ref<string | Client>('')
const suggestions = ref<Client[]>([])
const client = ref<Client | null>(null)
const newClientOpen = ref(false)

const result = ref<BookingEligibility | null>(null)
const checking = ref(false)
const override = ref<OverridableCheck[]>([])
const overrideReason = ref<string | null>(null)
const overrideOpen = ref(false)
const format = useFormat()
const payment = ref<EntitlementSource | null>(null)
// Which membership or package pays (US-06.16): the first in the organization's order unless staff
// pick another.
const entitlementId = ref<number | null>(null)
const payWith = computed(() =>
  (result.value?.entitlement_options ?? []).filter((o) => o.source === payment.value),
)
watch(payWith, (options) => {
  if (!options.some((o) => o.id === entitlementId.value))
    entitlementId.value = options[0]?.id ?? null
})
const optionDetail = (o: EntitlementOption) =>
  [
    o.credits_left !== null ? t('booking.payWith.credits', { n: o.credits_left }) : null,
    o.visits_left !== null ? t('booking.payWith.visits', { n: o.visits_left }) : null,
    o.type === 'unlimited' ? t('plans.types.Unlimited') : null,
    o.ends_on ? t('booking.payWith.until', { date: format.date(o.ends_on) }) : null,
    o.shared_by ? t('sharing.sharedBy', { name: o.shared_by }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  mode.value = 'client'
  repeat.value = false
  recurring.value = null
  untilMode.value = 'entitlement'
  repeatUntil.value = null
  repeatFrom.value = null
  change()
})
watch(mode, change)
// A refusal was about the guest as entered: editing them clears it.
watch(
  guest,
  () => {
    if (mode.value === 'guest') result.value = null
  },
  { deep: true },
)

function reset() {
  result.value = null
  override.value = []
  overrideReason.value = null
  payment.value = null
  error.value = null
  errors.value = {}
  guestSources.value = []
  restrictions.value = null
}

async function search(event: AutoCompleteCompleteEvent) {
  try {
    suggestions.value = (await tenantApi.clients.list({ q: event.query, per_page: 8 })).data
  } catch {
    suggestions.value = []
  }
}

function choose(picked: Client) {
  client.value = picked
  forWho.value = null
  children.value = []
  reset()
  if (mode.value === 'guest') loadGuestSources()
  else {
    check()
    loadChildren(picked)
  }
}

// Booking for a child (US-05.09): the child attends, the client (their guardian) pays.
const forWho = ref<number | null>(null)
const children = ref<{ id: number; name: string; first_name: string }[]>([])
async function loadChildren(guardian: Client) {
  const family = await tenantApi.clients.family(guardian.id).catch(() => null)
  if (client.value?.id !== guardian.id) return
  children.value = (family?.dependents ?? [])
    .filter((d) => d.can_book && d.client)
    .map((d) => ({
      id: d.client!.id,
      name: d.client!.name,
      first_name: d.client!.name.split(' ')[0]!,
    }))
}
const attendeeId = computed(() => forWho.value ?? client.value?.id ?? 0)
const child = computed(() => children.value.find((c) => c.id === forWho.value) ?? null)
const forWhoOptions = computed(() => [
  { value: null, label: client.value?.name ?? '' },
  ...children.value.map((c) => ({
    value: c.id,
    label: t('booking.childOption', { name: c.name }),
  })),
])
watch(forWho, () => {
  reset()
  check()
})

function change() {
  client.value = null
  query.value = ''
  guest.value = blankGuest()
  reset()
}

async function loadGuestSources() {
  if (!props.session || !client.value) return
  try {
    const options = await tenantApi.bookings.guestOptions(props.session.id, client.value.id)
    guestSources.value = options.entitlements
    restrictions.value = options.restrictions
    payment.value = guestSources.value[0] ?? null
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  }
}
const guestReady = computed(
  () =>
    !!guest.value.first_name.trim() &&
    !!guest.value.last_name.trim() &&
    !!(guest.value.mobile.trim() || guest.value.email.trim()) &&
    (!needsGender.value || !!guest.value.gender) &&
    (!needsDob.value || !!guest.value.dob),
)

function onClientCreated(created: Client) {
  choose(created)
}

async function check() {
  if (!props.session || !client.value) return
  checking.value = true
  error.value = null
  try {
    result.value = await tenantApi.bookings.eligibility(props.session.id, {
      client_id: attendeeId.value,
      override: override.value,
      override_reason: overrideReason.value,
    })
    if (!payment.value || !result.value.entitlements.includes(payment.value))
      payment.value = result.value.entitlements[0] ?? null
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    checking.value = false
  }
}

// The first reason in the way, and whether staff may override everything that blocks.
const blocking = computed(() => result.value?.reasons[0] ?? null)
const full = computed(() => blocking.value?.code === 'session_full')
const canOverride = computed(
  () =>
    !!result.value &&
    !result.value.ok &&
    auth.can('bookings.override') &&
    result.value.reasons.every((r) => r.overridable),
)

function applyOverride(reason: string) {
  if (!result.value) return
  override.value = [
    ...new Set([
      ...override.value,
      ...result.value.reasons.map((r) => r.check as OverridableCheck),
    ]),
  ]
  overrideReason.value = reason
  overrideOpen.value = false
  // A guest is checked again when booking; a client right away.
  if (mode.value === 'guest') result.value = null
  else check()
}

async function confirmRecurring() {
  if (!props.session?.series_id || !client.value || !payment.value || !repeatFrom.value) return
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    recurring.value = await tenantApi.bookings.createRecurring({
      client_id: attendeeId.value,
      series_id: props.session.series_id,
      starts_on: ymd(repeatFrom.value)!,
      ends_on: untilMode.value === 'date' ? ymd(repeatUntil.value) : null,
      until_entitlement_ends: untilMode.value === 'entitlement',
      entitlement_source: payment.value,
    })
    emit('recurring', recurring.value)
  } catch (e) {
    errors.value = validationErrors(e)
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}

// Full, and the waitlist takes them: "Add to waitlist" is the main action (US-04.10).
const waitlisting = computed(
  () =>
    mode.value === 'client' &&
    !repeat.value &&
    !!result.value &&
    !result.value.ok &&
    result.value.can_waitlist,
)
async function joinWaitlist() {
  if (!props.session || !client.value || !payment.value) return
  saving.value = true
  error.value = null
  try {
    const entry = await tenantApi.bookings.joinWaitlist(props.session.id, {
      client_id: attendeeId.value,
      entitlement_source: payment.value,
    })
    emit('waitlisted', entry)
    visible.value = false
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}

const confirmDisabled = computed(() => {
  if (waitlisting.value) return !payment.value || checking.value
  if (mode.value === 'guest')
    return (
      !client.value || !guestReady.value || !payment.value || (!!result.value && !result.value.ok)
    )
  if (
    repeat.value &&
    canRepeat.value &&
    (!repeatFrom.value || (untilMode.value === 'date' && !repeatUntil.value))
  )
    return true
  return !result.value?.ok || !payment.value || checking.value
})

// What the server offers (US-04.03), best first: the client's covering membership or package
// (EP-06), then the staff options, which always show.
const STAFF_PAYMENTS: EntitlementSource[] = ['complimentary', 'pay_at_desk']
const paymentOptions = computed(() => {
  if (mode.value === 'guest')
    return (['guest_pass', 'drop_in'] as EntitlementSource[]).map((value) => ({
      value,
      label: t(`booking.payments.${value}`),
      disabled: !guestSources.value.includes(value),
    }))
  const offered = result.value?.entitlements ?? []
  const shown = [...new Set<EntitlementSource>([...offered, ...STAFF_PAYMENTS])]
  const options = shown.map((value) => ({
    value,
    label: t(`booking.payments.${value}`),
    disabled: !offered.includes(value),
  }))
  return options
})

async function confirm() {
  if (!props.session || !client.value || !payment.value) return
  if (waitlisting.value) return joinWaitlist()
  if (repeat.value && canRepeat.value) return confirmRecurring()
  saving.value = true
  error.value = null
  errors.value = {}
  try {
    const booking =
      mode.value === 'guest'
        ? await tenantApi.bookings.createGuest({
            session_id: props.session.id,
            host_client_id: client.value.id,
            guest: {
              first_name: guest.value.first_name,
              last_name: guest.value.last_name,
              mobile: guest.value.mobile.trim() || null,
              email: guest.value.email.trim() || null,
              gender: guest.value.gender,
              date_of_birth: ymd(guest.value.dob),
            },
            entitlement_source: payment.value,
            override: override.value,
            override_reason: overrideReason.value,
          })
        : await tenantApi.bookings.create({
            session_id: props.session.id,
            client_id: attendeeId.value,
            payer_client_id: forWho.value ? client.value.id : null,
            entitlement_source: payment.value,
            entitlement_id: payWith.value.length > 1 ? entitlementId.value : null,
            override: override.value,
            override_reason: overrideReason.value,
          })
    emit('booked', booking)
    visible.value = false
  } catch (e) {
    // Something changed meanwhile (e.g. the last place went): show the fresh checks.
    if (errorCode(e) === 'not_eligible' && e instanceof AxiosError)
      result.value = e.response?.data?.eligibility ?? result.value
    errors.value = validationErrors(e)
    error.value =
      apiMessage(e) ??
      (Object.keys(errors.value).length ? t('booking.guestContact') : t('common.genericError'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :block-scroll="true"
    class="booking-drawer"
  >
    <template #header>
      <div>
        <div class="head__title">{{ t('booking.title') }}</div>
        <div v-if="session" class="head__sub">
          {{ session.service.name }} · {{ session.location.name }} ·
          <span dir="ltr">{{ session.local.date }} {{ session.local.start }}</span>
        </div>
      </div>
    </template>

    <div v-if="recurring" class="body">
      <Message severity="success" :closable="false" icon="pi pi-check-circle">{{
        t('recurring.summaryTitle')
      }}</Message>
      <div class="summary">
        <strong>{{ t('recurring.booked', { n: recurring.summary.booked.length }) }}</strong>
        <span v-if="recurring.summary.waitlisted.length">{{
          t('recurring.waitlisted', { n: recurring.summary.waitlisted.length })
        }}</span>
        <template v-if="recurring.summary.skipped.length">
          <strong>{{ t('recurring.skipped', { n: recurring.summary.skipped.length }) }}</strong>
          <ul class="summary__skipped">
            <li v-for="s in recurring.summary.skipped" :key="s.session_id">
              <span dir="ltr" class="num">{{ s.date }} {{ s.start }}</span> ·
              {{ s.reasons?.[0]?.message }}
            </li>
          </ul>
        </template>
      </div>
    </div>
    <div v-else class="body">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <SelectButton
        v-model="mode"
        :options="[
          { value: 'client', label: t('booking.modes.client') },
          { value: 'guest', label: t('booking.modes.guest') },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="t('booking.title')"
      />

      <div class="field">
        <label for="booking-client" class="field__label"
          >{{ mode === 'guest' ? t('booking.member') : t('booking.client') }}
          <span aria-hidden="true">*</span></label
        >
        <div v-if="client" class="picked">
          <PersonAvatar :name="client.name" :image="client.photo_url" />
          <span class="picked__text">
            <span class="picked__name">{{ client.name }}</span>
            <span class="picked__sub">{{ client.member_id }}</span>
          </span>
          <Button
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
          input-id="booking-client"
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
              <Tag
                v-if="option.status === 'Blocked'"
                severity="danger"
                class="tag-sm"
                icon="pi pi-ban"
                :value="t('booking.blocked')"
              />
            </div>
          </template>
          <template #empty>{{ t('booking.noResults') }}</template>
          <template v-if="mode === 'client' && auth.can('clients.create')" #footer>
            <div class="option-footer">
              <Button
                size="small"
                variant="text"
                icon="pi pi-user-plus"
                :label="t('booking.newClient')"
                @click="newClientOpen = true"
              />
            </div>
          </template>
        </AutoComplete>
      </div>

      <fieldset v-if="mode === 'guest' && client" class="guest">
        <legend class="field__label">{{ t('booking.guest') }}</legend>
        <div class="guest__row">
          <div class="field">
            <label for="guest-first" class="field__label">{{ t('booking.guestFirst') }} *</label>
            <InputText
              id="guest-first"
              v-model="guest.first_name"
              maxlength="60"
              :invalid="!!errors['guest.first_name']"
            />
          </div>
          <div class="field">
            <label for="guest-last" class="field__label">{{ t('booking.guestLast') }} *</label>
            <InputText
              id="guest-last"
              v-model="guest.last_name"
              maxlength="60"
              :invalid="!!errors['guest.last_name']"
            />
          </div>
        </div>
        <div class="guest__row">
          <div class="field">
            <label for="guest-mobile" class="field__label">{{ t('booking.guestMobile') }}</label>
            <InputText
              id="guest-mobile"
              v-model="guest.mobile"
              dir="ltr"
              inputmode="tel"
              :invalid="!!errors['guest.mobile']"
            />
          </div>
          <div class="field">
            <label for="guest-email" class="field__label">{{ t('booking.guestEmail') }}</label>
            <InputText
              id="guest-email"
              v-model="guest.email"
              dir="ltr"
              type="email"
              :invalid="!!errors['guest.email']"
            />
          </div>
        </div>
        <div class="guest__row">
          <div class="field">
            <span id="guest-gender" class="field__label"
              >{{ t('clients.genderLabel') }}<template v-if="needsGender"> *</template></span
            >
            <SelectButton
              v-model="guest.gender"
              :options="genderOptions"
              option-label="label"
              option-value="value"
              :invalid="!!errors['guest.gender']"
              aria-labelledby="guest-gender"
            />
          </div>
          <div v-if="needsDob" class="field">
            <label for="guest-dob" class="field__label">{{ t('clients.dob') }} *</label>
            <DatePicker
              v-model="guest.dob"
              input-id="guest-dob"
              date-format="yy-mm-dd"
              :max-date="maxDob"
              :placeholder="t('clients.pickDate')"
              :invalid="!!errors['guest.date_of_birth']"
              show-icon
              icon-display="input"
              fluid
            />
          </div>
        </div>
        <small v-if="needsGender || needsDob" class="field__hint">{{
          t('booking.guestRestricted')
        }}</small>
        <small class="field__hint">{{ t('booking.guestChecked') }}</small>
      </fieldset>

      <div v-if="mode === 'client' && client && children.length" class="field">
        <span id="booking-for" class="field__label">{{ t('booking.for') }}</span>
        <SelectButton
          v-model="forWho"
          :options="forWhoOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="booking-for"
        />
        <Message v-if="child" severity="info" :closable="false" icon="pi pi-users">{{
          t('booking.childPays', { child: child.first_name, payer: client.first_name })
        }}</Message>
      </div>

      <div v-if="checking && !result" class="stack" aria-busy="true">
        <Skeleton height="200px" />
      </div>
      <template v-else-if="client && result">
        <EligibilityChecklist :result="result" />

        <WhyNotMessage
          v-if="blocking"
          :reason="blocking.message"
          :detail="
            canOverride
              ? t('booking.overrideHint')
              : result.reasons.every((r) => r.overridable)
                ? t('booking.askOverride')
                : null
          "
          :severity="full ? 'warn' : 'error'"
        >
          <template v-if="waitlisting">{{
            t('booking.waitlistPlace', {
              name: client.first_name,
              n: (session?.waitlist ?? 0) + 1,
            })
          }}</template>
          <Button
            v-if="canOverride"
            size="small"
            severity="secondary"
            variant="outlined"
            :label="full ? t('booking.overrideCapacity') : t('booking.override')"
            @click="overrideOpen = true"
          />
        </WhyNotMessage>
        <Message
          v-else-if="override.length"
          severity="warn"
          :closable="false"
          icon="pi pi-exclamation-circle"
        >
          {{ t('booking.overriding', { reason: overrideReason }) }}
        </Message>

        <div v-if="(result.ok || waitlisting) && mode === 'client'" class="field">
          <span id="booking-payment" class="field__label">{{ t('booking.payment') }}</span>
          <SelectButton
            v-model="payment"
            :options="paymentOptions"
            option-label="label"
            option-value="value"
            option-disabled="disabled"
            :allow-empty="false"
            aria-labelledby="booking-payment"
          />
          <small v-if="payment" class="field__hint">{{
            t(`booking.paymentHints.${payment}`)
          }}</small>
          <div
            v-if="payWith.length > 1 && mode === 'client'"
            class="pay-with"
            role="radiogroup"
            :aria-label="t('booking.payWith.label')"
          >
            <span class="field__label">{{ t('booking.payWith.label') }}</span>
            <label
              v-for="o in payWith"
              :key="o.id"
              :class="['pay-with__option', { 'pay-with__option--on': entitlementId === o.id }]"
            >
              <RadioButton v-model="entitlementId" :value="o.id" :name="'pay-with'" />
              <span class="pay-with__text">
                <strong>{{ o.name }}</strong>
                <small>{{ optionDetail(o) }}</small>
              </span>
            </label>
          </div>
          <Message
            v-if="result.entitlement_note"
            severity="warn"
            size="small"
            :closable="false"
            icon="pi pi-id-card"
            >{{ result.entitlement_note.message }}</Message
          >
        </div>

        <div v-if="result.ok && canRepeat" class="repeat">
          <div class="repeat__toggle">
            <ToggleSwitch v-model="repeat" input-id="booking-repeat" />
            <label for="booking-repeat">{{ t('recurring.repeat') }}</label>
          </div>
          <template v-if="repeat">
            <small class="field__hint">{{ t('recurring.repeatHint') }}</small>
            <div class="guest__row">
              <div class="field">
                <label for="repeat-from" class="field__label">{{ t('recurring.from') }}</label>
                <DatePicker
                  v-model="repeatFrom"
                  input-id="repeat-from"
                  date-format="yy-mm-dd"
                  :min-date="today"
                  :invalid="!!errors.starts_on"
                  show-icon
                  icon-display="input"
                  fluid
                />
              </div>
              <div class="field">
                <span id="repeat-until" class="field__label">{{ t('recurring.until') }}</span>
                <SelectButton
                  v-model="untilMode"
                  :options="untilOptions"
                  option-label="label"
                  option-value="value"
                  :allow-empty="false"
                  aria-labelledby="repeat-until"
                />
                <DatePicker
                  v-if="untilMode === 'date'"
                  v-model="repeatUntil"
                  input-id="repeat-until-date"
                  date-format="yy-mm-dd"
                  :min-date="repeatFrom ?? today"
                  :invalid="!!errors.ends_on"
                  :aria-label="t('recurring.untilDate')"
                  show-icon
                  icon-display="input"
                  fluid
                />
              </div>
            </div>
          </template>
        </div>
      </template>
      <template v-if="mode === 'guest' && client">
        <Message
          v-if="override.length && !result"
          severity="warn"
          :closable="false"
          icon="pi pi-exclamation-circle"
        >
          {{ t('booking.overriding', { reason: overrideReason }) }}
        </Message>
        <div class="field">
          <span id="booking-guest-payment" class="field__label">{{ t('booking.payment') }}</span>
          <SelectButton
            v-model="payment"
            :options="paymentOptions"
            option-label="label"
            option-value="value"
            option-disabled="disabled"
            :allow-empty="false"
            aria-labelledby="booking-guest-payment"
          />
          <small v-if="payment" class="field__hint">{{
            t(`booking.paymentHints.${payment}`)
          }}</small>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="footer">
        <span class="footer__spacer" />
        <Button v-if="recurring" :label="t('recurring.done')" @click="visible = false" />
        <template v-else>
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            variant="text"
            @click="visible = false"
          />
          <Button
            :label="
              waitlisting
                ? t('booking.addToWaitlist')
                : repeat && canRepeat
                  ? t('recurring.confirm')
                  : t('booking.confirm')
            "
            :loading="saving"
            :disabled="confirmDisabled"
            @click="confirm"
          />
        </template>
      </div>
    </template>
  </Drawer>

  <NewClientDrawer v-model:visible="newClientOpen" @saved="onClientCreated" />
  <OverrideDialog
    v-model:visible="overrideOpen"
    :title="full ? t('booking.overrideCapacity') : t('booking.override')"
    :description="blocking?.message"
    :confirm-label="t('booking.override')"
    @confirm="applyOverride"
  />
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.body,
.stack {
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
.field__hint {
  font: var(--text-small);
  color: var(--text-secondary);
}
.repeat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-sunken);
}
.repeat__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}
.summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary__skipped {
  margin: 0;
  padding-inline-start: 18px;
  color: var(--text-secondary);
}
.guest {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.guest__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
.option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.option-footer {
  border-top: 1px solid var(--border-subtle);
  padding: 4px;
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
.pay-with {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.pay-with__option {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  cursor: pointer;
}
.pay-with__option--on {
  border-color: var(--primary-500, var(--p-primary-color));
  background: var(--primary-50);
}
.pay-with__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pay-with__text small {
  font: var(--text-small);
  color: var(--text-muted);
}
</style>
