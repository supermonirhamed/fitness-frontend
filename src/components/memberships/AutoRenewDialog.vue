<script setup lang="ts">
// Auto-renewal on or off for a recurring membership (US-06.10). Off, it ends with the current
// period, or the period in which the minimum commitment ends; staff with
// memberships.waive_commitment can waive the commitment, with a reason.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type ClientEntitlement } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()

const waive = ref(false)
const reason = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
watch(visible, (open) => {
  if (!open) return
  waive.value = false
  reason.value = ''
  error.value = null
})

const e = computed(() => props.entitlement)
const turningOff = computed(() => !!e.value?.auto_renew)
// Still within the minimum commitment after this period?
const committed = computed(
  () =>
    !!e.value?.commitment_ends_on &&
    !!e.value.period_ends_on &&
    e.value.commitment_ends_on > e.value.period_ends_on,
)
const canWaive = computed(() => committed.value && auth.can('memberships.waive_commitment'))
const ready = computed(() => !waive.value || !!reason.value.trim())

async function save() {
  if (!e.value || !ready.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await tenantApi.clients.setAutoRenew(props.clientId, e.value.id, {
      auto_renew: !turningOff.value,
      waive_commitment: turningOff.value && waive.value,
      reason: reason.value.trim() || null,
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
    :title="turningOff ? t('autoRenew.offTitle') : t('autoRenew.onTitle')"
    :subtitle="e?.name"
    icon="pi-refresh"
    size="sm"
    :save-label="turningOff ? t('autoRenew.turnOff') : t('autoRenew.turnOn')"
    :danger="turningOff"
    :saving="saving"
    :save-disabled="!ready"
    :error="error"
    @save="save"
  >
    <template v-if="turningOff && e">
      <p class="text">
        {{
          committed && !waive
            ? t('autoRenew.endsAfterCommitment', {
                date: format.date(e.commitment_ends_on!),
              })
            : t('autoRenew.endsWithPeriod', { date: format.date(e.period_ends_on!) })
        }}
      </p>
      <Message v-if="committed && !canWaive" severity="secondary" :closable="false" size="small">{{
        t('autoRenew.commitmentNoWaive')
      }}</Message>
      <div v-if="canWaive" class="check">
        <Checkbox v-model="waive" input-id="auto-renew-waive" binary />
        <label for="auto-renew-waive">{{ t('autoRenew.waive') }}</label>
      </div>
      <FormField v-if="waive" :label="t('autoRenew.reason')" for="auto-renew-reason" required>
        <Textarea id="auto-renew-reason" v-model="reason" rows="2" maxlength="500" auto-resize />
      </FormField>
    </template>
    <p v-else class="text">{{ t('autoRenew.onText') }}</p>
  </FormDialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
