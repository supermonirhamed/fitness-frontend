<script setup lang="ts">
// The team (US-09.02): staff members filtered by role, branch, service and status, with their
// roles, branches and services; managers see their own branches' staff. Add a staff member
// (US-09.01), and decide time off requests waiting for approval (US-09.04).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import StaffFormDialog from '@/components/staff/StaffFormDialog.vue'
import { tenantApi, type Service, type StaffMember } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, te } = useI18n()
const router = useRouter()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const staff = ref<StaffMember[]>([])
const roles = ref<string[]>([])
const services = ref<Service[]>([])
const q = ref('')
const role = ref<string | null>(null)
const locationId = ref<number | null>(null)
const serviceId = ref<number | null>(null)
const status = ref<string | null>(null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)
const branchName = (id: number) => branches.value.find((b) => b.id === id)?.name ?? `#${id}`

let seq = 0
async function load() {
  const mine = ++seq
  try {
    const result = await tenantApi.staff.list({
      q: q.value.trim() || undefined,
      role: role.value ?? undefined,
      location_id: locationId.value ?? undefined,
      service_id: serviceId.value ?? undefined,
      status: status.value ?? undefined,
    })
    if (mine !== seq) return
    staff.value = result.data
    roles.value = result.roles.map((r) => r.name)
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch([q, role, locationId, serviceId, status], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})

// Time off waiting for a manager.
const pending = ref<Awaited<ReturnType<typeof tenantApi.staff.pendingTimeOff>>>([])
const canDecide = computed(() => auth.can('staff.update') || auth.can('schedule.override_staff'))
async function loadPending() {
  if (canDecide.value) pending.value = await tenantApi.staff.pendingTimeOff().catch(() => [])
}
async function decide(id: number, approve: boolean) {
  await tenantApi.staff.decideTimeOff(id, approve).catch(() => null)
  toast.add({
    severity: 'success',
    summary: t(approve ? 'availability.approved' : 'availability.rejected'),
    life: 3000,
  })
  await loadPending()
}

onMounted(async () => {
  load()
  loadPending()
  if (auth.can('services.view')) services.value = await tenantApi.services.list().catch(() => [])
})

const statusOptions = computed(() =>
  (['Active', 'Invited', 'Deactivated'] as const).map((s) => ({
    value: s,
    label: t(`access.status.${s}`),
  })),
)
const SEVERITY = { Active: 'success', Invited: 'info', Deactivated: 'secondary' } as const
const formOpen = ref(false)
function onSaved(member: StaffMember) {
  toast.add({
    severity: 'success',
    summary: t(member.has_login ? 'team.invited' : 'team.created', { name: member.name }),
    life: 4000,
  })
  router.push({ name: 'tenant.staff.member', params: { id: member.id } })
}
const open = (m: StaffMember) => router.push({ name: 'tenant.staff.member', params: { id: m.id } })
</script>

<template>
  <section class="team">
    <div v-if="pending.length" class="card pending">
      <strong>{{ t('team.pendingTitle', pending.length) }}</strong>
      <div v-for="p in pending" :key="p.id" class="pending__row">
        <span>{{ p.user.name }}</span>
        <span class="num"
          >{{ format.dateTime(p.starts_at) }} – {{ format.dateTime(p.ends_at) }}</span
        >
        <span class="muted">{{ p.reason }}</span>
        <span v-if="p.sessions" class="bad">{{ t('staffAvailability.overlaps', p.sessions) }}</span>
        <Button :label="t('staffAvailability.approve')" size="small" @click="decide(p.id, true)" />
        <Button
          :label="t('staffAvailability.reject')"
          size="small"
          variant="text"
          severity="danger"
          @click="decide(p.id, false)"
        />
      </div>
    </div>

    <div class="toolbar">
      <InputText
        v-model="q"
        :placeholder="t('team.search')"
        :aria-label="t('team.search')"
        class="search"
      />
      <Select
        v-model="role"
        :options="roles.map((r) => ({ value: r, label: roleLabel(r) }))"
        option-label="label"
        option-value="value"
        :placeholder="t('team.anyRole')"
        show-clear
      />
      <Select
        v-if="branches.length > 1"
        v-model="locationId"
        :options="branches"
        option-label="name"
        option-value="id"
        :placeholder="t('clients.filters.anyBranch')"
        show-clear
      />
      <Select
        v-if="services.length"
        v-model="serviceId"
        :options="services"
        option-label="display_name"
        option-value="id"
        :placeholder="t('team.anyService')"
        show-clear
        filter
      />
      <Select
        v-model="status"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('team.activeAndInvited')"
        show-clear
      />
      <span class="spacer" />
      <Button
        v-if="auth.can('staff.create')"
        :label="t('team.add')"
        icon="pi pi-user-plus"
        @click="formOpen = true"
      />
    </div>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <ErrorState v-else-if="state === 'error'" class="card" @retry="load" />
    <DataTable
      v-else
      :value="staff"
      data-key="id"
      :loading="state === 'loading'"
      row-hover
      class="card"
      :row-class="() => 'row-click'"
      @row-click="open($event.data)"
    >
      <template #empty>
        <EmptyState compact icon="pi-users" :title="t('team.empty')" />
      </template>
      <Column :header="t('access.columns.person')">
        <template #body="{ data }">
          <span class="person">
            <PersonAvatar :name="data.name" :image="data.photo_url" />
            <span>
              <strong>{{ data.name }}</strong>
              <small class="muted ltr-isolate">{{ data.email ?? t('team.noLogin') }}</small>
            </span>
          </span>
        </template>
      </Column>
      <Column :header="t('access.columns.roles')">
        <template #body="{ data }">
          <span class="tags">
            <Tag
              v-for="r in data.roles"
              :key="r"
              severity="secondary"
              class="tag-sm"
              :value="roleLabel(r)"
            />
          </span>
        </template>
      </Column>
      <Column :header="t('access.columns.locations')">
        <template #body="{ data }">
          <span v-if="data.all_locations || data.owner" class="muted">{{ t('access.all') }}</span>
          <span v-else class="muted">{{
            data.location_ids.map(branchName).join('، ') || '—'
          }}</span>
        </template>
      </Column>
      <Column :header="t('team.services')">
        <template #body="{ data }">
          <span class="muted">{{
            (data.services ?? []).map((s: { name: string }) => s.name).join('، ') || '—'
          }}</span>
        </template>
      </Column>
      <Column :header="t('access.columns.status')">
        <template #body="{ data }">
          <Tag
            :severity="SEVERITY[data.status as keyof typeof SEVERITY]"
            class="tag-sm"
            :value="t(`access.status.${data.status}`)"
          />
          <Tag
            v-if="data.certifications_expiring.length"
            severity="warn"
            class="tag-sm"
            icon="pi pi-exclamation-triangle"
            :value="t('team.certExpiring')"
          />
        </template>
      </Column>
    </DataTable>

    <StaffFormDialog v-model:visible="formOpen" :member="null" :roles="roles" @saved="onSaved" />
  </section>
</template>

<style scoped>
.team {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search {
  min-width: 220px;
}
.spacer {
  flex: 1;
}
.person {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}
.person > span {
  display: flex;
  flex-direction: column;
}
.tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.bad {
  font: var(--text-small);
  color: var(--sev-danger-fg, var(--red-600));
}
.pending {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-color: var(--sev-warn-border, #f59e0b);
}
.pending__row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
:deep(.row-click) {
  cursor: pointer;
}
</style>
