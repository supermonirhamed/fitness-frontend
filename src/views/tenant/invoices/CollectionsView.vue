<script setup lang="ts">
// Unpaid and overdue follow-up (US-07.11): the clients who owe money at the user's branches, with
// the total owed, the overdue part, the oldest due date and the memberships the invoices are for,
// oldest first. Staff send payment reminders to one client or to the ones they pick; the email
// goes to clients who have one, and other channels follow with notifications (EP-12).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import NoPermission from '@/components/patterns/NoPermission.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import { tenantApi, type CollectionRow } from '@/api/tenant'
import { statusOf } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
const rows = ref<CollectionRow[]>([])
const totals = ref<{ clients: number; owed: number; overdue: number } | null>(null)
const search = ref('')
const which = ref<'all' | 'overdue'>('overdue')
const locationId = ref<number | null>(null)
const branches = computed(() => auth.user?.switchable_locations ?? [])
const selected = ref<CollectionRow[]>([])

let seq = 0
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const result = await tenantApi.collections.list({
      q: search.value.trim() || undefined,
      location_id: locationId.value ?? undefined,
      overdue: which.value === 'overdue',
    })
    if (mine !== seq) return
    rows.value = result.data
    totals.value = result.totals
    selected.value = []
    state.value = 'ready'
  } catch (e) {
    if (mine === seq) state.value = statusOf(e) === 403 ? 'forbidden' : 'error'
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch([search, which, locationId], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
onMounted(load)

const whichOptions = computed(() =>
  (['overdue', 'all'] as const).map((v) => ({ value: v, label: t(`collections.which.${v}`) })),
)

const sending = ref(false)
async function remind(list: CollectionRow[]) {
  const ids = list.map((r) => r.client?.id).filter((id): id is number => !!id)
  if (!ids.length) return
  sending.value = true
  try {
    const result = await tenantApi.collections.remind(ids)
    toast.add({
      severity: result.sent ? 'success' : 'warn',
      summary: t('collections.sent', result.sent),
      detail: result.skipped.length
        ? t('collections.skipped', { n: result.skipped.length })
        : undefined,
      life: 4000,
    })
    await load()
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  } finally {
    sending.value = false
  }
}
const openClient = (r: CollectionRow) =>
  r.client &&
  router.push({ name: 'tenant.client', params: { id: r.client.id }, query: { tab: 'payments' } })
</script>

<template>
  <div class="page">
    <PageHeader :title="t('collections.title')">
      <template #meta>
        <span>{{ t('collections.subtitle') }}</span>
      </template>
      <template v-if="auth.can('payments.create')" #actions>
        <Button
          :label="t('collections.remindSelected', { n: selected.length })"
          icon="pi pi-send"
          :disabled="!selected.length"
          :loading="sending"
          @click="remind(selected)"
        />
      </template>
    </PageHeader>

    <NoPermission v-if="state === 'forbidden'" class="card" />
    <template v-else>
      <div v-if="totals" class="stats">
        <div class="stat card">
          <span class="stat__label">{{ t('collections.clients') }}</span>
          <strong class="num">{{ totals.clients }}</strong>
        </div>
        <div class="stat card">
          <span class="stat__label">{{ t('collections.owed') }}</span>
          <strong class="num">{{ format.money(totals.owed) }}</strong>
        </div>
        <div class="stat card stat--danger">
          <span class="stat__label">{{ t('collections.overdue') }}</span>
          <strong class="num">{{ format.money(totals.overdue) }}</strong>
        </div>
      </div>

      <div class="filters card">
        <InputText
          v-model="search"
          :placeholder="t('collections.search')"
          class="search"
          :aria-label="t('collections.search')"
        />
        <SelectButton
          v-model="which"
          :options="whichOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
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
      </div>

      <ErrorState v-if="state === 'error'" class="card" @retry="load" />
      <DataTable
        v-else
        v-model:selection="selected"
        :value="rows"
        :data-key="(r: CollectionRow) => String(r.client?.id)"
        :loading="state === 'loading'"
        row-hover
        class="card"
      >
        <template #empty>
          <EmptyState
            compact
            icon="pi-check-circle"
            :title="t('collections.empty')"
            :body="t('collections.emptyHint')"
          />
        </template>
        <Column
          v-if="auth.can('payments.create')"
          selection-mode="multiple"
          header-style="width: 3rem"
        />
        <Column :header="t('invoices.payer')">
          <template #body="{ data }">
            <button v-if="data.client" type="button" class="who" @click="openClient(data)">
              <PersonAvatar :name="data.client.name" :image="data.client.photo_url" size="sm" />
              <span>
                <strong>{{ data.client.name }}</strong>
                <small class="muted">{{ data.client.member_id }}</small>
              </span>
            </button>
          </template>
        </Column>
        <Column :header="t('collections.memberships')">
          <template #body="{ data }">
            <span v-if="!data.memberships.length" class="muted">—</span>
            <span v-for="m in data.memberships" :key="m.id" class="membership">
              {{ m.name }}
              <Tag class="tag-sm" severity="secondary" :value="t(`status.${m.status}`, m.status)" />
            </span>
          </template>
        </Column>
        <Column :header="t('collections.oldestDue')">
          <template #body="{ data }">
            <span :class="{ late: data.overdue > 0 }">{{
              data.oldest_due_on ? format.date(data.oldest_due_on) : '—'
            }}</span>
            <div class="muted">{{ t('collections.invoices', data.invoices) }}</div>
          </template>
        </Column>
        <Column :header="t('collections.owed')" header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <span class="num">{{ format.money(data.owed) }}</span>
            <div v-if="data.overdue" class="late num">
              {{ t('collections.overdueAmount', { amount: format.money(data.overdue) }) }}
            </div>
          </template>
        </Column>
        <Column :header="t('collections.lastReminder')">
          <template #body="{ data }">
            <span class="muted">{{
              data.last_reminded_at
                ? format.dateTime(data.last_reminded_at)
                : t('collections.never')
            }}</span>
          </template>
        </Column>
        <Column v-if="auth.can('payments.create')" header-class="row-end" body-class="row-end">
          <template #body="{ data }">
            <Button
              v-tooltip.top="data.client?.has_email ? undefined : t('collections.noEmail')"
              :label="t('collections.remind')"
              icon="pi pi-send"
              size="small"
              variant="outlined"
              :disabled="sending || !data.client?.has_email"
              @click="remind([data])"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 720px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
.stat {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat strong {
  font: 600 20px var(--font-sans);
}
.stat__label {
  font: var(--text-small);
  color: var(--text-muted);
}
.stat--danger strong,
.late {
  color: var(--sev-danger-fg, var(--red-600));
}
.filters {
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.search {
  min-width: 240px;
  flex: 1;
}
.who {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  text-align: start;
  color: inherit;
  font: inherit;
}
.who span {
  display: flex;
  flex-direction: column;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.membership {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-inline-end: 8px;
}
:deep(.row-end) {
  text-align: end;
}
</style>
