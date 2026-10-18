<script setup lang="ts">
// My membership & credits (US-11.18): each membership or package with status, dates, credits left
// and their history, what it covers, and the next renewal. When the organization allows it:
// auto-renewal off/on, a freeze (with what it changes first), an upgrade request for staff, and
// cancelling at the end of the period.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { clientApi, type MyMembership } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'

const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const items = ref<MyMembership[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const open = ref<number | null>(null)
const day = (ymd: string | null) => (ymd ? showDay(format, ymd) : '—')
const ymd = (d: Date | null) =>
  d
    ? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
        .join('-')
    : ''
const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: firstMessage(e) ?? t('common.genericError'), life: 4000 })
const ok = (summary: string) => toast.add({ severity: 'success', summary, life: 3000 })

async function load() {
  state.value = 'loading'
  try {
    items.value = await clientApi.memberships.list()
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function toggleRenew(m: MyMembership, on: boolean) {
  try {
    items.value = await clientApi.memberships.autoRenew(m.id, on)
    ok(on ? t('app.memberships.renewOn') : t('app.memberships.renewOff'))
  } catch (e) {
    fail(e)
  }
}

// Freeze: preview first, then confirm (bookings inside are cancelled free).
const freezing = ref<MyMembership | null>(null)
const range = ref<Date[] | null>(null)
const preview = ref<{
  days: number
  fee: number
  ends_on: string | null
  bookings: unknown[]
} | null>(null)
const busy = ref(false)
const dialogError = ref<string | null>(null)
async function loadPreview() {
  preview.value = null
  dialogError.value = null
  const [a, b] = range.value ?? []
  if (!freezing.value || !a || !b) return
  try {
    preview.value = await clientApi.memberships.freezePreview(freezing.value.id, {
      starts_on: ymd(a),
      ends_on: ymd(b),
    })
  } catch (e) {
    dialogError.value = firstMessage(e) ?? t('common.genericError')
  }
}
async function freeze() {
  const [a, b] = range.value ?? []
  if (!freezing.value || !a || !b) return
  busy.value = true
  try {
    items.value = await clientApi.memberships.freeze(freezing.value.id, {
      starts_on: ymd(a),
      ends_on: ymd(b),
      cancel_bookings: true,
    })
    freezing.value = null
    ok(t('app.memberships.frozen'))
  } catch (e) {
    dialogError.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}

// Cancel at the end of the period, with a reason.
const cancelling = ref<MyMembership | null>(null)
const reason = ref<string | null>(null)
const note = ref('')
const REASONS = ['moving', 'price', 'schedule', 'health', 'dissatisfied', 'competitor', 'other']
async function cancel() {
  if (!cancelling.value || !reason.value) return
  busy.value = true
  try {
    items.value = await clientApi.memberships.cancel(cancelling.value.id, {
      reason: reason.value,
      note: note.value.trim() || null,
    })
    cancelling.value = null
    ok(t('app.memberships.cancelled'))
  } catch (e) {
    dialogError.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}

const upgrading = ref<MyMembership | null>(null)
async function upgrade() {
  if (!upgrading.value) return
  busy.value = true
  try {
    await clientApi.memberships.upgrade(upgrading.value.id, note.value.trim() || null)
    upgrading.value = null
    ok(t('app.memberships.upgradeSent'))
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
const start = (kind: 'freeze' | 'cancel' | 'upgrade', m: MyMembership) => {
  dialogError.value = null
  note.value = ''
  reason.value = null
  range.value = null
  preview.value = null
  if (kind === 'freeze') freezing.value = m
  if (kind === 'cancel') cancelling.value = m
  if (kind === 'upgrade') upgrading.value = m
}
const covers = (m: MyMembership) =>
  [
    m.covers.all_services
      ? t('app.shop.allClasses')
      : [...m.covers.categories, ...m.covers.services, ...m.covers.programs].join(', '),
    m.covers.locations.length ? m.covers.locations.join(', ') : t('app.shop.allBranches'),
  ].join(' · ')
</script>

<template>
  <div class="ca-stack">
    <RouterLink :to="{ name: 'app.account' }" class="ca-small back"
      ><i class="pi pi-arrow-left pi-dir" aria-hidden="true" />
      {{ t('app.nav.account') }}</RouterLink
    >
    <div class="ca-spread">
      <h1 class="ca-title">{{ t('app.account.memberships') }}</h1>
      <RouterLink :to="{ name: 'app.shop' }" class="ca-small">{{ t('app.shop.title') }}</RouterLink>
    </div>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="120px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <div v-else-if="!items.length" class="ca-card">
      <EmptyState compact icon="pi-id-card" :title="t('app.memberships.none')">
        <RouterLink :to="{ name: 'app.shop' }">{{ t('app.shop.title') }}</RouterLink>
      </EmptyState>
    </div>
    <ul v-else class="ca-stack plain">
      <li v-for="m in items" :key="m.id" class="ca-card item">
        <div class="ca-spread">
          <strong>{{ m.name }}</strong>
          <StatusTag :status="m.status" size="sm" />
        </div>
        <Message v-if="m.awaiting_payment" severity="warn" :closable="false">{{
          t('app.shop.startsWhenPaid')
        }}</Message>
        <template v-if="m.credits_total">
          <ProgressBar
            :value="Math.round(((m.credits_left ?? 0) / m.credits_total) * 100)"
            :show-value="false"
            class="bar"
          />
          <span class="ca-small">{{
            t('app.home.credits', { left: m.credits_left, total: m.credits_total })
          }}</span>
        </template>
        <span class="ca-small"
          >{{ day(m.starts_on) }} –
          {{ m.ends_on ? day(m.ends_on) : t('app.memberships.ongoing') }}</span
        >
        <span v-if="m.renews_on" class="ca-small">{{
          m.renewal_amount !== null
            ? t('app.memberships.renews', {
                date: day(m.renews_on),
                amount: format.money(m.renewal_amount),
              })
            : t('app.memberships.renewsOn', { date: day(m.renews_on) })
        }}</span>
        <span v-if="m.cancelled" class="ca-small warn">{{
          t('app.memberships.endsAfterCancel', { date: day(m.ends_on) })
        }}</span>
        <span v-if="m.freeze" class="ca-small">{{
          t('app.memberships.freezeLine', {
            from: day(m.freeze.starts_on),
            to: day(m.freeze.ends_on),
          })
        }}</span>
        <span class="ca-muted ca-small">{{ covers(m) }}</span>

        <div v-if="m.can.auto_renew" class="ca-spread">
          <label :for="`renew-${m.id}`" class="ca-small">{{
            t('app.memberships.autoRenew')
          }}</label>
          <ToggleSwitch
            :model-value="m.auto_renew"
            :input-id="`renew-${m.id}`"
            @update:model-value="toggleRenew(m, $event)"
          />
        </div>
        <div class="ca-row actions">
          <Button
            v-if="m.history.length"
            :label="open === m.id ? t('app.memberships.hideHistory') : t('app.memberships.history')"
            variant="text"
            size="small"
            @click="open = open === m.id ? null : m.id"
          />
          <Button
            v-if="m.can.freeze"
            :label="t('app.memberships.freeze')"
            variant="text"
            size="small"
            @click="start('freeze', m)"
          />
          <Button
            v-if="m.can.upgrade"
            :label="t('app.memberships.upgrade')"
            variant="text"
            size="small"
            @click="start('upgrade', m)"
          />
          <Button
            v-if="m.can.cancel && m.recurring"
            :label="t('app.memberships.cancel')"
            variant="text"
            severity="danger"
            size="small"
            @click="start('cancel', m)"
          />
        </div>
        <ul v-if="open === m.id" class="ca-list history">
          <li v-for="(h, i) in m.history" :key="i" class="ca-spread ca-small">
            <span
              >{{ t(`app.memberships.ledger.${h.kind}`, h.kind) }} ·
              {{ h.at ? format.date(h.at) : '' }}</span
            >
            <span class="ca-num"
              >{{ h.change > 0 ? '+' : '' }}{{ h.change }} → {{ h.balance_after }}</span
            >
          </li>
        </ul>
      </li>
    </ul>

    <FormDialog
      :visible="!!freezing"
      :title="t('app.memberships.freezeTitle')"
      :subtitle="freezing?.name ?? ''"
      :save-label="t('app.memberships.freeze')"
      :saving="busy"
      :save-disabled="!preview"
      :error="dialogError"
      @update:visible="(v: boolean) => !v && (freezing = null)"
      @save="freeze"
    >
      <FormField
        :label="t('app.memberships.freezeDates')"
        for="fz-range"
        :help="
          freezing?.freeze_policy
            ? t('app.memberships.freezeRules', {
                min: freezing.freeze_policy.min_days ?? 1,
                max: freezing.freeze_policy.max_days ?? '—',
              })
            : undefined
        "
      >
        <DatePicker
          v-model="range"
          input-id="fz-range"
          selection-mode="range"
          :min-date="new Date()"
          date-format="yy-mm-dd"
          show-icon
          fluid
          @update:model-value="loadPreview"
        />
      </FormField>
      <Message v-if="preview" severity="info" :closable="false">
        {{ t('app.memberships.freezePreview', { days: preview.days, date: day(preview.ends_on) }) }}
        <template v-if="preview.fee">
          {{ t('app.memberships.freezeFee', { fee: format.money(preview.fee) }) }}</template
        >
        <template v-if="preview.bookings.length">
          {{ t('app.memberships.freezeBookings', { n: preview.bookings.length }) }}</template
        >
      </Message>
    </FormDialog>

    <FormDialog
      :visible="!!cancelling"
      :title="t('app.memberships.cancelTitle')"
      :subtitle="cancelling?.name ?? ''"
      :save-label="t('app.memberships.cancel')"
      :saving="busy"
      :save-disabled="!reason"
      :error="dialogError"
      danger
      @update:visible="(v: boolean) => !v && (cancelling = null)"
      @save="cancel"
    >
      <p class="ca-small">{{ t('app.memberships.cancelBody') }}</p>
      <FormField :label="t('app.memberships.reason')" for="mc-reason">
        <Select
          v-model="reason"
          input-id="mc-reason"
          :options="REASONS.map((r) => ({ value: r, label: t(`app.memberships.reasons.${r}`) }))"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
      <FormField :label="t('app.memberships.note')" for="mc-note">
        <Textarea id="mc-note" v-model="note" rows="2" auto-resize maxlength="500" fluid />
      </FormField>
    </FormDialog>

    <FormDialog
      :visible="!!upgrading"
      :title="t('app.memberships.upgradeTitle')"
      :subtitle="upgrading?.name ?? ''"
      :save-label="t('app.memberships.sendRequest')"
      :saving="busy"
      @update:visible="(v: boolean) => !v && (upgrading = null)"
      @save="upgrade"
    >
      <p class="ca-small">{{ t('app.memberships.upgradeBody') }}</p>
      <FormField :label="t('app.memberships.note')" for="up-note">
        <Textarea id="up-note" v-model="note" rows="3" auto-resize maxlength="500" fluid />
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.back {
  color: var(--text-secondary);
  text-decoration: none;
}
.plain {
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bar {
  height: 6px;
}
.actions {
  flex-wrap: wrap;
  gap: 4px 8px;
}
.history li {
  padding: 6px 0;
}
.warn {
  color: var(--sev-warn-fg);
}
</style>
