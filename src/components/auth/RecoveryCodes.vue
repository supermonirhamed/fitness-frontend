<script setup lang="ts">
// Shown once after enabling 2FA or generating new codes; the API never returns them again.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useOrganization } from '@/stores/organization'

const props = defineProps<{ codes: string[] }>()
const emit = defineEmits<{ done: [] }>()

const { t } = useI18n()
const org = useOrganization()
const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.codes.join('\n'))
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function download() {
  const name = org.organization?.slug ?? 'account'
  const blob = new Blob([props.codes.join('\n') + '\n'], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${name}-recovery-codes.txt`,
  })
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="codes">
    <Message severity="warn" :closable="false">{{ t('tenantApp.security.codesWarning') }}</Message>
    <ul class="codes__list" dir="ltr" :aria-label="t('tenantApp.security.recoveryCodes')">
      <li v-for="code in codes" :key="code" class="num">{{ code }}</li>
    </ul>
    <div class="codes__actions">
      <Button
        :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
        :label="copied ? t('tenantApp.security.copied') : t('tenantApp.security.copy')"
        severity="secondary"
        variant="outlined"
        size="small"
        @click="copy"
      />
      <Button
        icon="pi pi-download"
        :label="t('tenantApp.security.download')"
        severity="secondary"
        variant="outlined"
        size="small"
        @click="download"
      />
      <span class="codes__spacer" />
      <Button :label="t('tenantApp.security.savedCodes')" size="small" @click="emit('done')" />
    </div>
  </div>
</template>

<style scoped>
.codes {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.codes__list {
  list-style: none;
  margin: 0;
  padding: var(--space-4);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-6);
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  font-family: var(--font-mono);
}
.codes__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.codes__spacer {
  flex: 1;
}
</style>
