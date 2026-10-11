<script setup lang="ts">
// Port of the design system's Stepper (navigation/Stepper.jsx): numbered dots joined by lines;
// done and current steps are filled, earlier steps can be revisited.
defineProps<{ steps: string[]; active: number }>()
const emit = defineEmits<{ go: [index: number] }>()
</script>

<template>
  <ol class="steps">
    <template v-for="(label, i) in steps" :key="i">
      <li
        :class="['step', { 'step--on': i <= active, 'step--back': i < active }]"
        :aria-current="i === active ? 'step' : undefined"
      >
        <button type="button" :disabled="i >= active" @click="emit('go', i)">
          <span class="step__dot"
            ><i v-if="i < active" class="pi pi-check" aria-hidden="true" /><template v-else>{{
              i + 1
            }}</template></span
          >
          <span class="step__label">{{ label }}</span>
        </button>
      </li>
      <li
        v-if="i < steps.length - 1"
        :class="['line', { 'line--on': i < active }]"
        aria-hidden="true"
      />
    </template>
  </ol>
</template>

<style scoped>
.steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step button {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  font: 500 14px var(--font-sans);
  white-space: nowrap;
}
.step--back button {
  cursor: pointer;
}
.step button:disabled {
  cursor: default;
}
.step[aria-current='step'] button {
  color: var(--text-primary);
  font-weight: 600;
}
.step__dot {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 13px/1 var(--font-sans);
  background: var(--surface-card);
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
}
.step__dot i {
  font-size: 12px;
}
.step--on .step__dot {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-on-primary);
}
.line {
  flex: 1;
  min-width: 24px;
  height: 1px;
  background: var(--border-strong);
}
.line--on {
  background: var(--primary);
}
@media (max-width: 767px) {
  .step:not([aria-current='step']) .step__label {
    display: none;
  }
}
</style>
