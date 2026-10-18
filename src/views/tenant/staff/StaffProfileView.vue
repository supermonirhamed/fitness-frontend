<script setup lang="ts">
// A staff member's profile (US-09.02): Info (contact, employment, coach profile), Roles & branches,
// Services they deliver (US-09.03, with sessions to reassign when one is taken off), Availability
// and time off (US-09.04), the next two weeks' Schedule, Hours delivered (US-09.06), Pay rates
// (US-09.07, staff.pay_rates) and Activity.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import AvailabilityPanel from '@/components/staff/AvailabilityPanel.vue'
import StaffFormDrawer from '@/components/staff/StaffFormDrawer.vue'
import {
  tenantApi,
  type PayRate,
  type PayRateInput,
  type ReassignSession,
  type Service,
  type StaffProfile,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const route = useRoute()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const id = computed(() => Number(route.params.id))
const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const branchName = (bid: number) => branches.value.find((b) => b.id === bid)?.name ?? `#${bid}`

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const member = ref<StaffProfile | null>(null)
const roles = ref<string[]>([])
async function load() {
  try {
    member.value = await tenantApi.staff.get(id.value)
    state.value = 'ready'
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(async () => {
  load()
  roles.value = (
    await tenantApi.staff.list({ status: 'Active' }).catch(() => ({ roles: [] }))
  ).roles.map((r) => r.name)
})
const tab = ref(typeof route.query.tab === 'string' ? route.query.tab : 'info')
const canEdit = computed(() => auth.can('staff.update'))
const manages = computed(() => canEdit.value || auth.can('schedule.override_staff'))

// Info
const editing = ref(false)
async function invite() {
  try {
    await tenantApi.staff.invite(id.value)
    toast.add({
      severity: 'success',
      summary: t('team.inviteSent', { email: member.value?.email }),
      life: 3000,
    })
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  }
}
const photoInput = ref<HTMLInputElement | null>(null)
async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await tenantApi.staff.uploadPhoto(id.value, file).catch(() => null)
  await load()
}

// Services (US-09.03)
const allServices = ref<Service[]>([])
const serviceIds = ref<number[]>([])
const reassign = ref<ReassignSession[]>([])
const savingServices = ref(false)
watch(member, (m) => (serviceIds.value = (m?.services ?? []).map((s) => s.id)))
watch(
  tab,
  async (value) => {
    if (value === 'services' && !allServices.value.length)
      allServices.value = await tenantApi.services.list().catch(() => [])
    if (value === 'hours') loadHours()
    if (value === 'pay' && auth.can('staff.pay_rates')) loadRates()
  },
  { immediate: true },
)
async function saveServices() {
  savingServices.value = true
  try {
    const result = await tenantApi.staff.services(id.value, serviceIds.value)
    reassign.value = result.reassign
    toast.add({ severity: 'success', summary: t('staffProfile.servicesSaved'), life: 3000 })
    await load()
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    savingServices.value = false
  }
}

// Hours (US-09.06)
const hoursRange = ref<(Date | null)[] | null>([
  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  new Date(),
])
const hours = ref<Awaited<ReturnType<typeof tenantApi.staff.hoursFor>> | null>(null)
async function loadHours() {
  hours.value = await tenantApi.staff
    .hoursFor(id.value, {
      from: hoursRange.value?.[0] ? isoDay(hoursRange.value[0]) : undefined,
      to: hoursRange.value?.[1] ? isoDay(hoursRange.value[1]) : undefined,
    })
    .catch(() => null)
}
watch(hoursRange, () => tab.value === 'hours' && loadHours(), { deep: true })

// Pay rates (US-09.07)
const rates = ref<PayRate[]>([])
async function loadRates() {
  rates.value = await tenantApi.staff.payRates(id.value).catch(() => [])
}
const rateOpen = ref(false)
const rateId = ref<number | null>(null)
const rate = ref<Partial<PayRateInput>>({ type: 'per_session', applies_to: 'sessions' })
const rateError = ref<string | null>(null)
const RATE_TYPES = ['hourly', 'per_session', 'per_attendee', 'revenue_percent'] as const
function editRate(r: PayRate | null) {
  rateId.value = r?.id ?? null
  rate.value = r ? { ...r } : { type: 'per_session', applies_to: 'sessions', amount: null }
  rateError.value = null
  rateOpen.value = true
  if (!allServices.value.length)
    tenantApi.services
      .list()
      .then((s) => (allServices.value = s))
      .catch(() => null)
}
async function saveRate() {
  rateError.value = null
  try {
    if (rateId.value) await tenantApi.staff.updatePayRate(rateId.value, rate.value)
    else await tenantApi.staff.addPayRate(id.value, rate.value)
    rateOpen.value = false
    await loadRates()
  } catch (e) {
    rateError.value = apiMessage(e) ?? t('common.genericError')
  }
}
async function deleteRate(r: PayRate) {
  await tenantApi.staff.deletePayRate(r.id).catch(() => null)
  await loadRates()
}
const rateValue = (r: PayRate) =>
  r.type === 'revenue_percent'
    ? `${r.percent}%`
    : `${format.money(r.amount ?? 0)}${r.type === 'per_attendee' && (r.min_amount || r.max_amount) ? ` (${format.money(r.min_amount ?? 0)}–${r.max_amount ? format.money(r.max_amount) : '∞'})` : ''}`
const rateScope = (r: PayRate) =>
  [
    r.applies_to === 'shifts' ? t('payRates.shifts') : null,
    r.location,
    r.service,
    r.series_id ? t('payRates.series', { id: r.series_id }) : null,
    r.scheduled_session_id ? t('payRates.session', { id: r.scheduled_session_id }) : null,
  ]
    .filter(Boolean)
    .join(' · ') || t('payRates.everything')
</script>

<template>
  <EmptyState
    v-if="state === 'missing'"
    class="panel"
    icon="pi-user"
    :title="t('staffProfile.missing')"
  />
  <ErrorState v-else-if="state === 'error'" class="panel" @retry="load" />
  <div v-else-if="member" class="profile">
    <header class="head panel">
      <button
        type="button"
        class="avatar"
        :disabled="!canEdit"
        :aria-label="t('staffProfile.changePhoto')"
        @click="photoInput?.click()"
      >
        <PersonAvatar :name="member.name" :image="member.photo_url" size="xl" />
      </button>
      <input ref="photoInput" type="file" accept="image/*" hidden @change="onPhoto" />
      <div class="head__who">
        <h2>{{ member.name }}</h2>
        <span class="tags">
          <Tag
            v-for="r in member.roles"
            :key="r"
            class="tag-sm"
            severity="secondary"
            :value="roleLabel(r)"
          />
          <Tag class="tag-sm" :value="t(`access.status.${member.status}`)" />
          <Tag
            class="tag-sm"
            severity="secondary"
            :value="t(`staffForm.employment.${member.employment_type}`)"
          />
          <Tag
            v-if="!member.has_login"
            class="tag-sm"
            severity="secondary"
            :value="t('team.noLogin')"
          />
        </span>
        <span class="muted ltr-isolate">{{
          [member.email, member.phone].filter(Boolean).join(' · ')
        }}</span>
      </div>
      <span class="head__actions">
        <Button
          v-if="canEdit && member.status === 'Invited' && member.has_login"
          :label="t('team.resendInvite')"
          icon="pi pi-send"
          variant="outlined"
          size="small"
          @click="invite"
        />
        <Button
          v-if="canEdit"
          :label="t('staffProfile.edit')"
          icon="pi pi-pencil"
          size="small"
          @click="editing = true"
        />
      </span>
    </header>

    <Tabs v-model:value="tab" scrollable>
      <TabList>
        <Tab value="info">{{ t('staffProfile.tabs.info') }}</Tab>
        <Tab value="access">{{ t('staffProfile.tabs.access') }}</Tab>
        <Tab value="services">{{ t('staffProfile.tabs.services') }}</Tab>
        <Tab value="availability">{{ t('staffProfile.tabs.availability') }}</Tab>
        <Tab value="schedule">{{ t('staffProfile.tabs.schedule') }}</Tab>
        <Tab value="hours">{{ t('staffProfile.tabs.hours') }}</Tab>
        <Tab v-if="auth.can('staff.pay_rates')" value="pay">{{ t('staffProfile.tabs.pay') }}</Tab>
        <Tab value="activity">{{ t('staffProfile.tabs.activity') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="info">
          <dl class="panel facts">
            <dt>{{ t('staffForm.bioEn') }}</dt>
            <dd>{{ member.bio.en || '—' }}</dd>
            <dt>{{ t('staffForm.bioAr') }}</dt>
            <dd dir="rtl">{{ member.bio.ar || '—' }}</dd>
            <dt>{{ t('staffForm.specialties') }}</dt>
            <dd>{{ member.specialties.join('، ') || '—' }}</dd>
            <dt>{{ t('staffForm.certifications') }}</dt>
            <dd>
              <span v-if="!member.certifications.length">—</span>
              <div v-for="c in member.certifications" :key="c.name">
                {{ c.name }}
                <span
                  v-if="c.expires_on"
                  :class="{ bad: member.certifications_expiring.some((e) => e.name === c.name) }"
                >
                  · {{ t('staffProfile.expires', { date: format.date(c.expires_on) }) }}
                </span>
              </div>
            </dd>
            <dt>{{ t('staffForm.showOnApp') }}</dt>
            <dd>{{ member.show_on_app ? t('staffProfile.yes') : t('staffProfile.no') }}</dd>
          </dl>
        </TabPanel>

        <TabPanel value="access">
          <dl class="panel facts">
            <dt>{{ t('staffForm.roles') }}</dt>
            <dd>{{ member.roles.map(roleLabel).join('، ') }}</dd>
            <dt>{{ t('staffForm.branches') }}</dt>
            <dd>
              {{
                member.all_locations || member.owner
                  ? t('access.all')
                  : member.location_ids.map(branchName).join('، ') || '—'
              }}
            </dd>
            <dt>{{ t('staffForm.hasLogin') }}</dt>
            <dd>{{ member.has_login ? t('staffProfile.yes') : t('staffProfile.no') }}</dd>
          </dl>
        </TabPanel>

        <TabPanel value="services">
          <div class="panel stack">
            <p class="muted">{{ t('staffProfile.servicesHint') }}</p>
            <MultiSelect
              v-model="serviceIds"
              :options="allServices"
              option-label="display_name"
              option-value="id"
              display="chip"
              filter
              :disabled="!canEdit"
              :placeholder="t('staffProfile.anyService')"
              fluid
            />
            <div v-if="canEdit">
              <Button
                :label="t('common.save')"
                size="small"
                :loading="savingServices"
                @click="saveServices"
              />
            </div>
            <Message v-if="reassign.length" severity="warn" :closable="false">
              {{ t('staffProfile.reassign', { n: reassign.length }) }}
              <ul class="reassign">
                <li v-for="s in reassign" :key="s.id">
                  <RouterLink :to="{ name: 'tenant.session', params: { id: s.id } }">{{
                    s.title
                  }}</RouterLink>
                  · {{ format.dateTime(s.starts_at) }}
                </li>
              </ul>
            </Message>
          </div>
        </TabPanel>

        <TabPanel value="availability">
          <AvailabilityPanel
            v-if="tab === 'availability'"
            :user-id="member.id"
            :location-ids="member.all_locations ? [] : member.location_ids"
            :can-edit="manages"
            :can-decide="manages"
          />
        </TabPanel>

        <TabPanel value="schedule">
          <div class="panel">
            <EmptyState
              v-if="!member.schedule.length"
              compact
              icon="pi-calendar"
              :title="t('staffProfile.noSchedule')"
            />
            <ul v-else class="list">
              <li v-for="s in member.schedule" :key="s.id">
                <span class="num">{{ format.dateTime(s.starts_at, s.timezone ?? undefined) }}</span>
                <RouterLink :to="{ name: 'tenant.session', params: { id: s.id } }">{{
                  s.title
                }}</RouterLink>
                <span class="muted">{{ s.location }}</span>
              </li>
            </ul>
          </div>
        </TabPanel>

        <TabPanel value="hours">
          <div class="panel stack">
            <DatePicker
              v-model="hoursRange"
              selection-mode="range"
              :manual-input="false"
              show-icon
              icon-display="input"
              class="range"
            />
            <div v-if="hours?.summary" class="stats">
              <span
                ><strong class="num">{{ hours.summary.sessions }}</strong>
                {{ t('staffHours.sessions') }}</span
              >
              <span
                ><strong class="num">{{ hours.summary.appointments }}</strong>
                {{ t('staffHours.appointments') }}</span
              >
              <span
                ><strong class="num">{{ hours.summary.session_hours }}</strong>
                {{ t('staffHours.sessionHours') }}</span
              >
              <span
                ><strong class="num">{{ hours.summary.shift_hours }}</strong>
                {{ t('staffHours.shiftHours') }}</span
              >
              <span
                ><strong class="num">{{ hours.summary.attendees_per_session ?? '—' }}</strong>
                {{ t('staffHours.perSession') }}</span
              >
            </div>
            <DataTable :value="hours?.sessions ?? []" data-key="id" size="small">
              <template #empty
                ><EmptyState compact icon="pi-clock" :title="t('staffHours.empty')"
              /></template>
              <Column :header="t('bookings.columns.when')">
                <template #body="{ data }"
                  ><span class="num">{{ format.dateTime(data.starts_at) }}</span></template
                >
              </Column>
              <Column :header="t('bookings.columns.session')">
                <template #body="{ data }">
                  {{ data.title }}
                  <div v-if="data.substitute_for" class="muted">
                    {{ t('staffHours.covering', { name: data.substitute_for }) }}
                  </div>
                </template>
              </Column>
              <Column :header="t('invoices.branch')"
                ><template #body="{ data }">{{ data.location }}</template></Column
              >
              <Column :header="t('staffHours.minutes')"
                ><template #body="{ data }"
                  ><span class="num">{{ data.minutes }}</span></template
                ></Column
              >
              <Column :header="t('staffHours.attendees')"
                ><template #body="{ data }"
                  ><span class="num">{{ data.attendees }}</span></template
                ></Column
              >
            </DataTable>
          </div>
        </TabPanel>

        <TabPanel value="pay">
          <div class="panel stack">
            <p class="muted">{{ t('payRates.hint') }}</p>
            <EmptyState
              v-if="!rates.length"
              compact
              icon="pi-money-bill"
              :title="t('payRates.empty')"
            />
            <ul v-else class="list">
              <li v-for="r in rates" :key="r.id">
                <strong>{{ t(`payRates.types.${r.type}`) }}</strong>
                <span class="num">{{ rateValue(r) }}</span>
                <span class="muted">{{ rateScope(r) }}</span>
                <Button
                  icon="pi pi-pencil"
                  variant="text"
                  size="small"
                  :aria-label="t('staffProfile.edit')"
                  @click="editRate(r)"
                />
                <Button
                  icon="pi pi-trash"
                  variant="text"
                  size="small"
                  severity="secondary"
                  :aria-label="t('staffForm.remove')"
                  @click="deleteRate(r)"
                />
              </li>
            </ul>
            <div>
              <Button
                :label="t('payRates.add')"
                icon="pi pi-plus"
                size="small"
                variant="outlined"
                @click="editRate(null)"
              />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="activity">
          <div class="panel">
            <EmptyState
              v-if="!member.activity.length"
              compact
              icon="pi-history"
              :title="t('staffProfile.noActivity')"
            />
            <ul v-else class="list">
              <li v-for="(a, i) in member.activity" :key="i">
                <span class="num">{{ a.at ? format.dateTime(a.at) : '' }}</span>
                <span>{{
                  te(`audit.actions.${a.action.replace(/\./g, '_')}`)
                    ? t(`audit.actions.${a.action.replace(/\./g, '_')}`)
                    : a.action
                }}</span>
                <span class="muted">{{ a.by }}</span>
              </li>
            </ul>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <StaffFormDrawer v-model:visible="editing" :member="member" :roles="roles" @saved="load" />
    <FormDialog
      v-model:visible="rateOpen"
      :title="rateId ? t('payRates.edit') : t('payRates.add')"
      icon="pi-money-bill"
      size="sm"
      :save-label="t('common.save')"
      :error="rateError"
      @save="saveRate"
    >
      <FormField :label="t('payRates.type')" for="rate-type" required>
        <Select
          v-model="rate.type"
          input-id="rate-type"
          :options="RATE_TYPES.map((v) => ({ value: v, label: t(`payRates.types.${v}`) }))"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
      <FormField v-if="rate.type === 'hourly'" :label="t('payRates.appliesTo')" for="rate-applies">
        <Select
          v-model="rate.applies_to"
          input-id="rate-applies"
          :options="[
            { value: 'sessions', label: t('payRates.sessionsTaught') },
            { value: 'shifts', label: t('payRates.shifts') },
          ]"
          option-label="label"
          option-value="value"
          fluid
        />
      </FormField>
      <FormField
        v-if="rate.type === 'revenue_percent'"
        :label="t('payRates.percent')"
        for="rate-percent"
        required
      >
        <InputNumber
          v-model="rate.percent"
          input-id="rate-percent"
          :min="0"
          :max="100"
          suffix=" %"
          :max-fraction-digits="2"
          fluid
        />
      </FormField>
      <FormField v-else :label="t('payRates.amount')" for="rate-amount" required>
        <InputNumber
          v-model="rate.amount"
          input-id="rate-amount"
          :min="0"
          :max-fraction-digits="2"
          fluid
        />
      </FormField>
      <div v-if="rate.type === 'per_attendee'" class="pair">
        <FormField :label="t('payRates.min')" for="rate-min">
          <InputNumber
            v-model="rate.min_amount"
            input-id="rate-min"
            :min="0"
            :max-fraction-digits="2"
            fluid
          />
        </FormField>
        <FormField :label="t('payRates.max')" for="rate-max">
          <InputNumber
            v-model="rate.max_amount"
            input-id="rate-max"
            :min="0"
            :max-fraction-digits="2"
            fluid
          />
        </FormField>
      </div>
      <template v-if="rate.applies_to !== 'shifts'">
        <FormField :label="t('invoices.branch')" for="rate-branch">
          <Select
            v-model="rate.location_id"
            input-id="rate-branch"
            :options="branches"
            option-label="name"
            option-value="id"
            :placeholder="t('payRates.anyBranch')"
            show-clear
            fluid
          />
        </FormField>
        <FormField :label="t('team.services')" for="rate-service">
          <Select
            v-model="rate.service_id"
            input-id="rate-service"
            :options="allServices"
            option-label="display_name"
            option-value="id"
            :placeholder="t('payRates.anyService')"
            show-clear
            filter
            fluid
          />
        </FormField>
      </template>
    </FormDialog>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  padding: 14px 16px;
}
.head {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.avatar {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
.head__who {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head__who h2 {
  margin: 0;
  font: var(--text-h2, 600 20px var(--font-sans));
}
.head__actions {
  display: inline-flex;
  gap: 8px;
}
.tags {
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
}
.facts {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 10px 16px;
  margin: 0;
}
.facts dt {
  color: var(--text-muted);
}
.facts dd {
  margin: 0;
  white-space: pre-line;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list li {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.range {
  max-width: 280px;
}
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.reassign {
  margin: 6px 0 0;
  padding-inline-start: 18px;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
  margin: 0;
}
.bad {
  color: var(--sev-danger-fg, var(--red-600));
}
</style>
