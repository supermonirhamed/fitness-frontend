<script setup lang="ts">
// Enroll a player at the desk (US-10.08): an existing client, or a new child with an existing or
// new guardian created in the same flow. The group's rules are checked as they would be for a
// parent (US-10.07): what stands in the way is listed, and staff with the right permission can
// override capacity, enrollment-closed, waivers or age with a reason. The fee quote (US-10.10)
// shows what will be invoiced; the invoices stay open for the desk to take payment.
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ClientPicker from '@/components/academy/ClientPicker.vue'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type AcademyEligibility,
  type AcademyEnrollReason,
  type AcademyEnrollResult,
  type AcademyGroup,
} from '@/api/tenant'
import { fromYmd, showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{
  group: AcademyGroup
  /** From the waiting list: the child and their entry. */
  fromWaitlist?: { entryId: number; client: { id: number; name: string } } | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [result: AcademyEnrollResult]; waitlist: [] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()

const mode = ref<'existing' | 'new'>('existing')
const modeOptions = computed(() => [
  { value: 'existing', label: t('academy.enroll.existing') },
  ...(auth.can('clients.create') ? [{ value: 'new', label: t('academy.enroll.newChild') }] : []),
])
const client = ref<{ id: number; name: string } | null>(null)
const child = reactive({
  first_name: '',
  last_name: '',
  date_of_birth: null as Date | null,
  gender: null as string | null,
})
const guardianMode = ref<'existing' | 'new'>('existing')
const guardianPick = ref<{ id: number; name: string } | null>(null)
const guardian = reactive({ first_name: '', last_name: '', mobile: '', email: '' })
const relation = ref('mother')
const payerId = ref<number | null>(null)
const startsOn = ref<Date | null>(null)
const override = ref<string[]>([])
const overrideReason = ref('')

const eligibility = ref<AcademyEligibility | null>(null)
const reasons = ref<AcademyEnrollReason[]>([])
const checking = ref(false)
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const err = (field: string) => errors.value[field]?.[0]

const genderOptions = computed(() => [
  { value: 'female', label: t('clients.gender.female') },
  { value: 'male', label: t('clients.gender.male') },
])
const relationOptions = computed(() =>
  ['mother', 'father', 'guardian', 'other'].map((r) => ({
    value: r,
    label: t(`family.relations.${r}`),
  })),
)
const guardianOptions = computed(() => [
  { value: 'existing', label: t('academy.enroll.existingGuardian') },
  { value: 'new', label: t('academy.enroll.newGuardian') },
])
const payers = computed(() => (eligibility.value?.payers ?? []).filter((p) => p.can_pay))
const canOverride = (r: AcademyEnrollReason) =>
  r.overridable &&
  (eligibility.value?.can_override?.[r.check as 'capacity'] ?? auth.can(r.permission ?? ''))
const blocking = computed(() => reasons.value.filter((r) => !override.value.includes(r.check)))
const full = computed(() => reasons.value.some((r) => r.check === 'capacity'))
const ready = computed(() =>
  mode.value === 'existing'
    ? !!client.value && !!eligibility.value
    : !!child.first_name.trim() &&
      !!child.last_name.trim() &&
      (guardianMode.value === 'existing'
        ? !!guardianPick.value
        : !!guardian.first_name.trim() &&
          !!guardian.last_name.trim() &&
          !!(guardian.mobile || guardian.email)),
)

watch(visible, (open) => {
  if (!open) return
  mode.value = 'existing'
  client.value = props.fromWaitlist?.client ?? null
  Object.assign(child, { first_name: '', last_name: '', date_of_birth: null, gender: null })
  guardianMode.value = 'existing'
  guardianPick.value = null
  Object.assign(guardian, { first_name: '', last_name: '', mobile: '', email: '' })
  relation.value = 'mother'
  payerId.value = null
  startsOn.value = null
  eligibility.value = null
  reasons.value = []
  override.value = []
  overrideReason.value = ''
  errors.value = {}
  formError.value = null
  if (client.value) check()
})
watch(client, (c, before) => {
  if (c?.id !== before?.id) {
    eligibility.value = null
    reasons.value = []
    override.value = []
    if (c) check()
  }
})
watch(mode, () => {
  reasons.value = []
  override.value = []
  formError.value = null
})

async function check() {
  if (!client.value) return
  checking.value = true
  try {
    eligibility.value = await tenantApi.academy.groups.eligibility(props.group.id, {
      client_id: client.value.id,
      starts_on: startsOn.value ? isoDay(startsOn.value) : null,
      waitlist_entry_id: props.fromWaitlist?.entryId ?? null,
    })
    reasons.value = eligibility.value.reasons
    startsOn.value ??= fromYmd(eligibility.value.starts_on)
    payerId.value ??= payers.value[0]?.id ?? null
  } catch (e) {
    formError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    checking.value = false
  }
}

function toggle(check: string, on: boolean) {
  override.value = on ? [...override.value, check] : override.value.filter((c) => c !== check)
}

async function save() {
  saving.value = true
  errors.value = {}
  formError.value = null
  try {
    const result = await tenantApi.academy.groups.enroll(props.group.id, {
      ...(mode.value === 'existing'
        ? { client_id: client.value?.id }
        : {
            child: {
              first_name: child.first_name.trim(),
              last_name: child.last_name.trim(),
              date_of_birth: child.date_of_birth ? isoDay(child.date_of_birth) : null,
              gender: child.gender,
            },
            ...(guardianMode.value === 'existing'
              ? { guardian_id: guardianPick.value?.id }
              : {
                  guardian: {
                    first_name: guardian.first_name.trim(),
                    last_name: guardian.last_name.trim(),
                    mobile: guardian.mobile.trim() || null,
                    email: guardian.email.trim() || null,
                  },
                }),
            relation: relation.value,
          }),
      payer_client_id: mode.value === 'existing' ? payerId.value : null,
      starts_on: startsOn.value ? isoDay(startsOn.value) : null,
      override: override.value,
      override_reason: overrideReason.value.trim() || null,
      waitlist_entry_id: props.fromWaitlist?.entryId ?? null,
    })
    emit('saved', result)
    visible.value = false
  } catch (e) {
    const data = e instanceof AxiosError ? e.response?.data : null
    if (e instanceof AxiosError && e.response?.status === 409 && Array.isArray(data?.reasons)) {
      reasons.value = data.reasons
      formError.value = null
    } else {
      errors.value = validationErrors(e)
      formError.value = Object.keys(errors.value).length
        ? (Object.values(errors.value)[0]?.[0] ?? t('locationForm.checkFields'))
        : (apiMessage(e) ?? t('common.genericError'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="t('academy.enroll.title')"
    :subtitle="group.display_name ?? undefined"
    size="lg"
    :saving="saving"
    :save-label="t('academy.enroll.submit')"
    :save-disabled="
      !ready || checking || blocking.length > 0 || (override.length > 0 && !overrideReason.trim())
    "
    :error="formError"
    @save="save"
  >
    <SelectButton
      v-if="!fromWaitlist && modeOptions.length > 1"
      v-model="mode"
      :options="modeOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
    />

    <FormField
      v-if="mode === 'existing'"
      :label="t('academy.enroll.player')"
      for="enroll-client"
      required
      :error="err('client_id')"
    >
      <ClientPicker v-model="client" input-id="enroll-client" />
    </FormField>

    <template v-else>
      <fieldset class="group">
        <legend>{{ t('academy.enroll.child') }}</legend>
        <div class="row">
          <FormField
            :label="t('clients.firstName')"
            for="child-first"
            required
            :error="err('child.first_name')"
          >
            <InputText id="child-first" v-model="child.first_name" maxlength="60" fluid />
          </FormField>
          <FormField
            :label="t('clients.lastName')"
            for="child-last"
            required
            :error="err('child.last_name')"
          >
            <InputText id="child-last" v-model="child.last_name" maxlength="60" fluid />
          </FormField>
        </div>
        <div class="row">
          <FormField :label="t('clients.dob')" for="child-dob" :error="err('child.date_of_birth')">
            <DatePicker
              v-model="child.date_of_birth"
              input-id="child-dob"
              :max-date="new Date()"
              show-icon
              fluid
            />
          </FormField>
          <FormField :label="t('clients.genderLabel')" for="child-gender">
            <Select
              v-model="child.gender"
              input-id="child-gender"
              :options="genderOptions"
              option-label="label"
              option-value="value"
              show-clear
              fluid
            />
          </FormField>
        </div>
      </fieldset>
      <fieldset class="group">
        <legend>{{ t('academy.enroll.guardian') }}</legend>
        <SelectButton
          v-model="guardianMode"
          :options="guardianOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <ClientPicker
          v-if="guardianMode === 'existing'"
          v-model="guardianPick"
          input-id="enroll-guardian"
        />
        <template v-else>
          <div class="row">
            <FormField
              :label="t('clients.firstName')"
              for="g-first"
              required
              :error="err('guardian.first_name')"
            >
              <InputText id="g-first" v-model="guardian.first_name" maxlength="60" fluid />
            </FormField>
            <FormField
              :label="t('clients.lastName')"
              for="g-last"
              required
              :error="err('guardian.last_name')"
            >
              <InputText id="g-last" v-model="guardian.last_name" maxlength="60" fluid />
            </FormField>
          </div>
          <div class="row">
            <FormField :label="t('clients.mobile')" for="g-mobile" :error="err('guardian.mobile')">
              <InputText id="g-mobile" v-model="guardian.mobile" dir="ltr" inputmode="tel" fluid />
            </FormField>
            <FormField :label="t('clients.email')" for="g-email" :error="err('guardian.email')">
              <InputText id="g-email" v-model="guardian.email" dir="ltr" type="email" fluid />
            </FormField>
          </div>
        </template>
        <FormField :label="t('family.relation')" for="g-relation">
          <Select
            v-model="relation"
            input-id="g-relation"
            :options="relationOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </FormField>
        <small class="muted">{{ t('academy.enroll.newFamilyHint') }}</small>
      </fieldset>
    </template>

    <div v-if="reasons.length" class="reasons" role="status">
      <strong>{{ t('academy.enroll.cannotJoin') }}</strong>
      <div v-for="r in reasons" :key="r.code" class="reason">
        <Message :severity="override.includes(r.check) ? 'secondary' : 'warn'" :closable="false">
          {{ r.message }}
        </Message>
        <label v-if="canOverride(r)" class="radio">
          <Checkbox
            :model-value="override.includes(r.check)"
            binary
            @update:model-value="(on: boolean) => toggle(r.check, on)"
          />
          <span>{{ t('academy.enroll.override') }}</span>
        </label>
      </div>
      <FormField
        v-if="override.length"
        :label="t('academy.enroll.overrideReason')"
        for="enroll-reason"
        required
        :error="err('override_reason')"
      >
        <Textarea
          id="enroll-reason"
          v-model="overrideReason"
          rows="2"
          maxlength="500"
          auto-resize
          fluid
        />
      </FormField>
      <button
        v-if="full && group.waitlist_enabled && client && auth.can('academy.enroll')"
        type="button"
        class="link"
        @click="emit('waitlist')"
      >
        {{ t('academy.enroll.toWaitlist') }}
      </button>
    </div>

    <template v-if="mode === 'existing' && eligibility">
      <div class="row">
        <FormField
          :label="t('academy.enroll.startsOn')"
          for="enroll-start"
          :help="t('academy.enroll.startsOnHint')"
        >
          <DatePicker
            v-model="startsOn"
            input-id="enroll-start"
            :min-date="fromYmd(eligibility.starts_on) ?? undefined"
            :max-date="fromYmd(group.term?.ends_on) ?? undefined"
            show-icon
            fluid
            @update:model-value="check"
          />
        </FormField>
        <FormField
          :label="t('academy.enroll.payer')"
          for="enroll-payer"
          :help="t('academy.enroll.payerHint')"
        >
          <Select
            v-model="payerId"
            input-id="enroll-payer"
            :options="payers"
            option-label="name"
            option-value="id"
            fluid
          />
        </FormField>
      </div>
      <div class="quote">
        <strong>{{ t('academy.enroll.fees') }}</strong>
        <p v-if="!eligibility.quote.lines.length" class="muted">{{ t('academy.enroll.noFees') }}</p>
        <ul v-else>
          <li v-for="(line, i) in eligibility.quote.lines" :key="i">
            <span>{{ line.description }}</span>
            <span class="muted small">{{ showDay(format, line.due_on) }}</span>
            <span class="num">
              {{ format.money(line.amount - line.discount) }}
              <s v-if="line.discount" class="muted">{{ format.money(line.amount) }}</s>
            </span>
          </li>
        </ul>
        <small v-if="eligibility.quote.fraction < 1" class="muted">
          {{ t('academy.enroll.proRata', { n: Math.round(eligibility.quote.fraction * 100) }) }}
        </small>
        <small v-if="eligibility.quote.sibling_discount_percent" class="muted">
          {{ t('academy.enroll.sibling', { n: eligibility.quote.sibling_discount_percent }) }}
        </small>
        <small class="muted">{{ t('academy.enroll.vatNote') }}</small>
      </div>
    </template>
  </FormDrawer>
</template>

<style scoped>
.group {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group legend {
  font-weight: 600;
  padding: 0 4px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.reasons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reason {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.radio {
  display: flex;
  align-items: center;
  gap: 8px;
}
.quote {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quote ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quote li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: baseline;
}
.num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.num s {
  margin-inline-start: 6px;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
.link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--primary-700);
  cursor: pointer;
  text-align: start;
  font: inherit;
}
@media (max-width: 520px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
