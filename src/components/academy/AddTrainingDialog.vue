<script setup lang="ts">
// An extra training for a group (US-10.06): a friendly match or a make-up session, at the
// group's facility with its coaches. The group's players are booked into it.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import ConflictList from '@/components/patterns/ConflictList.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import { tenantApi, type AcademyGroup, type SessionConflictItem } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'

const props = defineProps<{ group: AcademyGroup }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()

const date = ref<Date | null>(null)
const startTime = ref('17:00')
const duration = ref(90)
const conflicts = ref<SessionConflictItem[]>([])
const saving = ref(false)
const formError = ref<string | null>(null)
const onlyWarnings = computed(
  () => conflicts.value.length > 0 && conflicts.value.every((c) => c.level === 'soft'),
)

watch(visible, (open) => {
  if (!open) return
  date.value = null
  startTime.value = '17:00'
  duration.value = 90
  conflicts.value = []
  formError.value = null
})
watch([date, startTime, duration], () => (conflicts.value = []))

async function save() {
  if (!date.value) return
  saving.value = true
  formError.value = null
  try {
    await tenantApi.academy.groups.addTraining(props.group.id, {
      date: isoDay(date.value),
      start_time: startTime.value,
      duration: duration.value,
      confirm_warnings: onlyWarnings.value,
    })
    emit('saved')
    visible.value = false
  } catch (e) {
    const data = e instanceof AxiosError ? e.response?.data : null
    if (e instanceof AxiosError && e.response?.status === 409 && Array.isArray(data?.conflicts)) {
      conflicts.value = data.conflicts
    } else {
      formError.value =
        Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('academy.schedule.addTitle')"
    :subtitle="group.display_name ?? undefined"
    icon="pi-calendar-plus"
    :saving="saving"
    :save-disabled="!date || !startTime || (conflicts.length > 0 && !onlyWarnings)"
    :save-label="onlyWarnings ? t('academy.coaches.saveAnyway') : t('academy.schedule.add')"
    :error="formError"
    @save="save"
  >
    <FormField :label="t('session.date')" for="extra-date" required>
      <DatePicker v-model="date" input-id="extra-date" :min-date="new Date()" show-icon fluid />
    </FormField>
    <div class="row">
      <FormField :label="t('session.start')" required>
        <TimeField v-model="startTime" />
      </FormField>
      <FormField :label="t('academy.schedule.duration')" for="extra-duration" required>
        <InputNumber
          v-model="duration"
          input-id="extra-duration"
          :min="15"
          :max="600"
          :step="15"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          show-buttons
          fluid
        />
      </FormField>
    </div>
    <small class="muted">{{ t('academy.schedule.addHint') }}</small>
    <div v-if="conflicts.length" class="conflicts">
      <strong>{{
        onlyWarnings ? t('academy.coaches.warnings') : t('academy.coaches.blocked')
      }}</strong>
      <ConflictList :items="conflicts" />
    </div>
  </FormDialog>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.conflicts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.muted {
  color: var(--text-secondary);
}
</style>
