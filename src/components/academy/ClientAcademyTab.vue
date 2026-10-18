<script setup lang="ts">
// A child's academy view on their profile (US-10.23): current and past groups (program, level,
// coach), upcoming trainings, attendance, coach notes (US-10.17), evaluations with a progress chart
// per criterion (US-10.19), fees, guardians and emergency contacts; and the term's progress report
// to print or email (US-10.20). Fees show only with payments.view, contact details with
// clients.contact_view.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import NotesList from '@/components/academy/NotesList.vue'
import ProgressChart from '@/components/academy/ProgressChart.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import {
  tenantApi,
  type AcademyNote,
  type AcademyProfile,
  type EvaluationHistory,
} from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
import { apiMessage } from '@/lib/apiErrors'
import { showDay } from '@/lib/academy'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const { t, te } = useI18n()
const toast = useToast()
const format = useFormat()
const auth = useStaffAuth()
const state = ref<'loading' | 'ready' | 'error'>('loading')
const profile = ref<AcademyProfile | null>(null)
const notes = ref<AcademyNote[]>([])
const category = ref<string | null>(null)
const shownNotes = computed(() =>
  category.value ? notes.value.filter((n) => n.category === category.value) : notes.value,
)
const categories = computed(() =>
  ['technical', 'behaviour', 'fitness', 'injury', 'general'].map((c) => ({
    value: c,
    label: t(`academy.notes.categories.${c}`),
  })),
)
const period = (p: string) =>
  te(`academy.evaluations.periods.${p}`) ? t(`academy.evaluations.periods.${p}`) : p
const last = (s: EvaluationHistory['progress'][number]) => s.points[s.points.length - 1]
const day = (ymd: string) => showDay(format, ymd)
const outcomeSeverity = { attended: 'success', absent: 'danger', excused: 'secondary' } as const

