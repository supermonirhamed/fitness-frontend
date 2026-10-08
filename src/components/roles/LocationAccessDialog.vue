<script setup lang="ts">
// "All locations" or a list of locations for one staff user (US-00.09).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import type { Location, StaffAccess } from '@/api/tenant'

const props = defineProps<{
  user: StaffAccess | null
  locations: Location[]
  /** The editor sees every location, so may grant "All locations". */
  canGrantAll: boolean
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [access: { all_locations: boolean; location_ids: number[] }] }>()

const { t } = useI18n()
const mode = ref<'all' | 'selected'>('selected')
const selected = ref<number[]>([])

watch(visible, (open) => {
  if (!open || !props.user) return
  mode.value = props.user.all_locations ? 'all' : 'selected'
  selected.value = [...props.user.location_ids]
})

const changed = computed(() => {
  const u = props.user
  if (!u) return false
  if ((mode.value === 'all') !== u.all_locations) return true
  return (
    mode.value === 'selected' &&
    [...selected.value].sort().join() !== [...u.location_ids].sort().join()
  )
})

function save() {
  emit('save', {
    all_locations: mode.value === 'all',
    location_ids: mode.value === 'all' ? [] : selected.value,
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('access.dialogTitle', { name: user?.name ?? '' })"
    :style="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="location-access-form" class="form" @submit.prevent="save">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <Message v-if="user && !user.location_limited" severity="info" :closable="false">{{
        t('access.orgWideRole')
      }}</Message>

      <fieldset class="choices">
        <legend class="sr-only">{{ t('access.columns.locations') }}</legend>
        <label class="choice" :class="{ 'choice--disabled': !canGrantAll }">
          <RadioButton v-model="mode" value="all" input-id="access-all" :disabled="!canGrantAll" />
          <span>
            <strong>{{ t('access.all') }}</strong>
            <small>{{ canGrantAll ? t('access.allHint') : t('access.allNotAllowed') }}</small>
          </span>
        </label>
        <label class="choice">
          <RadioButton v-model="mode" value="selected" input-id="access-selected" />
          <span>
            <strong>{{ t('access.selected') }}</strong>
            <small>{{ t('access.selectedHint') }}</small>
          </span>
        </label>
      </fieldset>

      <div v-if="mode === 'selected'" class="locations">
        <p v-if="!locations.length" class="empty">{{ t('access.noLocations') }}</p>
        <label v-for="location in locations" :key="location.id" class="location">
          <Checkbox v-model="selected" :value="location.id" :input-id="`loc-${location.id}`" />
          <span>{{ location.name }}</span>
        </label>
        <small v-if="locations.length && !selected.length" class="warn">{{
          t('access.noneSelected')
        }}</small>
      </div>
      <div class="audit">
        <i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}
      </div>
    </form>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="location-access-form"
        :label="t('permissions.save')"
        :disabled="!changed"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.choices {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.choice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  cursor: pointer;
}
.choice--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.choice span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.choice small,
.empty {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
  margin: 0;
}
.locations {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-inline-start: var(--space-3);
  max-height: 240px;
  overflow-y: auto;
}
.location {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.warn {
  font: var(--text-caption);
  color: var(--sev-warn-fg);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
