<script setup lang="ts">
// Settings → Memberships: how many days a renewal invoice may stay unpaid before the membership is
// suspended (no booking or check-in until it is paid, US-06.10), and how many days before the end
// the "membership expiring" notice goes out (US-06.14), and which kind of membership or package pays
// for a booking first (US-06.16).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import SettingRow from '@/components/patterns/SettingRow.vue'
import SettingsCard from '@/components/patterns/SettingsCard.vue'
import UnsavedBar from '@/components/patterns/UnsavedBar.vue'
import { tenantApi, type MembershipSettings } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const canEdit = computed(() => auth.can('settings.update'))

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
type Values = MembershipSettings
const saved = ref<Values>({
  grace_days: 7,
  expiry_notice_days: 7,
  resolver_order: ['unlimited', 'limited', 'package'],
})
const form = ref<Values>(copy(saved.value))
function copy(v: Values): Values {
  return { ...v, resolver_order: [...v.resolver_order] }
}
function move(i: number, by: -1 | 1) {
  const order = form.value.resolver_order
  ;[order[i], order[i + by]] = [order[i + by]!, order[i]!]
}
const saving = ref(false)
const error = ref<string | null>(null)
const dirty = computed(
  () =>
    form.value.grace_days !== saved.value.grace_days ||
    form.value.expiry_notice_days !== saved.value.expiry_notice_days ||
    form.value.resolver_order.join() !== saved.value.resolver_order.join(),
)

async function load() {
  state.value = 'loading'
  try {
    saved.value = await tenantApi.membershipSettings.get()
    form.value = copy(saved.value)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
onMounted(load)

async function save() {
  saving.value = true
  error.value = null
  try {
    saved.value = await tenantApi.membershipSettings.update(form.value)
    form.value = copy(saved.value)
    toast.add({ severity: 'success', summary: t('membershipSettings.saved'), life: 3000 })
  } catch {
    error.value = t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsCard v-if="state === 'loading'" aria-busy="true" :aria-label="t('common.loading')">
    <Skeleton height="48px" />
  </SettingsCard>
  <SettingsCard v-else-if="state === 'forbidden'"><NoPermission /></SettingsCard>
  <SettingsCard v-else-if="state === 'error'">
    <ErrorState :title="t('membershipSettings.loadError')" @retry="load" />
  </SettingsCard>
  <form v-else class="stack" @submit.prevent="save">
    <Message v-if="!canEdit" severity="secondary" :closable="false">{{
      t('regional.readOnly')
    }}</Message>
    <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
    <SettingsCard>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('membershipSettings.renewals') }}
      </div>
      <SettingRow
        :label="t('membershipSettings.graceLabel')"
        :help="t('membershipSettings.graceHelp')"
        :example="t('membershipSettings.graceExample', { n: form.grace_days })"
        label-for="membership-grace"
      >
        <InputNumber
          v-model="form.grace_days"
          input-id="membership-grace"
          :min="0"
          :max="90"
          :allow-empty="false"
          :suffix="` ${t('plans.units.days')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('membershipSettings.expiry') }}
      </div>
      <SettingRow
        :label="t('membershipSettings.noticeLabel')"
        :help="t('membershipSettings.noticeHelp')"
        :example="t('membershipSettings.noticeExample', { n: form.expiry_notice_days })"
        label-for="membership-notice"
      >
        <InputNumber
          v-model="form.expiry_notice_days"
          input-id="membership-notice"
          :min="0"
          :max="60"
          :allow-empty="false"
          :suffix="` ${t('plans.units.days')}`"
          :disabled="!canEdit"
          show-buttons
          class="number"
        />
      </SettingRow>
      <div class="settings-group" role="heading" aria-level="3">
        {{ t('membershipSettings.paying') }}
      </div>
      <SettingRow
        :label="t('membershipSettings.orderLabel')"
        :help="t('membershipSettings.orderHelp')"
      >
        <ol class="order">
          <li v-for="(kind, i) in form.resolver_order" :key="kind">
            <span class="order__n num">{{ i + 1 }}</span>
            <span class="order__name">{{ t(`membershipSettings.kinds.${kind}`) }}</span>
            <Button
              icon="pi pi-arrow-up"
              size="small"
              variant="text"
              severity="secondary"
              :disabled="!canEdit || i === 0"
              :aria-label="t('membershipSettings.moveUp')"
              @click="move(i, -1)"
            />
            <Button
              icon="pi pi-arrow-down"
              size="small"
              variant="text"
              severity="secondary"
              :disabled="!canEdit || i === form.resolver_order.length - 1"
              :aria-label="t('membershipSettings.moveDown')"
              @click="move(i, 1)"
            />
          </li>
        </ol>
      </SettingRow>
    </SettingsCard>
    <UnsavedBar
      v-if="canEdit && dirty"
      :saving="saving"
      @discard="form = copy(saved)"
      @save="save"
    />
  </form>
</template>

<style scoped>
.order {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 260px;
}
.order li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
}
.order__n {
  width: 20px;
  color: var(--text-muted);
}
.order__name {
  flex: 1;
  font: 500 14px var(--font-sans);
}
.number {
  max-width: 220px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
