<script setup lang="ts">
// A closure overlaps scheduled sessions (US-01.07): list them, then cancel them all or keep them.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import type { AffectedSession, FutureSessionsChoice } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ sessions: AffectedSession[]; timezone: string; loading?: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ choose: [choice: FutureSessionsChoice] }>()
const { t } = useI18n()
const format = useFormat()
const choice = ref<FutureSessionsChoice | null>(null)
watch(visible, (open) => open && (choice.value = null))

function choose(value: FutureSessionsChoice) {
  choice.value = value
  emit('choose', value)
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('closureImpact.title', props.sessions.length)"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="body">
      <Message severity="warn" :closable="false">{{ t('closureImpact.lead') }}</Message>
      <ul class="sessions">
        <li v-for="s in sessions" :key="s.id">
          <span class="title">{{ s.title }}</span>
          <span class="when">{{ format.dateTime(s.starts_at, timezone) }}</span>
          <span class="bookings">{{ t('closureImpact.bookings', s.bookings) }}</span>
        </li>
      </ul>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        :disabled="loading"
        @click="visible = false"
      />
      <Button
        :label="t('closureImpact.keep')"
        severity="secondary"
        variant="outlined"
        :loading="loading && choice === 'keep'"
        :disabled="loading"
        @click="choose('keep')"
      />
      <Button
        :label="t('closureImpact.cancel')"
        severity="danger"
        :loading="loading && choice === 'cancel'"
        :disabled="loading"
        @click="choose('cancel')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.sessions {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.sessions li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
}
.sessions li + li {
  border-top: 1px solid var(--border-subtle);
}
.title {
  font-weight: var(--fw-medium);
}
.when,
.bookings {
  font: var(--text-caption);
  color: var(--text-muted);
}
.bookings {
  grid-row: span 2;
  align-self: center;
}
</style>
