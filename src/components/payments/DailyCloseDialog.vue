<script setup lang="ts">
// Daily close (US-07.10): for a branch's day, or one staff user's drawer, the totals the system
// expects by method against what staff counted, with the difference and a note. Closing locks the
// day's payments; a user with payments.reopen_day can reopen it with a reason.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type DayClose, type DaySummary } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{
  branches: { id: number; name: string }[]
  staff: { id: number; name: string }[]
  locationId: number | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const format = useFormat()
const auth = useStaffAuth()

const branchId = ref<number | null>(null)
const day = ref<Date>(new Date())
const userId = ref<number | null>(null)
const summary = ref<DaySummary | null>(null)
const counted = ref<Record<string, number | null>>({})
const note = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  branchId.value = props.locationId ?? auth.currentLocation?.id ?? props.branches[0]?.id ?? null
  day.value = new Date()
  userId.value = null
  note.value = ''
  error.value = null
  load()
})
watch([branchId, day, userId], () => visible.value && load())

async function load() {
  if (!branchId.value || !day.value) return
  loading.value = true
  error.value = null
  try {
    summary.value = await tenantApi.transactions.day({
      location_id: branchId.value,
      date: isoDay(day.value),
      user_id: userId.value,
    })
    counted.value = Object.fromEntries(summary.value.methods.map((m) => [m, null]))
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    loading.value = false
  }
}

// A close in force for this branch's day, or this drawer.
const inForce = computed<DayClose | null>(
  () =>
    summary.value?.closes.find((c) => !c.reopened_at && (!c.user || c.user.id === userId.value)) ??
    null,
)
// Methods worth counting: the ones with money expected, plus cash.
const rows = computed(() =>
  (summary.value?.methods ?? []).filter(
    (m) => m === 'cash' || (summary.value?.expected[m] ?? 0) !== 0,
  ),
)
const countedTotal = computed(() =>
  rows.value.reduce((sum, m) => sum + (counted.value[m] ?? summary.value?.expected[m] ?? 0), 0),
)
const difference = computed(
  () => Math.round((countedTotal.value - (summary.value?.expected_total ?? 0)) * 1000) / 1000,
)