async function load() {
  state.value = 'loading'
  try {
    ;[profile.value, notes.value] = await Promise.all([
      tenantApi.academy.profile.get(props.clientId),
      tenantApi.academy.notes.forClient(props.clientId).catch(() => []),
    ])
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
async function resolve(note: AcademyNote) {
  await tenantApi.academy.notes.resolve(note.id).catch(() => null)
  notes.value = await tenantApi.academy.notes.forClient(props.clientId).catch(() => notes.value)
}

// The progress report (US-10.20): printed from its own page, or emailed to the guardians.
const reportUrl = { name: 'tenant.academy.progress-report.print', params: { id: props.clientId } }
const emailOpen = ref(false)
const email = ref('')
const emailing = ref(false)
const emailError = ref<string | null>(null)
async function sendReport() {
  emailing.value = true
  emailError.value = null
  try {
    const res = await tenantApi.academy.profile.emailProgressReport(props.clientId, {
      email: email.value.trim() || null,
    })
    toast.add({
      severity: 'success',
      summary: t('academy.report.emailed', { n: res.sent }),
      life: 4000,
    })
    emailOpen.value = false
    email.value = ''
  } catch (e) {
    emailError.value = validationErrors(e).email?.[0] ?? apiMessage(e) ?? t('common.genericError')
  } finally {
    emailing.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="stack">
    <div class="card pad"><Skeleton height="80px" /></div>
    <div class="card pad"><Skeleton height="120px" /></div>
  </div>
  <ErrorState v-else-if="state === 'error'" @retry="load" />
  <div v-else-if="profile" class="stack">
    <section class="card">
      <header class="head">
        <h2>{{ t('academy.profile.enrollments') }}</h2>
        <div v-if="profile.enrollments.length" class="actions">
          <RouterLink v-slot="{ href }" :to="reportUrl" custom>
            <Button
              as="a"
              :href="href"
              target="_blank"
              :label="t('academy.report.open')"
              icon="pi pi-file"
              size="small"
              variant="outlined"
            />
          </RouterLink>
          <Button
            :label="t('academy.report.email')"
            icon="pi pi-envelope"
            size="small"
            variant="text"
            @click="emailOpen = true"
          />
        </div>
      </header>
      <EmptyState
        v-if="!profile.enrollments.length"
        compact
        icon="pi-users"
        :title="t('academy.profile.noEnrollments')"
        :body="t('academy.profile.noEnrollmentsHint')"
      />
      <ul v-else class="list">
        <li v-for="e in profile.enrollments" :key="e.id" class="item" :class="{ past: !e.current }">
          <div class="grow">
            <RouterLink :to="{ name: 'tenant.academy.group', params: { id: e.group.id } }">
              {{ e.group.display_name }}
            </RouterLink>
            <div class="muted small">
              {{
                [e.program.display_name, e.level, e.term, e.location].filter(Boolean).join(' · ')
              }}
            </div>
            <div class="muted small">
              <template v-if="e.head_coach"
                >{{ t('academy.profile.coach') }}: {{ e.head_coach }} ·
              </template>
              {{
                e.ends_on
                  ? t('academy.profile.period', { from: day(e.starts_on), to: day(e.ends_on) })
                  : t('academy.profile.since', { from: day(e.starts_on) })
              }}
            </div>
          </div>
          <span v-if="e.attendance.rate !== null" class="num">{{ e.attendance.rate }}%</span>
          <StatusTag :status="e.display_status" size="sm" />
        </li>
      </ul>
    </section>

    <div class="cols">
      <section class="card">
        <header class="head">
          <h2>{{ t('academy.profile.upcoming') }}</h2>
        </header>
        <EmptyState
          v-if="!profile.upcoming.length"
          compact
          icon="pi-calendar"
          :title="t('academy.profile.noUpcoming')"
        />
        <ul v-else class="list">
          <li v-for="u in profile.upcoming" :key="u.session_id" class="item">
            <span class="grow">{{ format.dateTime(u.starts_at) }}</span>
            <span class="muted small">{{ [u.group, u.location].filter(Boolean).join(' · ') }}</span>
          </li>
        </ul>
      </section>
      <section class="card">
        <header class="head">
          <h2>{{ t('academy.profile.attendance') }}</h2>
          <strong v-if="profile.attendance.rate !== null" class="num"
            >{{ profile.attendance.rate }}%</strong
          >
        </header>
        <EmptyState
          v-if="!profile.attendance.recent.length"
          compact
          icon="pi-check-square"
          :title="t('academy.profile.noAttendance')"
        />
        <template v-else>
          <p class="body muted small">
            {{
              t('academy.report.attendanceLine', {
                attended: profile.attendance.attended,
                absent: profile.attendance.absent,
                excused: profile.attendance.excused,
              })
            }}
          </p>
          <ul class="list">
            <li v-for="(o, i) in profile.attendance.recent" :key="i" class="item">
              <span class="grow">{{ day(o.date) }} {{ o.time }}</span>
              <span class="muted small">{{ o.group }}</span>
              <Tag
                :severity="outcomeSeverity[o.status]"
                :value="t(`academy.profile.statuses.${o.status}`)"
              />
            </li>
          </ul>
        </template>
      </section>
    </div>

    <section v-if="profile.progress" class="card">
      <header class="head">
        <h2>{{ t('academy.evaluations.progress') }}</h2>
      </header>
      <EmptyState
        v-if="!profile.progress.length"
        compact
        icon="pi-chart-line"
        :title="t('academy.evaluations.noHistory')"
      />
      <div v-else class="charts">
        <div v-for="s in profile.progress" :key="s.key" class="chart">
          <div class="chart__title">
            <strong>{{ s.name }}</strong>
            <span class="muted small">{{ s.section }}</span>
          </div>
          <ProgressChart :series="s" />
          <span class="muted small">
            {{ t('academy.evaluations.latest') }}:
            {{
              s.scale === 'levels' ? t(`academy.evaluations.levels.${last(s)?.raw}`) : last(s)?.raw
            }}{{ s.unit ? ` ${s.unit}` : '' }}
          </span>
        </div>
      </div>
      <ul v-if="profile.evaluations?.length" class="list">
        <li v-for="ev in profile.evaluations" :key="ev.id" class="item">
          <span>{{ ev.template }} · {{ period(ev.period) }}</span>
          <span class="muted small grow">{{
            [ev.group, ev.author, ev.date ? day(ev.date) : null].filter(Boolean).join(' · ')
          }}</span>
          <StatusTag :status="ev.status" size="sm" />
          <RouterLink
            v-if="ev.status === 'Published'"
            :to="{ name: 'tenant.academy.evaluation.print', params: { id: ev.id } }"
            target="_blank"
            class="small"
          >
            {{ t('academy.evaluations.print') }}
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="card">
      <header class="head">
        <h2>{{ t('academy.notes.title') }}</h2>
        <Select
          v-model="category"
          :options="categories"
          option-label="label"
          option-value="value"
          :placeholder="t('academy.notes.allCategories')"
          show-clear
        />
      </header>
      <EmptyState
        v-if="!shownNotes.length"
        compact
        icon="pi-comment"
        :title="t('academy.notes.none')"
      />
      <div v-else class="body">
        <NotesList
          :notes="shownNotes"
          :can-resolve="auth.can('academy.update')"
          @resolve="resolve"
        />
      </div>
    </section>

    <section v-if="profile.fees" class="card">
      <header class="head">
        <h2>{{ t('academy.profile.fees') }}</h2>
        <div class="totals small">
          <span
            >{{ t('academy.profile.outstanding') }}:
            <strong>{{ format.money(profile.fees.outstanding) }}</strong></span
          >
          <span v-if="profile.fees.overdue" class="danger"
            >{{ t('academy.profile.overdue') }}:
            <strong>{{ format.money(profile.fees.overdue) }}</strong></span
          >
        </div>
      </header>
      <EmptyState
        v-if="!profile.fees.invoices.length"
        compact
        icon="pi-receipt"
        :title="t('academy.profile.noFees')"
      />
      <ul v-else class="list">
        <li v-for="i in profile.fees.invoices" :key="i.id" class="item">
          <RouterLink
            :to="{ name: 'tenant.invoice.print', params: { id: i.id } }"
            target="_blank"
            >{{ i.number }}</RouterLink
          >
          <span class="muted small grow">{{
            [i.group, day(i.due_on)].filter(Boolean).join(' · ')
          }}</span>
          <span class="num">{{ format.money(i.total) }}</span>
          <Tag v-if="i.overdue" severity="danger" :value="t('academy.profile.overdue')" />
          <StatusTag v-else :status="i.status" size="sm" />
        </li>
      </ul>
    </section>

    <div class="cols">
      <section class="card">
        <header class="head">
          <h2>{{ t('academy.profile.guardians') }}</h2>
        </header>
        <EmptyState
          v-if="!profile.guardians.length"
          compact
          icon="pi-users"
          :title="t('academy.profile.noGuardians')"
        />
        <ul v-else class="list">
          <li v-for="g in profile.guardians" :key="g.id" class="item">
            <div class="grow">
              <RouterLink :to="{ name: 'tenant.client', params: { id: g.id } }">{{
                g.name
              }}</RouterLink>
              <span v-if="g.relation" class="muted small"> · {{ g.relation }}</span>
              <div v-if="g.mobile || g.email" class="muted small" dir="ltr">
                {{ [g.mobile, g.email].filter(Boolean).join(' · ') }}
              </div>
            </div>
            <div class="perms">
              <Tag
                v-for="(on, p) in g.permissions"
                v-show="on"
                :key="p"
                severity="secondary"
                :value="t(`academy.profile.permissions.${p}`)"
              />
            </div>
          </li>
        </ul>
      </section>
      <section class="card">
        <header class="head">
          <h2>{{ t('academy.profile.emergency') }}</h2>
        </header>
        <EmptyState
          v-if="!profile.emergency_contacts.length"
          compact
          icon="pi-phone"
          :title="t('academy.profile.noEmergency')"
        />
        <ul v-else class="list">
          <li v-for="(c, i) in profile.emergency_contacts" :key="i" class="item">
            <span class="grow"
              >{{ c.name }} <span class="muted small">· {{ c.relation }}</span></span
            >
            <a :href="`tel:${c.phone}`" dir="ltr">{{ c.phone }}</a>
          </li>
        </ul>
      </section>
    </div>
  </div>

  <FormDialog
    v-model:visible="emailOpen"
    :title="t('academy.report.emailTitle')"
    :saving="emailing"
    :save-label="t('academy.report.send')"
    :error="emailError"
    @save="sendReport"
  >
    <FormField
      :label="t('academy.report.emailTo')"
      for="report-email"
      :help="t('academy.report.emailHint')"
    >
      <InputText id="report-email" v-model="email" type="email" dir="ltr" fluid />
    </FormField>
  </FormDialog>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
}
.head h2 {
  margin: 0;
  font-size: 1rem;
}
.actions,
.totals,
.perms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.totals {
  gap: 16px;
}
.charts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  padding: 0 16px 12px;
}
.chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chart__title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 16px 8px;
}
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--border-default);
}
.item.past {
  opacity: 0.75;
}
.grow {
  flex: 1;
  min-width: 0;
}
.body {
  padding: 0 16px 8px;
}
.muted {
  color: var(--text-secondary);
}
.small {
  font-size: 0.875rem;
}
.num {
  font-variant-numeric: tabular-nums;
}
.danger {
  color: var(--sev-danger-fg);
}
</style>
