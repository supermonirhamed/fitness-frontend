<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
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

function discard() {
  selected.value = [...saved.value]
  saveError.value = null
}

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
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <div v-for="n in 2" :key="n" class="skeleton-row">
      <Skeleton width="40%" /><Skeleton height="120px" />
    </div>
  </SettingsCard>

  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>

  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('tenantApp.securitySettings.loadError')" @retry="load" />
  </SettingsCard>

  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="affectsMe && dirty" severity="info" :closable="false">{{
      t('tenantApp.securitySettings.affectsMe')
    }}</Message>
    <Message v-if="saveError" severity="error" :closable="false" role="alert">{{
      saveError
    }}</Message>
    <SettingsCard>
      <SettingRow
        :label="t('tenantApp.securitySettings.requireFor')"
        :help="t('tenantApp.securitySettings.requireHint')"
      >
        <label v-for="role in roles" :key="role" class="role">
          <Checkbox v-model="selected" :value="role" :input-id="`role-${role}`" />
          <span>{{ roleLabel(role) }}</span>
        </label>
      </SettingRow>
    </SettingsCard>
    <UnsavedBar
      v-if="dirty"
      :saving="saving"
      :save-label="t('tenantApp.securitySettings.save')"
      @discard="discard"
      @save="save"
    />
  </form>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  padding: 16px 0;
}
.role {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 28px;
  cursor: pointer;
}
</style>
