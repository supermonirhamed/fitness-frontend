<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import { tenantApi } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const toast = useToast()
const router = useRouter()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const roles = ref<string[]>([])
const saved = ref<string[]>([])
const selected = ref<string[]>([])
const saving = ref(false)
const saveError = ref<string | null>(null)

const roleLabel = (role: string) => (te(`roles.${role}`) ? t(`roles.${role}`) : role)
const dirty = computed(
  () => [...selected.value].sort().join('|') !== [...saved.value].sort().join('|'),
)
// The owner turns the rule on for their own role without having 2FA yet: say what happens next.
const affectsMe = computed(
  () =>
    !auth.user?.two_factor_enabled &&
    (auth.user?.roles ?? []).some((role) => selected.value.includes(role)),
)

function apply(settings: { roles: string[]; two_factor_required_roles: string[] }) {
  roles.value = settings.roles
  saved.value = settings.two_factor_required_roles
  selected.value = [...settings.two_factor_required_roles]
}

async function load() {
  state.value = 'loading'
  try {
    apply(await tenantApi.security.get())
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  saving.value = true
  saveError.value = null
  try {
    apply(await tenantApi.security.update(selected.value))
    toast.add({ severity: 'success', summary: t('tenantApp.securitySettings.saved'), life: 4000 })
    if (affectsMe.value && (await auth.check(true)) && auth.user?.two_factor_required)
      await router.replace({ name: 'tenant.security', query: { required: '1' } })
  } catch (e) {
    if (statusOf(e) === 403) state.value = 'forbidden'
    else saveError.value = t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="settings">
    <section class="card">
      <div
        v-if="state === 'loading'"
        class="card__body"
        aria-busy="true"
        :aria-label="t('common.loading')"
      >
        <Skeleton v-for="n in 4" :key="n" height="24px" width="50%" />
      </div>

      <EmptyState
        v-else-if="state === 'forbidden'"
        icon="pi-lock"
        :title="t('tenantApp.securitySettings.forbidden')"
        :body="t('tenantApp.securitySettings.forbiddenHint')"
      />

      <EmptyState
        v-else-if="state === 'error'"
        icon="pi-exclamation-triangle"
        :title="t('tenantApp.securitySettings.loadError')"
      >
        <Button
          severity="secondary"
          variant="outlined"
          icon="pi pi-replay pi-dir"
          :label="t('common.retry')"
          @click="load"
        />
      </EmptyState>

      <form v-else class="card__body" @submit.prevent="save">
        <fieldset class="roles">
          <legend>{{ t('tenantApp.securitySettings.requireFor') }}</legend>
          <p class="muted">{{ t('tenantApp.securitySettings.requireHint') }}</p>
          <label v-for="role in roles" :key="role" class="role">
            <Checkbox v-model="selected" :value="role" :input-id="`role-${role}`" />
            <span>{{ roleLabel(role) }}</span>
          </label>
        </fieldset>
        <Message v-if="affectsMe && dirty" severity="info" :closable="false">{{
          t('tenantApp.securitySettings.affectsMe')
        }}</Message>
        <Message v-if="saveError" severity="error" :closable="false" role="alert">{{
          saveError
        }}</Message>
        <div class="footer">
          <span class="audit"
            ><i class="pi pi-shield" aria-hidden="true" />{{ t('override.auditNote') }}</span
          >
          <Button
            type="submit"
            :label="t('tenantApp.securitySettings.save')"
            :disabled="!dirty"
            :loading="saving"
          />
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.settings {
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
.card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
}
.roles {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.roles legend {
  padding: 0;
  margin-bottom: var(--space-1);
  font: var(--text-h3);
}
.muted {
  margin: 0 0 var(--space-2);
  font: var(--text-small);
  color: var(--text-secondary);
}
.role {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.audit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
</style>
