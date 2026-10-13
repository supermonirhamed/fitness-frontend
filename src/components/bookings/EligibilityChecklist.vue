<script setup lang="ts">
// The booking drawer's eligibility box (ui_kits/admin/BookingDrawer.jsx, US-04.01): every check in
// order, a tick when it passes, and the server's localized reason when it doesn't. A check staff
// overrode stays visible, marked as overridden.
import { useI18n } from 'vue-i18n'
import type { BookingEligibility } from '@/api/tenant'

defineProps<{ result: BookingEligibility }>()
const { t } = useI18n()

type Check = BookingEligibility['checks'][number]

const messages = (result: BookingEligibility, check: Check) =>
  result.reasons.filter((r) => r.check === check.check).map((r) => r.message)

const icon = (check: Check) =>
  check.passed ? 'pi-check-circle' : check.overridden ? 'pi-exclamation-circle' : 'pi-times-circle'
</script>

<template>
  <section class="eligibility" :aria-label="t('eligibility.title')">
    <h3 class="eligibility__title">{{ t('eligibility.title') }}</h3>
    <ul class="eligibility__list">
      <li
        v-for="check in result.checks"
        :key="check.check"
        :class="[
          'eligibility__item',
          check.passed ? 'is-passed' : check.overridden ? 'is-overridden' : 'is-failed',
        ]"
      >
        <i :class="['pi', icon(check)]" aria-hidden="true"></i>
        <span v-if="check.passed">{{ t(`eligibility.passed.${check.check}`) }}</span>
        <span v-else-if="check.overridden">
          {{ t(`eligibility.checks.${check.check}`) }} ·
          <strong>{{ t('eligibility.overridden') }}</strong>
        </span>
        <span v-else class="eligibility__reasons">
          <span v-for="message in messages(result, check)" :key="message">{{ message }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.eligibility {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eligibility__title {
  font: var(--text-h4);
  margin: 0;
}
.eligibility__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eligibility__item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font: var(--text-body);
  color: var(--text-primary);
}
.eligibility__item .pi {
  margin-top: 3px;
}
.is-passed .pi {
  color: var(--sev-success-solid);
}
.is-overridden .pi {
  color: var(--sev-warn-solid);
}
.is-failed {
  color: var(--sev-danger-fg);
}
.is-failed .pi {
  color: var(--sev-danger-solid);
}
.eligibility__reasons {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
