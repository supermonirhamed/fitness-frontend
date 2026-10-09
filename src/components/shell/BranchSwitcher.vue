<script setup lang="ts">
// Header branch switcher (US-01.13): "All my branches" plus each branch the user works at, with
// its timezone. The pick is kept on the account; screens that follow it read
// auth.currentLocation. With a single branch it is just shown, without a dropdown.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Select from 'primevue/select'
import { useStaffAuth } from '@/stores/staffAuth'
import { zoneAbbreviation } from '@/lib/datetime'

const ALL = 0 // Select needs a non-null value for the "all" option
const { t, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const saving = ref(false)

const branches = computed(() => auth.user?.switchable_locations ?? [])
const options = computed(() => [
  { value: ALL, label: t('branchSwitcher.all'), zone: null as string | null },
  ...branches.value.map((b) => ({
    value: b.id,
    label: b.name,
    zone: zoneAbbreviation(b.timezone, locale.value),
  })),
])
const selected = computed(() => auth.user?.current_location_id ?? ALL)

async function pick(value: number) {
  if (value === selected.value) return
  saving.value = true
  try {
    await auth.setCurrentLocation(value === ALL ? null : value)
  } catch {
    toast.add({ severity: 'error', summary: t('branchSwitcher.error'), life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <span v-if="branches.length === 1" class="single">
    <i class="pi pi-building" aria-hidden="true" />{{ branches[0]!.name }}
    <span class="zone" dir="ltr">{{ zoneAbbreviation(branches[0]!.timezone, locale) }}</span>
  </span>
  <Select
    v-else-if="branches.length > 1"
    :model-value="selected"
    :options="options"
    option-label="label"
    option-value="value"
    :loading="saving"
    :aria-label="t('branchSwitcher.label')"
    class="switcher"
    size="small"
    @update:model-value="pick"
  >
    <template #value="{ value }">
      <span class="value">
        <i class="pi pi-building" aria-hidden="true" />
        {{ options.find((o) => o.value === value)?.label }}
      </span>
    </template>
    <template #option="{ option }">
      <span class="option">
        <span>{{ option.label }}</span>
        <span v-if="option.zone" class="zone" dir="ltr">{{ option.zone }}</span>
      </span>
    </template>
  </Select>
</template>

<style scoped>
.single,
.value {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.switcher {
  min-width: 180px;
  max-width: 260px;
}
.option {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  width: 100%;
}
.zone {
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 560px) {
  .switcher {
    min-width: 0;
    max-width: 150px;
  }
}
</style>
