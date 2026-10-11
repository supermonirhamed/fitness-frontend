<script setup lang="ts">
// The design system's Message with a title and an action (feedback/Message.jsx), used for page
// banners such as "Draft — not visible to clients [Activate]".
const ICONS = {
  info: 'pi-info-circle',
  success: 'pi-check-circle',
  warn: 'pi-exclamation-triangle',
  danger: 'pi-times-circle',
  secondary: 'pi-info-circle',
} as const

const props = defineProps<{
  severity: keyof typeof ICONS
  title?: string
  icon?: string
}>()
</script>

<template>
  <div
    :class="['banner', `banner--${severity}`]"
    :role="severity === 'danger' ? 'alert' : 'status'"
  >
    <i :class="['pi', props.icon ?? ICONS[severity], 'banner__icon']" aria-hidden="true" />
    <div class="banner__body">
      <div v-if="title" class="banner__title">{{ title }}</div>
      <div v-if="$slots.default" class="banner__text"><slot /></div>
    </div>
    <div v-if="$slots.action" class="banner__action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-input);
  border: 1px solid var(--sev-info-border);
  background: var(--sev-info-bg);
  color: var(--sev-info-fg);
  font: var(--text-small);
}
.banner--success {
  border-color: var(--sev-success-border);
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
}
.banner--warn {
  border-color: var(--sev-warn-border);
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
}
.banner--danger {
  border-color: var(--sev-danger-border);
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
}
.banner--secondary {
  border-color: var(--sev-secondary-border);
  background: var(--sev-secondary-bg);
  color: var(--sev-secondary-fg);
}
.banner__icon {
  font-size: 16px;
  margin-top: 2px;
  flex: none;
}
.banner__body {
  flex: 1;
  min-width: 0;
}
.banner__title {
  font-weight: 600;
}
.banner__text {
  color: var(--text-primary);
}
.banner__action {
  flex: none;
  align-self: center;
}
</style>
