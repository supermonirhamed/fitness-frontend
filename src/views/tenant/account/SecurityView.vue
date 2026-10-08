<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputOtp from 'primevue/inputotp'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import PageHeader from '@/components/patterns/PageHeader.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import PasswordConfirmDialog from '@/components/auth/PasswordConfirmDialog.vue'
import RecoveryCodes from '@/components/auth/RecoveryCodes.vue'
import { tenantApi, type TwoFactorSetup, type TwoFactorStatus } from '@/api/tenant'
import { errorCode } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const status = ref<TwoFactorStatus | null>(null)
const setup = ref<TwoFactorSetup | null>(null) // between "turn on" and the confirming code
const code = ref('')
const codeError = ref<string | null>(null)
const confirming = ref(false)
const recoveryCodes = ref<string[] | null>(null) // shown once
const secretShown = ref(false)

const qrSrc = computed(() =>
  setup.value ? `data:image/svg+xml;base64,${btoa(setup.value.qr_svg)}` : '',
)
const groupedSecret = computed(() => setup.value?.secret.match(/.{1,4}/g)?.join(' ') ?? '')
const mustSetUp = computed(() => status.value?.required && !status.value.enabled)

async function load() {
  state.value = 'loading'
  try {
    status.value = await tenantApi.twoFactor.status()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

/** Keep the signed-in user in sync, so the router stops sending them here once 2FA is on. */
function applyStatus(next: TwoFactorStatus) {
  status.value = next
  if (auth.user) {
    auth.user.two_factor_enabled = next.enabled
    auth.user.two_factor_required = next.required
  }
}

// Password-confirmed actions
type Action = 'enable' | 'newCodes' | 'disable'
const action = ref<Action | null>(null)
const dialogOpen = ref(false)
const dialogBusy = ref(false)
const dialogError = ref<string | null>(null)

function ask(kind: Action) {
  action.value = kind
  dialogError.value = null
  dialogOpen.value = true
}

async function onPassword(password: string) {
  dialogBusy.value = true
  dialogError.value = null
  try {
    if (action.value === 'enable') {
      setup.value = await tenantApi.twoFactor.start(password)
      code.value = ''
      codeError.value = null
    } else if (action.value === 'newCodes') {
      const next = await tenantApi.twoFactor.newRecoveryCodes(password)
      recoveryCodes.value = next.recovery_codes ?? []
      applyStatus(next)
    } else if (action.value === 'disable') {
      applyStatus(await tenantApi.twoFactor.disable(password))
      toast.add({ severity: 'success', summary: t('tenantApp.security.disabledToast'), life: 4000 })
    }
    dialogOpen.value = false
  } catch (e) {
    dialogError.value = validationErrors(e).password
      ? t('tenantApp.security.wrongPassword')
      : errorCode(e) === 'two_factor_required'
        ? t('tenantApp.security.requiredCannotDisable')
        : t('common.genericError')
  } finally {
    dialogBusy.value = false
  }
}

async function confirmCode() {
  if (code.value.length !== 6) return
  confirming.value = true
  codeError.value = null
  try {
    const next = await tenantApi.twoFactor.confirm(code.value)
    recoveryCodes.value = next.recovery_codes ?? []
    applyStatus(next)
    setup.value = null
    toast.add({ severity: 'success', summary: t('tenantApp.security.enabledToast'), life: 4000 })
  } catch (e) {
    code.value = ''
    codeError.value = validationErrors(e).code
      ? t('tenantApp.twoFactor.invalid')
      : t('common.genericError')
  } finally {
    confirming.value = false
  }
}

function onCodeInput(value: unknown) {
  code.value = String(value ?? '')
  if (code.value.length === 6 && !confirming.value) confirmCode()
}

function codesSaved() {
  recoveryCodes.value = null
  // A required setup is finished: continue to the app.
  if (router.currentRoute.value.query.required) router.replace({ name: 'tenant.today' })
}

const dialog = computed(() => {
  const kind = action.value ?? 'enable'
  return {
    title: t(`tenantApp.security.confirm.${kind}.title`),
    description: t(`tenantApp.security.confirm.${kind}.description`),
    confirmLabel: t(`tenantApp.security.confirm.${kind}.button`),
    destructive: kind === 'disable',
  }
})
</script>

<template>
  <div class="security">
    <PageHeader
      :title="t('tenantApp.security.title')"
      :subtitle="t('tenantApp.security.subtitle')"
    />

    <Message v-if="mustSetUp" severity="warn" :closable="false" role="alert">{{
      t('tenantApp.security.requiredBanner')
    }}</Message>

    <section class="card">
      <div class="card__head">
        <span class="card__icon" aria-hidden="true"><i class="pi pi-mobile" /></span>
        <div class="card__title">
          <h2>{{ t('tenantApp.security.twoFactor') }}</h2>
          <p>{{ t('tenantApp.security.twoFactorHint') }}</p>
        </div>
        <Tag
          v-if="status"
          :severity="status.enabled ? 'success' : 'secondary'"
          :value="status.enabled ? t('tenantApp.security.on') : t('tenantApp.security.off')"
        />
      </div>

      <div
        v-if="state === 'loading'"
        class="card__body"
        aria-busy="true"
        :aria-label="t('common.loading')"
      >
        <Skeleton height="20px" width="60%" />
        <Skeleton height="36px" width="140px" />
      </div>

      <EmptyState
        v-else-if="state === 'error'"
        icon="pi-exclamation-triangle"
        :title="t('tenantApp.security.loadError')"
      >
        <Button
          severity="secondary"
          variant="outlined"
          icon="pi pi-replay pi-dir"
          :label="t('common.retry')"
          @click="load"
        />
      </EmptyState>

      <div v-else-if="recoveryCodes" class="card__body">
        <h3>{{ t('tenantApp.security.recoveryCodes') }}</h3>
        <RecoveryCodes :codes="recoveryCodes" @done="codesSaved" />
      </div>

      <div v-else-if="setup" class="card__body">
        <ol class="steps">
          <li>
            <p>{{ t('tenantApp.security.scan') }}</p>
            <img
              :src="qrSrc"
              class="qr"
              width="192"
              height="192"
              :alt="t('tenantApp.security.qrAlt')"
            />
            <Button
              v-if="!secretShown"
              variant="link"
              size="small"
              :label="t('tenantApp.security.cantScan')"
              @click="secretShown = true"
            />
            <div v-else class="secret">
              <span>{{ t('tenantApp.security.enterKey') }}</span>
              <code dir="ltr">{{ groupedSecret }}</code>
            </div>
          </li>
          <li>
            <p>{{ t('tenantApp.security.enterCode') }}</p>
            <form class="confirm" @submit.prevent="confirmCode">
              <div dir="ltr">
                <InputOtp
                  :model-value="code"
                  :length="6"
                  integer-only
                  :disabled="confirming"
                  :invalid="!!codeError"
                  :aria-label="t('tenantApp.twoFactor.code')"
                  @update:model-value="onCodeInput"
                />
              </div>
              <small v-if="codeError" class="field__error" role="alert">{{ codeError }}</small>
              <div class="actions">
                <Button
                  type="submit"
                  :label="t('tenantApp.security.activate')"
                  :loading="confirming"
                  :disabled="code.length !== 6"
                />
                <Button
                  :label="t('common.cancel')"
                  severity="secondary"
                  variant="text"
                  @click="setup = null"
                />
              </div>
            </form>
          </li>
        </ol>
      </div>

      <div v-else-if="status?.enabled" class="card__body">
        <p class="muted">
          {{
            t(
              'tenantApp.security.codesLeft',
              { count: status.recovery_codes_left },
              status.recovery_codes_left,
            )
          }}
        </p>
        <Message v-if="status.recovery_codes_left <= 2" severity="warn" :closable="false">{{
          t('tenantApp.security.codesLow')
        }}</Message>
        <div class="actions">
          <Button
            icon="pi pi-refresh"
            :label="t('tenantApp.security.newCodes')"
            severity="secondary"
            variant="outlined"
            @click="ask('newCodes')"
          />
          <Button
            icon="pi pi-times"
            :label="t('tenantApp.security.disable')"
            severity="danger"
            variant="text"
            :disabled="status.required"
            @click="ask('disable')"
          />
        </div>
        <small v-if="status.required" class="muted">{{
          t('tenantApp.security.requiredCannotDisable')
        }}</small>
      </div>

      <div v-else class="card__body">
        <Button
          icon="pi pi-shield"
          :label="t('tenantApp.security.enable')"
          @click="ask('enable')"
        />
      </div>
    </section>

    <PasswordConfirmDialog
      v-model:visible="dialogOpen"
      :title="dialog.title"
      :description="dialog.description"
      :confirm-label="dialog.confirmLabel"
      :destructive="dialog.destructive"
      :loading="dialogBusy"
      :error="dialogError"
      @confirm="onPassword"
    />
  </div>
</template>

<style scoped>
.security {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 720px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}
.card__icon {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 8px;
  background: var(--surface-sunken);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card__title {
  flex: 1;
  min-width: 0;
}
.card__title h2 {
  margin: 0;
  font: var(--text-h3);
}
.card__title p,
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.card__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
}
.card__body h3 {
  margin: 0;
  font: var(--fw-semibold) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.card__body > :deep(.codes) {
  align-self: stretch;
}
.steps {
  margin: 0;
  padding-inline-start: 20px;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.steps li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
.steps p {
  margin: 0;
}
.qr {
  padding: var(--space-2);
  background: #fff;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.secret {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font: var(--text-small);
  color: var(--text-secondary);
}
.secret code {
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--text-primary);
}
.confirm {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.field__error {
  font: var(--text-caption);
  color: var(--sev-danger-fg);
}
</style>
