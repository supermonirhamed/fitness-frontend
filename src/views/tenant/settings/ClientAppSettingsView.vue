<script setup lang="ts">
// Settings → Client app (US-11.01/02): turn the members' app on at /app, the brand colour, what
// clients may do in it (sign up, book, buy, see prices and coaches, book before paying, freeze,
// enroll children), sign-in by SMS code, terms links, how long staff have for deletion requests,
// and which classes are bookable and which plans are sold online. Changes apply at once and are
// audited.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type ClientAppAdmin, type ClientAppSettings } from '@/api/tenant'
import { statusOf, validationErrors, type ValidationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))
const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const EMPTY: ClientAppSettings = {
  enabled: false,
  self_registration: true,
  online_booking: true,
  online_sales: true,
  show_prices: true,
  show_coaches: true,
  book_before_payment: false,
  self_freeze: false,
  online_academy_enrollment: false,
  otp_sign_in: false,
  primary_color: '#0b55d9',
  deletion_days: 30,
  waitlist_notify_top: 0,
  terms_url: null,
  privacy_url: null,
}
const data = ref<ClientAppAdmin>({ settings: { ...EMPTY }, services: [], plans: [] })
const form = ref<ClientAppSettings>({ ...EMPTY })
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(data.value.settings))
const appUrl = `${window.location.origin}/app`

/** The switches, in the order of US-11.02. */
const TOGGLES = [
  'self_registration',
  'online_booking',
  'online_sales',
  'show_prices',
  'show_coaches',
  'book_before_payment',
  'self_freeze',
  'online_academy_enrollment',
  'otp_sign_in',
] as const

async function load() {
  state.value = 'loading'
  try {
    data.value = await tenantApi.clientApp.settings()
    form.value = { ...data.value.settings }
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  saving.value = true
  errors.value = {}
  try {
    data.value = await tenantApi.clientApp.updateSettings(form.value)
    form.value = { ...data.value.settings }
    toast.add({ severity: 'success', summary: t('clientAppSettings.saved'), life: 3000 })
  } catch (e) {
    errors.value = validationErrors(e)
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}

async function toggleProduct(kind: 'services' | 'plans', id: number, value: boolean) {
  try {
    data.value = await tenantApi.clientApp.updateProducts(
      kind === 'services'
        ? { services: [{ id, online_booking: value }] }
        : { plans: [{ id, online_sale: value }] },
    )
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
    await load()
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <Skeleton height="48px" />
  </SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('clientAppSettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <SettingsCard>
      <SettingRow
        :label="t('clientAppSettings.enabledLabel')"
        :help="t('clientAppSettings.enabledHelp')"
        label-for="ca-enabled"
      >
        <ToggleSwitch v-model="form.enabled" input-id="ca-enabled" :disabled="!canEdit" />
      </SettingRow>
      <p v-if="data.settings.enabled" class="link">
        <i class="pi pi-mobile" aria-hidden="true" />
        <a :href="appUrl" target="_blank" rel="noopener" dir="ltr">{{ appUrl }}</a>
      </p>
      <SettingRow
        :label="t('clientAppSettings.colorLabel')"
        :help="t('clientAppSettings.colorHelp')"
        label-for="ca-color"
      >
        <div class="color">
          <input
            v-model="form.primary_color"
            type="color"
            :disabled="!canEdit"
            :aria-label="t('clientAppSettings.colorLabel')"
          />
          <InputText
            id="ca-color"
            v-model="form.primary_color"
            :invalid="!!errors.primary_color"
            :disabled="!canEdit"
            dir="ltr"
            class="hex"
          />
        </div>
      </SettingRow>
    </SettingsCard>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('clientAppSettings.featuresTitle') }}
      </div>
      <SettingRow
        v-for="key in TOGGLES"
        :key="key"
        :label="t(`clientAppSettings.toggles.${key}.label`)"
        :help="t(`clientAppSettings.toggles.${key}.help`)"
        :label-for="`ca-${key}`"
      >
        <ToggleSwitch v-model="form[key]" :input-id="`ca-${key}`" :disabled="!canEdit" />
      </SettingRow>
    </SettingsCard>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('clientAppSettings.policiesTitle') }}
      </div>
      <SettingRow
        :label="t('clientAppSettings.deletionLabel')"
        :help="t('clientAppSettings.deletionHelp')"
        label-for="ca-deletion"
      >
        <InputNumber
          v-model="form.deletion_days"
          input-id="ca-deletion"
          :min="1"
          :max="90"
          :allow-empty="false"
          :suffix="` ${t('clientAppSettings.days')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('clientAppSettings.waitlistTopLabel')"
        :help="t('clientAppSettings.waitlistTopHelp')"
        label-for="ca-waitlist-top"
      >
        <InputNumber
          v-model="form.waitlist_notify_top"
          input-id="ca-waitlist-top"
          :min="0"
          :max="100"
          :allow-empty="false"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <SettingRow
        :label="t('clientAppSettings.termsLabel')"
        label-for="ca-terms"
        :help="errors.terms_url?.[0]"
      >
        <InputText
          id="ca-terms"
          v-model="form.terms_url"
          type="url"
          dir="ltr"
          placeholder="https://"
          :invalid="!!errors.terms_url"
          :disabled="!canEdit"
          class="url"
        />
      </SettingRow>
      <SettingRow
        :label="t('clientAppSettings.privacyLabel')"
        label-for="ca-privacy"
        :help="errors.privacy_url?.[0]"
      >
        <InputText
          id="ca-privacy"
          v-model="form.privacy_url"
          type="url"
          dir="ltr"
          placeholder="https://"
          :invalid="!!errors.privacy_url"
          :disabled="!canEdit"
          class="url"
        />
      </SettingRow>
    </SettingsCard>

    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('clientAppSettings.servicesTitle') }}
      </div>
      <p class="hint">{{ t('clientAppSettings.servicesHelp') }}</p>
      <ul class="products">
        <li v-for="s in data.services" :key="s.id">
          <span
            >{{ s.name }}
            <Tag
              severity="secondary"
              :value="t(`catalog.types.${s.activity_type.replace(' ', '')}`)"
              class="tag-sm"
          /></span>
          <ToggleSwitch
            :model-value="s.online_booking"
            :disabled="!canEdit"
            :aria-label="s.name ?? ''"
            @update:model-value="toggleProduct('services', s.id, $event)"
          />
        </li>
      </ul>
    </SettingsCard>
    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('clientAppSettings.plansTitle') }}
      </div>
      <p class="hint">{{ t('clientAppSettings.plansHelp') }}</p>
      <ul class="products">
        <li v-for="p in data.plans" :key="p.id">
          <span
            >{{ p.name }}
            <Tag
              severity="secondary"
              :value="t(`clientAppSettings.kinds.${p.kind}`)"
              class="tag-sm"
          /></span>
          <ToggleSwitch
            :model-value="p.online_sale"
            :disabled="!canEdit"
            :aria-label="p.name"
            @update:model-value="toggleProduct('plans', p.id, $event)"
          />
        </li>
      </ul>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="form = { ...data.settings }"
      @save="save"
    />
  </form>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.number {
  width: 160px;
}
.url {
  width: min(100%, 320px);
}
.color {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color input[type='color'] {
  width: 40px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: none;
}
.hex {
  width: 110px;
}
.link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 0 12px;
}
.hint {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0 0 8px;
}
.products {
  list-style: none;
  margin: 0;
  padding: 0;
}
.products li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border-default);
}
</style>