async function save() {
  if (!summary.value || inForce.value || !branchId.value) return
  saving.value = true
  error.value = null
  try {
    await tenantApi.transactions.close({
      location_id: branchId.value,
      date: isoDay(day.value),
      user_id: userId.value,
      counted: Object.fromEntries(rows.value.map((m) => [m, counted.value[m] ?? null])),
      note: note.value.trim() || null,
    })
    emit('changed')
    await load()
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}

const reopenReason = ref('')
const reopening = ref(false)
async function reopen(close: DayClose) {
  if (!reopenReason.value.trim()) return
  reopening.value = true
  error.value = null
  try {
    await tenantApi.transactions.reopen(close.id, reopenReason.value.trim())
    reopenReason.value = ''
    emit('changed')
    await load()
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    reopening.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('dailyClose.title')"
    :subtitle="t('dailyClose.subtitle')"
    icon="pi-lock"
    size="md"
    :save-label="t('dailyClose.close')"
    :saving="saving"
    :save-disabled="!summary || !!inForce || loading"
    :error="error"
    @save="save"
  >
    <div class="pick">
      <FormField v-if="branches.length > 1" :label="t('invoices.branch')" for="close-branch">
        <Select
          v-model="branchId"
          input-id="close-branch"
          :options="branches"
          option-label="name"
          option-value="id"
          fluid
        />
      </FormField>
      <FormField :label="t('dailyClose.day')" for="close-day">
        <DatePicker
          v-model="day"
          input-id="close-day"
          :max-date="new Date()"
          :manual-input="false"
          show-icon
          icon-display="input"
          fluid
        />
      </FormField>
      <FormField v-if="staff.length" :label="t('dailyClose.drawer')" for="close-user">
        <Select
          v-model="userId"
          input-id="close-user"
          :options="staff"
          option-label="name"
          option-value="id"
          :placeholder="t('dailyClose.wholeBranch')"
          show-clear
          filter
          fluid
        />
      </FormField>
    </div>

    <template v-if="summary">
      <Message v-if="inForce" severity="info" :closable="false">
        {{
          t('dailyClose.closedBy', {
            name: inForce.closed_by ?? '',
            at: format.dateTime(inForce.closed_at),
          })
        }}
      </Message>
      <table class="count">
        <thead>
          <tr>
            <th>{{ t('payments.method') }}</th>
            <th class="end">{{ t('dailyClose.expected') }}</th>
            <th class="end">{{ t('dailyClose.counted') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in rows" :key="m">
            <td>{{ t(`payments.methods.${m}`) }}</td>
            <td class="end num">{{ format.money(summary.expected[m] ?? 0) }}</td>
            <td class="end">
              <span v-if="inForce" class="num">{{ format.money(inForce.counted[m] ?? 0) }}</span>
              <InputNumber
                v-else
                v-model="counted[m]"
                :placeholder="String(summary.expected[m] ?? 0)"
                :max-fraction-digits="3"
                size="small"
                :aria-label="t('dailyClose.countedFor', { method: t(`payments.methods.${m}`) })"
              />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th>{{ t('invoices.total') }}</th>
            <th class="end num">{{ format.money(summary.expected_total) }}</th>
            <th class="end num">
              {{ format.money(inForce ? inForce.counted_total : countedTotal) }}
            </th>
          </tr>
          <tr>
            <th colspan="2">{{ t('dailyClose.difference') }}</th>
            <th :class="['end', 'num', { bad: (inForce ? inForce.difference : difference) !== 0 }]">
              {{ format.money(inForce ? inForce.difference : difference) }}
            </th>
          </tr>
        </tfoot>
      </table>
      <p class="muted">
        {{ t('dailyClose.counts', { payments: summary.payments, refunds: summary.refunds }) }}
      </p>
      <FormField v-if="!inForce" :label="t('dailyClose.note')" for="close-note">
        <Textarea id="close-note" v-model="note" rows="2" maxlength="1000" auto-resize />
      </FormField>
      <p v-else-if="inForce.note" class="note">{{ inForce.note }}</p>

      <div v-if="inForce && summary.can_reopen" class="reopen">
        <FormField :label="t('dailyClose.reopenReason')" for="reopen-reason" required>
          <Textarea
            id="reopen-reason"
            v-model="reopenReason"
            rows="2"
            maxlength="500"
            auto-resize
          />
        </FormField>
        <Button
          :label="t('dailyClose.reopen')"
          icon="pi pi-lock-open"
          severity="secondary"
          :loading="reopening"
          :disabled="!reopenReason.trim()"
          @click="reopen(inForce)"
        />
      </div>

      <ul v-if="summary.closes.some((c) => c.reopened_at)" class="history">
        <li v-for="c in summary.closes.filter((c) => c.reopened_at)" :key="c.id">
          <Tag class="tag-sm" severity="secondary" :value="t('dailyClose.reopened')" />
          {{
            t('dailyClose.reopenedBy', {
              name: c.reopened_by ?? '',
              at: format.dateTime(c.reopened_at!),
              reason: c.reopen_reason ?? '',
            })
          }}
        </li>
      </ul>
    </template>
  </FormDialog>
</template>

<style scoped>
.pick {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.count {
  width: 100%;
  border-collapse: collapse;
}
.count th,
.count td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border-subtle, var(--border-default));
  text-align: start;
}
.count .end {
  text-align: end;
}
.count tfoot th {
  font-weight: 600;
}
.bad {
  color: var(--sev-danger-fg, var(--red-600));
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.note {
  margin: 0;
  white-space: pre-line;
}
.reopen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.reopen :deep(.field) {
  width: 100%;
}
.history {
  margin: 0;
  padding: 0;
  list-style: none;
  font: var(--text-small);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
