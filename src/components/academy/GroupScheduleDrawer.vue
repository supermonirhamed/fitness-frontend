<script setup lang="ts">
// A group's training schedule (US-10.06): weekdays, start time and length over the term (or
// open-ended for a rolling program). The preview lists every date with its clashes; the term's
// excluded dates and the branch's closed days are left out, and any other date can be skipped.
// Hard clashes block, warnings can be confirmed (US-03.06).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ConflictList from '@/components/patterns/ConflictList.vue'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import TimeField from '@/components/patterns/TimeField.vue'
import {
  tenantApi,
  type AcademyGroup,
  type AcademySchedulePreviewDate,
  type SessionConflictItem,
} from '@/api/tenant'
import { fromYmd, showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ group: AcademyGroup }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [trainings: number] }>()
const { t } = useI18n()
const format = useFormat()

const weekdays = ref<number[]>([])
const startTime = ref('17:00')
const duration = ref(90)
const startsOn = ref<Date | null>(null)
const endsOn = ref<Date | null>(null)
const preview = ref<AcademySchedulePreviewDate[] | null>(null)
const skip = ref<string[]>([])
const conflicts = ref<SessionConflictItem[]>([])
const loading = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const dayOptions = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: t(`session.days.${DAY_KEYS[d]}`) })),
)
const kept = computed(() =>
  (preview.value ?? []).filter((d) => !d.excluded && !skip.value.includes(d.date)),
)
const hard = computed(() => kept.value.some((d) => d.conflicts.some((c) => c.level === 'hard')))
const onlyWarnings = computed(
  () => conflicts.value.length > 0 && conflicts.value.every((c) => c.level === 'soft'),
)
const pattern = () => ({
  weekdays: weekdays.value,
  start_time: startTime.value,
  duration: duration.value,
  starts_on: startsOn.value ? isoDay(startsOn.value) : null,
  ends_on: endsOn.value ? isoDay(endsOn.value) : null,
})

watch(visible, (open) => {
  if (!open) return
  weekdays.value = []
  startTime.value = '17:00'
  duration.value = 90
  startsOn.value = fromYmd(props.group.term?.starts_on)
  endsOn.value = fromYmd(props.group.term?.ends_on)
  preview.value = null
  skip.value = []
  conflicts.value = []
  formError.value = null
})
watch([weekdays, startTime, duration, startsOn, endsOn], () => {
  preview.value = null
  conflicts.value = []
})

function toggleDate(date: string, on: boolean) {
  skip.value = on ? skip.value.filter((d) => d !== date) : [...skip.value, date]
}

async function loadPreview() {
  loading.value = true
  formError.value = null
  try {
    preview.value = await tenantApi.academy.groups.previewSchedule(props.group.id, pattern())
    skip.value = []
  } catch (e) {
    formError.value =
      Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!preview.value) {
    await loadPreview()
    return
  }
  saving.value = true
  formError.value = null
  try {
    const result = await tenantApi.academy.groups.createSchedule(props.group.id, {
      ...pattern(),
      skip_dates: skip.value,
      confirm_warnings: onlyWarnings.value || kept.value.some((d) => d.conflicts.length > 0),
    })
    emit('saved', result.trainings)
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
  <FormDrawer
    v-model:visible="visible"
    :title="t('academy.schedule.title')"
    :subtitle="group.display_name ?? undefined"
    size="lg"
    :saving="saving || loading"
    :save-label="
      preview ? t('academy.schedule.create', { n: kept.length }) : t('academy.schedule.preview')
    "
    :save-disabled="
      !weekdays.length || !startTime || !duration || (!!preview && (!kept.length || hard))
    "
    :error="formError"
    @save="save"
  >
    <FormField :label="t('academy.schedule.days')" required>
      <SelectButton
        v-model="weekdays"
        :options="dayOptions"
        option-label="label"
        option-value="value"
        multiple
        :aria-label="t('academy.schedule.days')"
      />
    </FormField>
    <div class="row">
      <FormField :label="t('session.start')" for="sch-start" required>
        <TimeField v-model="startTime" />
      </FormField>
      <FormField :label="t('academy.schedule.duration')" for="sch-duration" required>
        <InputNumber
          v-model="duration"
          input-id="sch-duration"
          :min="15"
          :max="600"
          :step="15"
          :suffix="` ${t('attendanceSettings.minutes')}`"
          show-buttons
          fluid
        />
      </FormField>
    </div>
    <div class="row">
      <FormField :label="t('academy.schedule.from')" for="sch-from">
        <DatePicker
          v-model="startsOn"
          input-id="sch-from"
          :min-date="new Date()"
          :max-date="fromYmd(group.term?.ends_on) ?? undefined"
          show-icon
          fluid
        />
      </FormField>
      <FormField
        :label="t('academy.schedule.until')"
        for="sch-until"
        :help="group.term ? undefined : t('academy.schedule.openEnded')"
      >
        <DatePicker
          v-model="endsOn"
          input-id="sch-until"
          :min-date="startsOn ?? new Date()"
          :max-date="fromYmd(group.term?.ends_on) ?? undefined"
          :show-clear="!group.term"
          show-icon
          fluid
        />
      </FormField>
    </div>
    <Message v-if="!group.facility" severity="warn" :closable="false">
      {{ t('academy.schedule.noFacility') }}
    </Message>
    <small class="muted">{{ t('academy.schedule.hint') }}</small>

    <div v-if="preview" class="preview">
      <div class="preview__head">
        <strong>{{ t('academy.schedule.dates', { n: kept.length }) }}</strong>
        <Button
          size="small"
          variant="text"
          icon="pi pi-refresh"
          :label="t('academy.schedule.refresh')"
          :loading="loading"
          @click="loadPreview"
        />
      </div>
      <Message v-if="hard" severity="error" :closable="false">{{
        t('academy.schedule.hardHint')
      }}</Message>
      <ul>
        <li
          v-for="d in preview"
          :key="d.date"
          :class="{ off: d.excluded || skip.includes(d.date) }"
        >
          <Checkbox
            v-if="!d.excluded"
            :model-value="!skip.includes(d.date)"
            binary
            :input-id="`keep-${d.date}`"
            :aria-label="t('academy.schedule.include', { date: d.date })"
            @update:model-value="(on: boolean) => toggleDate(d.date, on)"
          />
          <i v-else class="pi pi-ban muted" aria-hidden="true" />
          <span class="num"
            >{{ showDay(format, d.date) }} · <span dir="ltr">{{ d.start }}–{{ d.end }}</span></span
          >
          <Tag
            v-if="d.excluded"
            severity="secondary"
            :value="d.excluded.reason || t(`academy.schedule.excluded.${d.excluded.source}`)"
          />
          <Tag
            v-for="c in d.conflicts"
            v-else
            :key="c.code"
            :severity="c.level === 'hard' ? 'danger' : 'warn'"
            :value="c.title"
          />
        </li>
      </ul>
      <small class="muted">{{ t('academy.schedule.skipHint') }}</small>
    </div>
    <div v-if="conflicts.length" class="conflicts">
      <strong>{{
        onlyWarnings ? t('academy.coaches.warnings') : t('academy.coaches.blocked')
      }}</strong>
      <ConflictList :items="conflicts" />
    </div>
  </FormDrawer>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.preview {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.preview ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.preview li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-default);
}
.preview li.off .num {
  text-decoration: line-through;
  color: var(--text-muted);
}
.conflicts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.num {
  font-variant-numeric: tabular-nums;
}
.muted {
  color: var(--text-secondary);
}
@media (max-width: 520px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
