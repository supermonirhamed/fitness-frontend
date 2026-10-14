<script setup lang="ts">
// Upgrade or downgrade a recurring membership (US-06.12). An upgrade takes effect today and the
// difference for the rest of the period is invoiced; a downgrade waits for the next renewal, or
// takes effect today with the difference as account credit. Upcoming bookings the new plan
// doesn't cover are listed: keep each (needs bookings.override) or cancel it without penalty.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  tenantApi,
  type ClientEntitlement,
  type MembershipPlan,
  type PlanChangePreview,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()

const e = computed(() => props.entitlement)
const plans = ref<MembershipPlan[]>([])
const planId = ref<number | null>(null)
const immediate = ref(false)
const reason = ref('')
const decisions = ref<Record<number, 'keep' | 'cancel'>>({})
const preview = ref<PlanChangePreview | null>(null)
const previewError = ref<string | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, async (open) => {
  if (!open || !e.value) return
  planId.value = null
  immediate.value = false
  reason.value = ''
  decisions.value = {}
  preview.value = null
  previewError.value = null
  error.value = null
  try {
    plans.value = await tenantApi.membershipPlans.list({ kind: 'membership' })
  } catch {
    plans.value = []
  }
})

// Other published recurring plans sold at the membership's branch.
const options = computed(() =>
  plans.value
    .filter(
      (p) =>
        p.id !== e.value?.plan_id &&
        p.status === 'Published' &&
        p.billing === 'recurring' &&
        p.prices.length > 0,
    )
    .map((p) => ({
      value: p.id,
      label: p.display_name,
      price: p.prices.length === 1 ? p.prices[0]!.price : null,
    })),
)

let seq = 0
async function loadPreview() {
  if (!e.value || !planId.value) return
  const mine = ++seq
  previewError.value = null
  try {
    const p = await tenantApi.clients.changePlanPreview(props.clientId, e.value.id, {
      plan_id: planId.value,
      immediate: immediate.value,
    })
    if (mine !== seq) return
    preview.value = p
    decisions.value = Object.fromEntries(p.bookings.map((b) => [b.id, 'cancel' as const]))
  } catch (err) {
    if (mine !== seq) return
    preview.value = null
    previewError.value = apiMessage(err) ?? t('common.genericError')
  }
}
watch([planId, immediate], loadPreview)

const canKeep = computed(() => auth.can('bookings.override'))
const decisionOptions = computed(() => [
  { value: 'cancel', label: t('changePlan.cancelBooking') },
  { value: 'keep', label: t('changePlan.keepBooking'), disabled: !canKeep.value },
])
const ready = computed(() => !!preview.value && !!planId.value)

async function save() {
  if (!e.value || !ready.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await tenantApi.clients.changePlan(props.clientId, e.value.id, {
      plan_id: planId.value!,
      immediate: immediate.value,
      reason: reason.value.trim() || null,
      bookings: decisions.value,
    })
    visible.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('changePlan.title')"
    :subtitle="e ? t('changePlan.current', { name: e.name, price: format.money(e.price) }) : ''"
    icon="pi-arrow-right-arrow-left"
    size="md"
    :save-label="
      preview && !preview.immediate ? t('changePlan.saveScheduled') : t('changePlan.save')
    "
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <FormField :label="t('changePlan.newPlan')" for="change-plan" required>
      <Select
        v-model="planId"
        input-id="change-plan"
        :options="options"
        option-label="label"
        option-value="value"
        :placeholder="t('changePlan.choose')"
        :empty-message="t('changePlan.noPlans')"
        fluid
      >
        <template #option="{ option }">
          <span class="opt">
            <span>{{ option.label }}</span>
            <span v-if="option.price !== null" class="muted num">{{
              format.money(option.price)
            }}</span>
          </span>
        </template>
      </Select>
    </FormField>
    <Message v-if="previewError" severity="error" :closable="false" size="small">{{
      previewError
    }}</Message>
    <template v-if="preview">
      <div class="direction">
        <Tag
          :severity="preview.direction === 'upgrade' ? 'success' : 'warn'"
          :icon="preview.direction === 'upgrade' ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
          :value="t(`changePlan.directions.${preview.direction}`)"
        />
        <span>{{ t('changePlan.newPrice', { price: format.money(preview.new_price) }) }}</span>
      </div>
      <div v-if="preview.direction === 'downgrade'" class="toggle">
        <ToggleSwitch v-model="immediate" input-id="change-immediate" />
        <label for="change-immediate"
          >{{ t('changePlan.immediate') }}
          <small class="muted">{{ t('changePlan.immediateHint') }}</small></label
        >
      </div>
      <Message severity="secondary" :closable="false" icon="pi pi-info-circle" size="small">
        <template v-if="!preview.immediate">{{
          t('changePlan.atRenewal', { date: format.date(preview.effective_on) })
        }}</template>
        <template v-else-if="preview.direction === 'upgrade'">{{
          preview.amount
            ? t('changePlan.invoiced', {
                amount: format.money(preview.amount),
                n: preview.days_left,
              })
            : t('changePlan.noDifference')
        }}</template>
        <template v-else>{{
          t('changePlan.credited', { amount: format.money(preview.amount), n: preview.days_left })
        }}</template>
      </Message>
      <div v-if="preview.bookings.length" class="bookings">
        <span class="bookings__title">{{
          t('changePlan.bookingsTitle', { n: preview.bookings.length })
        }}</span>
        <ul>
          <li v-for="b in preview.bookings" :key="b.id">
            <span class="bookings__what">
              <strong>{{ b.session }}</strong>
              <small class="muted">{{ format.dateTime(b.starts_at) }}</small>
            </span>
            <SelectButton
              v-model="decisions[b.id]"
              :options="decisionOptions"
              option-label="label"
              option-value="value"
              option-disabled="disabled"
              :allow-empty="false"
              size="small"
              :aria-label="b.session"
            />
          </li>
        </ul>
        <small v-if="!canKeep" class="muted">{{ t('changePlan.keepNeedsOverride') }}</small>
      </div>
      <FormField :label="t('changePlan.reason')" for="change-reason">
        <Textarea id="change-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
      </FormField>
    </template>
  </FormDialog>
</template>

<style scoped>
.opt {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
}
.direction {
  display: flex;
  gap: 10px;
  align-items: center;
}
.toggle {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.toggle label {
  display: flex;
  flex-direction: column;
}
.bookings {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bookings__title {
  font: 600 13px var(--font-sans);
  color: var(--sev-warn-fg);
}
.bookings ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bookings li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.bookings__what {
  display: flex;
  flex-direction: column;
}
</style>
