<script setup lang="ts">
// A session's waitlist (US-04.10 – US-04.13, brief 05 §7): the queue with each client's place, join
// time and held credit (none in MVP-1), then how earlier entries ended. Staff reorder the queue,
// promote someone now (over capacity only with an override and a reason) or remove an entry, and
// set the session's own waitlist rules.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import OverrideDialog from '@/components/patterns/OverrideDialog.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type SessionDetails, type WaitlistEntry } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ session: SessionDetails }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const format = useFormat()

const waiting = computed(() => props.session.waitlist_entries.filter((e) => e.status === 'Waiting'))
const closed = computed(() => props.session.waitlist_entries.filter((e) => e.status !== 'Waiting'))
const open = computed(() => !props.session.locked)
const canManage = computed(() => open.value && auth.can('bookings.update'))
const canPromote = computed(() => open.value && auth.can('bookings.create'))
const full = computed(
  () => props.session.capacity !== null && props.session.booked >= props.session.capacity,
)
const busy = ref(false)

function fail(e: unknown) {
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 5000 })
}

// Reorder (audited)
async function move(entry: WaitlistEntry, by: -1 | 1) {
  const ids = waiting.value.map((e) => e.id)
  const at = ids.indexOf(entry.id)
  const to = at + by
  if (to < 0 || to >= ids.length) return
  ;[ids[at], ids[to]] = [ids[to]!, ids[at]!]
  busy.value = true
  try {
    await tenantApi.waitlist.reorder(props.session.id, ids)
    emit('changed')
  } catch (e) {
    fail(e)
    emit('changed')
  } finally {
    busy.value = false
  }
}

