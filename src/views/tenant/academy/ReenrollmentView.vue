<script setup lang="ts">
// Re-enrollment for a term (US-10.14): the admin invites the current players of the previous term,
// suggesting the same group or the next level's, with a priority date before enrollment opens to
// new families. Answers per group (accepted / pending / declined / expired), and each family's
// answer recorded at the desk (from MVP-4 in their account).
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { tenantApi, type AcademyReenrollment, type AcademyTerm } from '@/api/tenant'
import { addDays, fromYmd, showDay } from '@/lib/academy'
import { apiMessage } from '@/lib/apiErrors'
import { isoDay } from '@/lib/audit'
import { statusOf, validationErrors } from '@/lib/http'
import { useFormat } from '@/composables/useFormat'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ id: number }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const data = ref<AcademyReenrollment | null>(null)
const terms = ref<AcademyTerm[]>([])
async function load() {
  try {
    data.value = await tenantApi.academy.reenrollment.get(props.id)
    state.value = 'ready'
    if (!terms.value.length) {
      terms.value = await tenantApi.academy.terms.list(data.value.term.program_id).catch(() => [])
    }
  } catch (e) {
    state.value = statusOf(e) === 404 ? 'missing' : 'error'
  }
}
onMounted(load)
const totals = computed(() => {
  const offers = data.value?.offers ?? []
  const count = (s: string) => offers.filter((o) => o.status === s).length
  return {
    accepted: count('Accepted'),
    pending: count('Pending'),
    declined: count('Declined'),
    expired: count('Expired'),
  }
})

// Send offers
const sendOpen = ref(false)
const fromTerm = ref<number | null>(null)
const priorityUntil = ref<Date | null>(null)
const suggest = ref<'same' | 'next_level'>('same')
const sending = ref(false)
const sendError = ref<string | null>(null)
const suggestOptions = computed(() => [
  { value: 'same', label: t('academy.reenroll.same') },
  { value: 'next_level', label: t('academy.reenroll.nextLevel') },
])
const previousTerms = computed(() => terms.value.filter((tm) => tm.id !== props.id && !tm.archived))
function openSend() {
  fromTerm.value = data.value?.term.copied_from_id ?? previousTerms.value[0]?.id ?? null
  const opens = data.value?.term.enrollment_opens_on
  const today = isoDay(new Date())
  priorityUntil.value = fromYmd(opens && opens > today ? addDays(opens, -1) : addDays(today, 14))
  suggest.value = 'same'
  sendError.value = null
  sendOpen.value = true
}
async function send() {
  if (!priorityUntil.value) return
  sending.value = true
  sendError.value = null
  try {
    const result = await tenantApi.academy.reenrollment.send(props.id, {
      from_term_id: fromTerm.value,
      priority_until: isoDay(priorityUntil.value),
      suggest: suggest.value,
    })
    toast.add({
      severity: 'success',
      summary: t('academy.reenroll.sent', { n: result.offered }),
      detail: result.skipped ? t('academy.reenroll.skipped', { n: result.skipped }) : undefined,
      life: 5000,
    })
    sendOpen.value = false
    load()
  } catch (e) {
    sendError.value =
      Object.values(validationErrors(e))[0]?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    sending.value = false
  }
}

