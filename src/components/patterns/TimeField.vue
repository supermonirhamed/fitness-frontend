<script setup lang="ts">
// "HH:MM" time input as in the design (forms/DatePicker.jsx mode="time"): clock icon, 24-hour by
// default, always left-to-right.
import { computed } from 'vue'
import DatePicker from 'primevue/datepicker'

const model = defineModel<string>({ required: true })
withDefaults(defineProps<{ invalid?: boolean; disabled?: boolean; hourFormat?: '12' | '24' }>(), {
  hourFormat: '24',
})

const asDate = computed({
  get: () => {
    const [h, m] = (model.value || '00:00').split(':').map(Number)
    const d = new Date(2000, 0, 1)
    d.setHours(h ?? 0, m ?? 0, 0, 0)
    return d
  },
  set: (d: Date | null) => {
    if (!d) return
    model.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },
})
</script>

<template>
  <DatePicker
    v-model="asDate"
    time-only
    :hour-format="hourFormat"
    :step-minute="5"
    show-icon
    icon-display="input"
    icon="pi pi-clock"
    :invalid="invalid"
    :disabled="disabled"
    dir="ltr"
    class="time-field"
  />
</template>

<style scoped>
.time-field {
  width: 112px;
}
</style>
