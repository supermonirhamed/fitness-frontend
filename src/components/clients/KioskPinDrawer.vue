<script setup lang="ts">
// Staff set or remove a client's kiosk PIN (US-08.05), for clients without the app: with their
// mobile number it checks them in at the self check-in kiosk. Setting it lifts a lock-out.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import FormDrawer from '@/components/patterns/FormDrawer.vue'
import FormField from '@/components/patterns/FormField.vue'
import { tenantApi, type Client } from '@/api/tenant'
import { firstMessage } from '@/lib/apiErrors'

const props = defineProps<{ client: Client }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [hasPin: boolean] }>()
const { t } = useI18n()
const toast = useToast()
const pin = ref('')
const confirm = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  pin.value = ''
  confirm.value = ''
  error.value = null
})

async function save(value: string | null) {
  if (value !== null && value !== confirm.value) {
    error.value = t('kioskPin.mismatch')
    return
  }
  saving.value = true
  error.value = null
  try {
    const result = await tenantApi.kiosks.setClientPin(props.client.id, value)
    emit('changed', result.has_pin)
    toast.add({
      severity: 'success',
      summary: value ? t('kioskPin.saved') : t('kioskPin.cleared'),
      life: 3000,
    })
    visible.value = false
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDrawer
    v-model:visible="visible"
    :title="t('kioskPin.title')"
    :subtitle="client.has_kiosk_pin ? t('kioskPin.has') : t('kioskPin.none')"
    :save-label="client.has_kiosk_pin ? t('kioskPin.change') : t('kioskPin.set')"
    :saving="saving"
    :save-disabled="!/^\d{4,6}$/.test(pin)"
    :error="error"
    @save="save(pin)"
  >
    <p class="muted">{{ t('kioskPin.help') }}</p>
    <FormField :label="t('kioskPin.pin')" for="kiosk-pin">
      <InputText
        id="kiosk-pin"
        v-model="pin"
        type="password"
        inputmode="numeric"
        maxlength="6"
        autocomplete="off"
        dir="ltr"
        fluid
      />
    </FormField>
    <FormField :label="t('kioskPin.confirm')" for="kiosk-pin-confirm">
      <InputText
        id="kiosk-pin-confirm"
        v-model="confirm"
        type="password"
        inputmode="numeric"
        maxlength="6"
        autocomplete="off"
        dir="ltr"
        fluid
      />
    </FormField>
    <template v-if="client.has_kiosk_pin" #footer-start>
      <Button
        :label="t('kioskPin.clear')"
        severity="danger"
        variant="text"
        :disabled="saving"
        @click="save(null)"
      />
    </template>
  </FormDrawer>
</template>

<style scoped>
.muted {
  margin: 0;
  color: var(--text-muted);
  font: var(--text-small);
}
</style>
