<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Password from 'primevue/password'
import { passwordProblems } from '@/lib/password'

const password = defineModel<string>('password', { required: true })
const confirmation = defineModel<string>('confirmation', { required: true })
const props = defineProps<{
  /** Show the client-side problems (set after the first submit). */
  showErrors: boolean
  serverError?: string | null
}>()

const { t } = useI18n()
const problems = computed(() =>
  props.showErrors ? passwordProblems(password.value, confirmation.value) : {},
)
const passwordError = computed(() =>
  problems.value.password
    ? t(`tenantApp.password.${problems.value.password}`)
    : (props.serverError ?? null),
)
</script>

<template>
  <div class="field">
    <label for="new-password">{{ t('tenantApp.password.new') }}</label>
    <Password
      v-model="password"
      input-id="new-password"
      :feedback="false"
      toggle-mask
      autocomplete="new-password"
      required
      fluid
      :invalid="!!passwordError"
      aria-describedby="new-password-help"
    />
    <small v-if="passwordError" id="new-password-help" class="field__error" role="alert">{{
      passwordError
    }}</small>
    <small v-else id="new-password-help">{{ t('tenantApp.password.hint') }}</small>
  </div>
  <div class="field">
    <label for="confirm-password">{{ t('tenantApp.password.confirm') }}</label>
    <Password
      v-model="confirmation"
      input-id="confirm-password"
      :feedback="false"
      toggle-mask
      autocomplete="new-password"
      required
      fluid
      :invalid="!!problems.confirmation"
    />
    <small v-if="problems.confirmation" class="field__error" role="alert">{{
      t('tenantApp.password.mismatch')
    }}</small>
  </div>
</template>
