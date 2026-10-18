<script setup lang="ts">
// A create/edit form in a side sheet, like the other entity forms: title + optional subtitle in
// the header, the fields (Enter submits), an error banner, and Cancel / Save in the footer. Opens
// from the inline-end side (left in Arabic). Sizes: md 480px, lg 640px — full width on phones.
// Same props as FormDialog so a form can move between the two.
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'md' | 'lg'
    saveLabel?: string
    saving?: boolean
    saveDisabled?: boolean
    error?: string | null
  }>(),
  { size: 'md' },
)
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [] }>()
const { t, locale } = useI18n()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const formId = `form-drawer-${useId()}`

function submit() {
  if (!props.saving && !props.saveDisabled) emit('save')
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="position"
    :dismissable="!saving"
    :class="['form-drawer', { 'drawer-lg': size === 'lg' }]"
  >
    <template #header>
      <div class="form-drawer__titles">
        <span class="p-drawer-title">{{ title }}</span>
        <span v-if="subtitle" class="form-drawer__subtitle">{{ subtitle }}</span>
      </div>
    </template>
    <form :id="formId" class="form-drawer__body" novalidate @submit.prevent="submit">
      <slot />
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
    </form>
    <template #footer>
      <slot name="footer-start" />
      <span class="form-drawer__spacer" />
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        :disabled="saving"
        @click="visible = false"
      />
      <Button
        type="submit"
        :form="formId"
        :label="saveLabel ?? t('common.save')"
        :loading="saving"
        :disabled="saveDisabled"
      />
    </template>
  </Drawer>
</template>

<style scoped>
.form-drawer__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.form-drawer__subtitle {
  font: var(--text-small);
  color: var(--text-muted);
}
.form-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-drawer__spacer {
  flex: 1;
}
</style>