// Promote now; a full session needs an override with a reason.
const promoting = ref<WaitlistEntry | null>(null)
const overrideOpen = ref(false)
async function promote(entry: WaitlistEntry, reason?: string) {
  if (full.value && reason === undefined) {
    promoting.value = entry
    overrideOpen.value = true
    return
  }
  busy.value = true
  try {
    await tenantApi.waitlist.promote(
      entry.id,
      reason ? { override: true, override_reason: reason } : {},
    )
    toast.add({
      severity: 'success',
      summary: t('waitlist.promoted', { name: entry.client.name }),
      life: 4000,
    })
    overrideOpen.value = false
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

// Remove, with a reason
const removing = ref<WaitlistEntry | null>(null)
const removeOpen = ref(false)
async function remove(reason: string) {
  if (!removing.value) return
  busy.value = true
  try {
    await tenantApi.waitlist.remove(removing.value.id, reason)
    removeOpen.value = false
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

// The session's own rules; "inherit" leaves a setting to the service, branch or organization.
const settingsOpen = ref(false)
const form = ref({
  enabled: null as boolean | null,
  mode: null as string | null,
  max: null as number | null,
  closes: null as number | null,
})
function openSettings() {
  const own = props.session.session_policy
  form.value = {
    enabled: own.waitlist_enabled ?? null,
    mode: own.waitlist_mode ?? null,
    max: own.waitlist_max_size ?? null,
    closes: own.waitlist_closes_minutes ?? null,
  }
  settingsOpen.value = true
}
const effective = computed(() => props.session.policy)
const modeOptions = computed(() => [
  { value: null, label: t('waitlist.inherit') },
  { value: 'automatic', label: t('bookingPolicy.modes.automatic') },
  { value: 'manual', label: t('bookingPolicy.modes.manual') },
])
const enabledOptions = computed(() => [
  { value: null, label: t('waitlist.inherit') },
  { value: true, label: t('bookingPolicy.onOff.true') },
  { value: false, label: t('bookingPolicy.onOff.false') },
])
const summary = computed(() =>
  [
    effective.value.waitlist_enabled
      ? t(`bookingPolicy.modes.${effective.value.waitlist_mode}`)
      : t('bookingPolicy.onOff.false'),
    effective.value.waitlist_enabled
      ? t('bookingPolicy.units.people', effective.value.waitlist_max_size)
      : null,
    effective.value.waitlist_enabled
      ? t('bookingPolicy.units.minutes', effective.value.waitlist_closes_minutes)
      : null,
  ]
    .filter(Boolean)
    .join(' · '),
)
async function saveSettings() {
  busy.value = true
  try {
    await tenantApi.waitlist.settings(props.session.id, {
      waitlist_enabled: form.value.enabled,
      waitlist_mode: form.value.mode,
      waitlist_max_size: form.value.max,
      waitlist_closes_minutes: form.value.closes,
    })
    settingsOpen.value = false
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="panel waitlist">
    <div class="waitlist__bar">
      <span class="waitlist__summary"
        ><i class="pi pi-list" aria-hidden="true" /> {{ t('waitlist.title') }}: {{ summary }}</span
      >
      <Button
        v-if="canManage"
        size="small"
        variant="text"
        icon="pi pi-cog"
        :label="t('waitlist.settings')"
        @click="openSettings"
      />
    </div>

    <EmptyState
      v-if="!session.waitlist_entries.length"
      icon="pi-list"
      :title="t('sessionPage.noWaitlist')"
      :body="t('sessionPage.noWaitlistHint')"
    />
    <ol v-else class="waitlist__list">
      <li v-for="(e, i) in waiting" :key="e.id" class="waitlist__row">
        <span class="waitlist__place num">#{{ e.place }}</span>
        <RouterLink :to="{ name: 'tenant.client', params: { id: e.client.id } }" class="who">
          <PersonAvatar :name="e.client.name ?? ''" :image="e.client.photo_url" />
          <span>
            <span class="who__name">{{ e.client.name }}</span>
            <small class="muted">
              {{
                t('waitlist.joined', {
                  date: format.dateTime(e.joined_at, session.location.timezone),
                })
              }}
              · {{ t('waitlist.noCredit') }}</small
            >
          </span>
        </RouterLink>
        <span v-if="canManage" class="waitlist__order">
          <Button
            icon="pi pi-arrow-up"
            size="small"
            variant="text"
            severity="secondary"
            :disabled="busy || i === 0"
            :aria-label="t('waitlist.up', { name: e.client.name })"
            @click="move(e, -1)"
          />
          <Button
            icon="pi pi-arrow-down"
            size="small"
            variant="text"
            severity="secondary"
            :disabled="busy || i === waiting.length - 1"
            :aria-label="t('waitlist.down', { name: e.client.name })"
            @click="move(e, 1)"
          />
        </span>
        <Button
          v-if="canPromote"
          size="small"
          variant="outlined"
          :label="t('waitlist.promote')"
          :disabled="busy || (full && !auth.can('bookings.override'))"
          v-tooltip.top="
            full && !auth.can('bookings.override') ? t('waitlist.fullNoOverride') : undefined
          "
          @click="promote(e)"
        />
        <Button
          v-if="canManage"
          icon="pi pi-trash"
          size="small"
          variant="text"
          severity="secondary"
          :aria-label="t('waitlist.remove', { name: e.client.name })"
          :disabled="busy"
          @click="
            () => {
              removing = e
              removeOpen = true
            }
          "
        />
      </li>
      <li v-for="e in closed" :key="e.id" class="waitlist__row waitlist__row--closed">
        <span class="waitlist__place" />
        <span class="who">
          <PersonAvatar :name="e.client.name ?? ''" :image="e.client.photo_url" />
          <span>
            <span class="who__name">{{ e.client.name }}</span>
            <small v-if="e.reason" class="muted">{{ e.reason }}</small>
          </span>
        </span>
        <StatusTag :status="e.status" size="sm" />
      </li>
    </ol>
  </div>

  <OverrideDialog
    v-model:visible="overrideOpen"
    :title="t('waitlist.promoteOver', { name: promoting?.client.name })"
    :description="t('waitlist.promoteOverBody')"
    :confirm-label="t('waitlist.promote')"
    :loading="busy"
    @confirm="(reason: string) => promoting && promote(promoting, reason)"
  />
  <OverrideDialog
    v-model:visible="removeOpen"
    :title="t('waitlist.removeTitle', { name: removing?.client.name })"
    :confirm-label="t('waitlist.removeConfirm')"
    :loading="busy"
    destructive
    @confirm="remove"
  />
  <Dialog
    v-model:visible="settingsOpen"
    modal
    :header="t('waitlist.settings')"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="settings">
      <Message severity="secondary" :closable="false" icon="pi pi-info-circle">{{
        t('waitlist.settingsHint')
      }}</Message>
      <div class="field">
        <span id="wl-enabled" class="field__label">{{
          t('bookingPolicy.fields.waitlist_enabled')
        }}</span>
        <SelectButton
          v-model="form.enabled"
          :options="enabledOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="wl-enabled"
        />
      </div>
      <div class="field">
        <span id="wl-mode" class="field__label">{{ t('bookingPolicy.fields.waitlist_mode') }}</span>
        <SelectButton
          v-model="form.mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-labelledby="wl-mode"
        />
      </div>
      <div class="field">
        <label for="wl-max" class="field__label">{{
          t('bookingPolicy.fields.waitlist_max_size')
        }}</label>
        <InputNumber
          v-model="form.max"
          input-id="wl-max"
          :min="0"
          :max="500"
          :placeholder="
            t('waitlist.inheritValue', {
              value: t('bookingPolicy.units.people', effective.waitlist_max_size),
            })
          "
          show-buttons
        />
      </div>
      <div class="field">
        <label for="wl-closes" class="field__label">{{
          t('bookingPolicy.fields.waitlist_closes_minutes')
        }}</label>
        <InputNumber
          v-model="form.closes"
          input-id="wl-closes"
          :min="0"
          :max="10080"
          :step="15"
          :placeholder="
            t('waitlist.inheritValue', {
              value: t('bookingPolicy.units.minutes', effective.waitlist_closes_minutes),
            })
          "
          show-buttons
        />
      </div>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="settingsOpen = false"
      />
      <Button :label="t('common.save')" :loading="busy" @click="saveSettings" />
    </template>
  </Dialog>
</template>

<style scoped>
.waitlist__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
}
.waitlist__summary {
  font: var(--text-small);
  color: var(--text-secondary);
}
.waitlist__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.waitlist__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.waitlist__row--closed {
  opacity: 0.7;
}
.waitlist__place {
  width: 32px;
  font: 600 14px var(--font-sans);
  color: var(--text-secondary);
}
.waitlist__order {
  display: inline-flex;
}
.who {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.who > span {
  display: flex;
  flex-direction: column;
}
.who__name {
  font: 500 14px/1.4 var(--font-sans);
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  font: 500 14px var(--font-sans);
}
</style>
