<script setup lang="ts">
// New booking (US-04.02), as the design's BookingDrawer (ui_kits/admin/BookingDrawer.jsx): find the
// client by name, mobile, email or member ID (or create one inline), see the eligibility checks
// (US-04.01) and the payment source that will be used, then confirm. Permitted staff can override
// capacity, the booking window or payment with a reason.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
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
  type EntitlementSource,
  type OverridableCheck,
} from '@/api/tenant'
import { apiMessage, errorCode } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ session: CalendarSession | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ booked: [booking: Booking] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))

const query = ref<string | Client>('')
const suggestions = ref<Client[]>([])
const client = ref<Client | null>(null)
const newClientOpen = ref(false)

const result = ref<BookingEligibility | null>(null)
const checking = ref(false)
const override = ref<OverridableCheck[]>([])
const overrideReason = ref<string | null>(null)
const overrideOpen = ref(false)
const payment = ref<EntitlementSource | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  query.value = ''
  client.value = null
  reset()
})

function reset() {
  result.value = null
  override.value = []
  overrideReason.value = null
  payment.value = null
  error.value = null
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
  reset()
  check()
}

function change() {
  client.value = null
  query.value = ''
  reset()
}

function onClientCreated(created: Client) {
  choose(created)
}

async function check() {
  if (!props.session || !client.value) return
  checking.value = true
  error.value = null
  try {
    result.value = await tenantApi.bookings.eligibility(props.session.id, {
      client_id: client.value.id,
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
  check()
}

// What the server offers (US-04.03), best first; the staff options always show, and memberships
// are marked as coming until EP-06 resolves them.
const STAFF_PAYMENTS: EntitlementSource[] = ['complimentary', 'pay_at_desk']
const paymentOptions = computed(() => {
  const offered = result.value?.entitlements ?? []
  const shown = [...new Set<EntitlementSource>([...offered, ...STAFF_PAYMENTS])]
  const options = shown.map((value) => ({
    value,
    label: t(`booking.payments.${value}`),
    disabled: !offered.includes(value),
  }))
  if (!shown.includes('membership'))
    options.push({
      value: 'membership',
      label: `${t('booking.payments.membership')} · ${t('booking.soon')}`,
      disabled: true,
    })
  return options
})

async function confirm() {
  if (!props.session || !client.value || !payment.value) return
  saving.value = true
  error.value = null
  try {
    const booking = await tenantApi.bookings.create({
      session_id: props.session.id,
      client_id: client.value.id,
      entitlement_source: payment.value,
      override: override.value,
      override_reason: overrideReason.value,
    })
    emit('booked', booking)
    visible.value = false
  } catch (e) {
    // Something changed meanwhile (e.g. the last place went): show the fresh checks.
    if (errorCode(e) === 'not_eligible' && e instanceof AxiosError)
      result.value = e.response?.data?.eligibility ?? result.value
    error.value = apiMessage(e) ?? t('common.genericError')
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

    <div class="body">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

      <div class="field">
        <label for="booking-client" class="field__label"
          >{{ t('booking.client') }} <span aria-hidden="true">*</span></label
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
          <template v-if="auth.can('clients.create')" #footer>
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

        <div v-if="result.ok" class="field">
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
        </div>
      </template>
    </div>

    <template #footer>
      <div class="footer">
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          :label="t('booking.confirm')"
          :loading="saving"
          :disabled="!result?.ok || !payment || checking"
          @click="confirm"
        />
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
</style>
