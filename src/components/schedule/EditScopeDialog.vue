<script setup lang="ts">
// What an edit of a series occurrence applies to (US-03.04/05), as the design's EditScopeDialog
// (ui_kits/admin/ScheduleDialogs.jsx): this session only (an exception, BR-06), this and following,
// or all in the series (past sessions never change).
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'

export type EditScope = 'one' | 'following' | 'all'

const props = defineProps<{
  /** The series in words, e.g. "Sun, Tue · 18:00 · until 31 Jan". */
  summary?: string | null
  /** The time or place changes: booked clients will be told. */
  moved?: boolean
  /** Scopes that can't be picked (with why). */
  unavailable?: Partial<Record<EditScope, string>>
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ confirm: [scope: EditScope] }>()
const { t } = useI18n()

const scope = ref<EditScope>('one')
watch(visible, (open) => {
  if (open) scope.value = 'one'
})
const SCOPES: EditScope[] = ['one', 'following', 'all']
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('session.editScope.title')"
    :style="{ width: '540px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="scope">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="scope__series">
        <i class="pi pi-replay" aria-hidden="true" />{{ summary ?? t('session.editScope.partOf') }}
      </div>
      <fieldset class="scope__options">
        <legend>{{ t('session.editScope.applyTo') }}</legend>
        <div v-for="s in SCOPES" :key="s" class="scope__option">
          <RadioButton
            v-model="scope"
            :input-id="`scope-${s}`"
            name="edit-scope"
            :value="s"
            :disabled="!!props.unavailable?.[s]"
          />
          <label :for="`scope-${s}`" :class="{ disabled: !!props.unavailable?.[s] }">
            <span class="scope__label">{{ t(`session.editScope.${s}`) }}</span>
            <span class="scope__hint">{{
              props.unavailable?.[s] ?? t(`session.editScope.${s}Hint`)
            }}</span>
          </label>
        </div>
      </fieldset>
      <Message v-if="moved" severity="info" icon="pi pi-bell" :closable="false">{{
        t('session.editScope.notify')
      }}</Message>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="t('session.saveChanges')"
        :loading="loading"
        @click="emit('confirm', scope)"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.scope {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.scope__series {
  font: var(--text-small);
  color: var(--text-secondary);
}
.scope__series i {
  margin-inline-end: 6px;
}
.scope__options {
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.scope__options legend {
  padding: 0;
  margin-bottom: 12px;
  font: var(--text-small);
  font-weight: 500;
}
.scope__option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.scope__option label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}
.scope__option label.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.scope__label {
  font: 500 14px/1.4 var(--font-sans);
}
.scope__hint {
  font: var(--text-small);
  color: var(--text-secondary);
}
</style>