// Record an answer
type Offer = AcademyReenrollment['offers'][number]
const answering = ref<Offer | null>(null)
const answerOpen = computed({
  get: () => answering.value !== null,
  set: (v: boolean) => {
    if (!v) answering.value = null
  },
})
const answer = ref<'accept' | 'decline'>('accept')
const groupId = ref<number | null>(null)
const answerError = ref<string | null>(null)
const saving = ref(false)
const answerOptions = computed(() => [
  { value: 'accept', label: t('academy.reenroll.accept') },
  { value: 'decline', label: t('academy.reenroll.decline') },
])
function respond(offer: Offer) {
  answering.value = offer
  answer.value = 'accept'
  groupId.value = offer.suggested_group?.id ?? null
  answerError.value = null
}
async function saveAnswer() {
  if (!answering.value) return
  saving.value = true
  answerError.value = null
  try {
    await tenantApi.academy.reenrollment.respond(answering.value.id, {
      answer: answer.value,
      group_id: answer.value === 'accept' ? groupId.value : null,
    })
    toast.add({
      severity: 'success',
      summary:
        answer.value === 'accept' ? t('academy.reenroll.accepted') : t('academy.reenroll.declined'),
      life: 3000,
    })
    answering.value = null
    load()
  } catch (e) {
    answerError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div v-if="state === 'loading'" class="card pad" aria-busy="true">
      <Skeleton width="40%" height="28px" /><Skeleton height="120px" />
    </div>
    <EmptyState
      v-else-if="state === 'missing'"
      class="card"
      icon="pi-search"
      :title="t('academy.reenroll.notFound')"
    />
    <ErrorState v-else-if="state === 'error' || !data" class="card" @retry="load" />
    <template v-else>
      <PageHeader
        :title="t('academy.reenroll.title')"
        :subtitle="data.term.display_name ?? ''"
        :breadcrumb="[
          { label: t('academy.title'), to: { name: 'tenant.academy' } },
          ...(auth.can('services.view')
            ? [
                {
                  label: t('academy.tabs.terms'),
                  to: {
                    name: 'tenant.programs.show',
                    params: { id: data.term.program_id },
                    query: { tab: 'terms' },
                  },
                },
              ]
            : []),
          { label: data.term.display_name ?? '' },
        ]"
      >
        <template v-if="auth.can('academy.update')" #primary>
          <Button :label="t('academy.reenroll.send')" icon="pi pi-send" @click="openSend" />
        </template>
      </PageHeader>

      <div class="tiles">
        <div v-for="(n, key) in totals" :key="key" class="card tile">
          <span class="tile__value">{{ n }}</span>
          <span class="muted">{{ t(`academy.reenroll.statuses.${key}`) }}</span>
        </div>
      </div>

      <div class="card">
        <h2 class="card__title">{{ t('academy.reenroll.byGroup') }}</h2>
        <EmptyState
          v-if="!data.groups.length"
          compact
          icon="pi-sitemap"
          :title="t('academy.reenroll.noGroups')"
        />
        <DataTable v-else :value="data.groups" data-key="id" size="small">
          <Column :header="t('academy.groups.columns.group')">
            <template #body="{ data: g }">
              <RouterLink :to="{ name: 'tenant.academy.group', params: { id: g.id } }">{{
                g.display_name
              }}</RouterLink>
            </template>
          </Column>
          <Column :header="t('academy.reenroll.statuses.accepted')" field="accepted" />
          <Column :header="t('academy.reenroll.statuses.pending')" field="pending" />
          <Column :header="t('academy.reenroll.statuses.declined')" field="declined" />
          <Column :header="t('academy.reenroll.statuses.expired')" field="expired" />
          <Column :header="t('academy.groups.columns.places')">
            <template #body="{ data: g }"
              ><span dir="ltr">{{ g.enrolled }} / {{ g.capacity }}</span></template
            >
          </Column>
        </DataTable>
      </div>

      <div class="card">
        <h2 class="card__title">{{ t('academy.reenroll.families') }}</h2>
        <EmptyState
          v-if="!data.offers.length"
          compact
          icon="pi-send"
          :title="t('academy.reenroll.none')"
          :body="t('academy.reenroll.noneHint')"
        />
        <DataTable v-else :value="data.offers" data-key="id" size="small">
          <Column :header="t('academy.roster.player')">
            <template #body="{ data: o }">
              <strong>{{ o.client?.name }}</strong>
              <div class="muted small">{{ o.payer?.name }}</div>
            </template>
          </Column>
          <Column :header="t('academy.reenroll.current')">
            <template #body="{ data: o }">{{ o.current_group?.display_name ?? '—' }}</template>
          </Column>
          <Column :header="t('academy.reenroll.suggested')">
            <template #body="{ data: o }">{{
              (o.new_group ?? o.suggested_group)?.display_name ?? '—'
            }}</template>
          </Column>
          <Column :header="t('academy.reenroll.until')">
            <template #body="{ data: o }">{{ showDay(format, o.priority_until) }}</template>
          </Column>
          <Column :header="t('academy.groups.columns.status')">
            <template #body="{ data: o }"><StatusTag :status="o.status" size="sm" /></template>
          </Column>
          <Column>
            <template #body="{ data: o }">
              <Button
                v-if="o.status === 'Pending' && auth.can('academy.enroll')"
                :label="t('academy.reenroll.record')"
                size="small"
                variant="text"
                @click="respond(o)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </template>

    <FormDialog
      v-model:visible="sendOpen"
      :title="t('academy.reenroll.send')"
      :subtitle="data?.term.display_name ?? undefined"
      icon="pi-send"
      :saving="sending"
      :save-disabled="!priorityUntil || !fromTerm"
      :save-label="t('academy.reenroll.sendAction')"
      :error="sendError"
      @save="send"
    >
      <FormField :label="t('academy.reenroll.fromTerm')" for="re-from" required>
        <Select
          v-model="fromTerm"
          input-id="re-from"
          :options="previousTerms"
          option-label="display_name"
          option-value="id"
          fluid
        />
      </FormField>
      <FormField :label="t('academy.reenroll.suggest')">
        <SelectButton
          v-model="suggest"
          :options="suggestOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </FormField>
      <FormField
        :label="t('academy.reenroll.priorityUntil')"
        for="re-until"
        required
        :help="t('academy.reenroll.priorityHint')"
      >
        <DatePicker
          v-model="priorityUntil"
          input-id="re-until"
          :min-date="new Date()"
          show-icon
          fluid
        />
      </FormField>
    </FormDialog>

    <FormDialog
      v-model:visible="answerOpen"
      :title="t('academy.reenroll.record')"
      :subtitle="answering?.client?.name"
      icon="pi-check"
      :saving="saving"
      :save-disabled="answer === 'accept' && !groupId"
      :error="answerError"
      @save="saveAnswer"
    >
      <SelectButton
        v-model="answer"
        :options="answerOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
      <FormField
        v-if="answer === 'accept'"
        :label="t('academy.reenroll.group')"
        for="re-group"
        required
      >
        <Select
          v-model="groupId"
          input-id="re-group"
          :options="data?.groups ?? []"
          :option-label="
            (g: AcademyReenrollment['groups'][number]) => `${g.display_name} (${g.free})`
          "
          option-value="id"
          fluid
        />
      </FormField>
      <small v-if="answer === 'accept'" class="muted">{{ t('academy.reenroll.acceptHint') }}</small>
    </FormDialog>
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
.pad {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card__title {
  font-size: 1rem;
  margin: 0;
  padding: 14px 16px 8px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.tile {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tile__value {
  font-size: 1.5rem;
  font-weight: 700;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
</style>
