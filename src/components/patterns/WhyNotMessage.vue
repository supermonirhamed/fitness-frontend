<script setup lang="ts">
// Port of the design system's WhyNotMessage (patterns/WhyNotMessage.jsx): explains a blocked action
// in plain words (Breakdown §17), e.g. "Full — waitlist closed", with an optional action.
import Message from 'primevue/message'

withDefaults(
  defineProps<{
    reason: string
    detail?: string | null
    severity?: 'warn' | 'error' | 'info' | 'secondary'
  }>(),
  { detail: null, severity: 'warn' },
)
</script>

<template>
  <Message
    :severity="severity"
    :icon="severity === 'error' ? 'pi pi-ban' : 'pi pi-lock'"
    :closable="false"
    class="why-not"
  >
    <div class="why-not__body">
      <div class="why-not__text">
        <strong>{{ reason }}</strong>
        <span v-if="detail">{{ detail }}</span>
      </div>
      <div v-if="$slots.default" class="why-not__action"><slot /></div>
    </div>
  </Message>
</template>

<style scoped>
.why-not__body {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.why-not__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.why-not__action {
  display: flex;
  gap: 6px;
}
</style>
