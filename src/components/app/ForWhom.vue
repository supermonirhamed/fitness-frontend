<script setup lang="ts">
// "For whom" in booking and buying (US-11.25): myself or one of my children. The child is the
// beneficiary; the parent pays. Only children the parent may book for (or pay for) are offered.
// Hidden for clients who aren't parents.
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectButton from 'primevue/selectbutton'
import { useClientApp } from '@/stores/clientApp'

const model = defineModel<number | null>({ default: null })
const props = withDefaults(defineProps<{ permission?: 'can_book' | 'can_pay' }>(), {
  permission: 'can_book',
})
const { t } = useI18n()
const app = useClientApp()
onMounted(() => app.loadChildren())
const options = computed(() => [
  { value: null, label: t('app.family.me') },
  ...(app.children ?? [])
    .filter((c) => c.permissions[props.permission])
    .map((c) => ({ value: c.id, label: c.first_name })),
])
</script>

<template>
  <div v-if="options.length > 1" class="for-whom">
    <span class="ca-muted ca-small">{{ t('app.family.forWhom') }}</span>
    <SelectButton
      v-model="model"
      :options="options"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      :aria-label="t('app.family.forWhom')"
    />
  </div>
</template>

<style scoped>
.for-whom {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
