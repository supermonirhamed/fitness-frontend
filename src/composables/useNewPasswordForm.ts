import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { validationErrors } from '@/lib/http'
import { passwordProblems } from '@/lib/password'
import type { NewPassword } from '@/api/tenant'

/** Form state shared by "accept invitation" and "reset password". */
export function useNewPasswordForm() {
  const { t } = useI18n()
  const form = reactive({ password: '', confirmation: '' })
  const submitted = ref(false)
  const serverError = ref<string | null>(null)

  const valid = computed(
    () => Object.keys(passwordProblems(form.password, form.confirmation)).length === 0,
  )

  /** Marks the form submitted; returns the payload when it passes the client-side checks. */
  function payload(): NewPassword | null {
    submitted.value = true
    serverError.value = null
    return valid.value
      ? { password: form.password, password_confirmation: form.confirmation }
      : null
  }

  /** Returns true when the error was a password rejection and is now shown on the field. */
  function showServerError(error: unknown): boolean {
    // Length and confirmation are checked before sending, so a rejected password is a breached one.
    if (!validationErrors(error).password) return false
    serverError.value = t('tenantApp.password.breached')
    return true
  }

  return { form, submitted, serverError, payload, showServerError }
}
