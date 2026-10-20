<script setup lang="ts">
// My child's academy page (US-11.27): their group, coach and trainings, attendance and rate, the
// coach's shared notes and published evaluations with progress charts, announcements for their
// group, and fees with "can pay". Internal notes and drafts are never shown; notes and evaluations
// only with "can view performance". Parents report an absence ahead (Excused to the coach) and
// open the term progress report to print or save as PDF.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import ProgressChart from '@/components/academy/ProgressChart.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import { clientApi, type ChildAcademy } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'

type Upcoming = ChildAcademy['upcoming'][number]
const { t, te } = useI18n()
const route = useRoute()
const toast = useToast()
const format = useFormat()
const id = Number(route.params.id)
const page = ref<ChildAcademy | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const reportTerm = ref<number | null>(null)
const period = (p: string) =>
  te(`academy.evaluations.periods.${p}`) ? t(`academy.evaluations.periods.${p}`) : p

async function load() {
  state.value = 'loading'
  try {
    page.value = await clientApi.family.academy(id)
    reportTerm.value = page.value.report_terms[0]?.id ?? null
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

// Reporting an absence ahead (US-10.16).
const excusing = ref<Upcoming | null>(null)
const reason = ref('')
const busy = ref(false)
async function excuse(u: Upcoming, excused: boolean) {
  busy.value = true
  try {
    await clientApi.excuse(u.booking_id, excused, excused ? reason.value.trim() || null : null)
    excusing.value = null
    reason.value = ''
    toast.add({
      severity: 'success',
      summary: excused ? t('app.childAcademy.reported') : t('app.childAcademy.withdrawn'),
      life: 3000,
    })
    await load()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="ca-stack">
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="200px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="page">
      <h1 class="ca-title">{{ t('app.childAcademy.title', { name: page.child.first_name }) }}</h1>
      <EmptyState
        v-if="!page.enrollments.length"
        icon="pi-flag"
        :title="t('app.childAcademy.none')"
      />

      <section v-for="e in page.enrollments.filter((x) => x.current)" :key="e.id" class="ca-card">
        <div class="ca-spread">
          <h2 class="ca-subtitle">{{ e.group.display_name }}</h2>
          <Tag severity="secondary" :value="e.display_status" />
        </div>
        <p class="ca-small">
          {{ [e.program.display_name, e.level, e.term].filter(Boolean).join(' · ') }}
        </p>
        <p class="ca-muted ca-small">
          {{ [e.location, e.head_coach].filter(Boolean).join(' · ') }}
        </p>
        <p class="ca-small">
          {{ t('app.childAcademy.rate') }}:
          <strong class="ca-num">{{
            e.attendance.rate === null ? '—' : `${e.attendance.rate}%`
          }}</strong>
          <span class="ca-muted">
            ·
            {{
              t('app.childAcademy.counts', {
                attended: e.attendance.attended,
                absent: e.attendance.absent,
                excused: e.attendance.excused,
              })
            }}</span
          >
        </p>
      </section>

      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.trainings') }}</h2>
        <EmptyState
          v-if="!page.upcoming.length"
          compact
          icon="pi-calendar"
          :title="t('app.childAcademy.noTrainings')"
        />
        <ul v-else class="ca-list">
          <li v-for="u in page.upcoming" :key="u.booking_id" class="ca-spread row">
            <span>
              <strong>{{ format.dateTime(u.starts_at) }}</strong>
              <span class="ca-muted ca-small block">{{
                [u.group, u.location].filter(Boolean).join(' · ')
              }}</span>
              <Tag
                v-if="u.excused"
                severity="info"
                :value="t('app.attendance.statuses.excused')"
                class="tag"
              />
            </span>
            <Button
              v-if="u.excused"
              :label="t('academy.absence.withdraw')"
              size="small"
              variant="text"
              :loading="busy"
              @click="excuse(u, false)"
            />
            <Button
              v-else
              :label="t('academy.absence.report')"
              size="small"
              variant="outlined"
              @click="excusing = u"
            />
          </li>
        </ul>
      </section>

      <section v-if="page.attendance.recent.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.recent') }}</h2>
        <ul class="ca-list">
          <li v-for="(r, i) in page.attendance.recent.slice(0, 10)" :key="i" class="ca-spread row">
            <span class="ca-small"
              >{{ showDay(format, r.date) }} · {{ r.time }}
              <span class="ca-muted">{{ r.group }}</span></span
            >
            <Tag
              :severity="
                r.status === 'attended' ? 'success' : r.status === 'excused' ? 'info' : 'danger'
              "
              :value="t(`app.attendance.statuses.${r.status === 'absent' ? 'no_show' : r.status}`)"
            />
          </li>
        </ul>
      </section>

      <section v-if="page.notes" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.notes') }}</h2>
        <EmptyState
          v-if="!page.notes.length"
          compact
          icon="pi-comment"
          :title="t('app.childAcademy.noNotes')"
        />
        <ul v-else class="ca-list">
          <li v-for="n in page.notes" :key="n.id" class="note">
            <span class="ca-muted ca-small">
              {{ t(`academy.notes.categories.${n.category}`) }} · {{ n.author }} ·
              {{ n.created_at ? format.date(n.created_at) : '' }}
            </span>
            <p>{{ n.body }}</p>
          </li>
        </ul>
      </section>

      <section v-if="page.progress" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.progress') }}</h2>
        <EmptyState
          v-if="!page.progress.length"
          compact
          icon="pi-chart-line"
          :title="t('app.childAcademy.noEvaluations')"
        />
        <div v-for="s in page.progress" :key="s.key" class="chart">
          <strong class="ca-small">{{ s.name }}</strong>
          <ProgressChart :series="s" />
        </div>
        <ul v-if="page.evaluations?.length" class="ca-list">
          <li v-for="ev in page.evaluations" :key="ev.id" class="ca-spread row">
            <span class="ca-small">{{ ev.template }} · {{ period(ev.period) }}</span>
            <span class="ca-muted ca-small">{{ ev.date ? showDay(format, ev.date) : '' }}</span>
          </li>
        </ul>
      </section>

      <section v-if="page.report_terms.length" class="ca-card ca-form">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.report') }}</h2>
        <Select
          v-if="page.report_terms.length > 1"
          v-model="reportTerm"
          :options="page.report_terms"
          option-label="name"
          option-value="id"
          :aria-label="t('academy.report.term')"
        />
        <RouterLink
          :to="{
            name: 'app.print.report',
            params: { id },
            query: reportTerm ? { term_id: reportTerm } : {},
          }"
          target="_blank"
          custom
          v-slot="{ href }"
        >
          <a
            :href="href"
            target="_blank"
            rel="noopener"
            class="p-button p-component p-button-outlined report-btn"
          >
            <i class="pi pi-download" aria-hidden="true" /> {{ t('app.childAcademy.download') }}
          </a>
        </RouterLink>
      </section>

      <section v-if="page.announcements.length" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.announcements') }}</h2>
        <ul class="ca-list">
          <li v-for="a in page.announcements" :key="a.id" class="note">
            <strong>{{ a.title }}</strong>
            <p>{{ a.body }}</p>
            <span class="ca-muted ca-small">{{ a.author }} · {{ format.date(a.at) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="page.fees" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.childAcademy.fees') }}</h2>
        <p class="ca-small">
          {{ t('app.childAcademy.outstanding') }}:
          <strong class="ca-num">{{ format.money(page.fees.outstanding) }}</strong>
        </p>
        <ul class="ca-list">
          <li v-for="i in page.fees.invoices" :key="i.id" class="ca-spread row">
            <span class="ca-small"
              ><span class="ca-num">{{ i.number }}</span> · {{ showDay(format, i.due_on) }}</span
            >
            <Tag
              :severity="i.balance > 0 ? (i.overdue ? 'danger' : 'warn') : 'success'"
              :value="
                i.balance > 0
                  ? t('app.family.due', { amount: format.money(i.balance) })
                  : t('app.family.paid')
              "
            />
          </li>
        </ul>
      </section>
    </template>

    <FormDialog
      :visible="!!excusing"
      :title="t('academy.absence.title')"
      :subtitle="excusing ? format.dateTime(excusing.starts_at) : ''"
      :save-label="t('academy.absence.report')"
      :saving="busy"
      @update:visible="(v: boolean) => !v && (excusing = null)"
      @save="excusing && excuse(excusing, true)"
    >
      <label class="field">
        <span>{{ t('academy.absence.reason') }}</span>
        <InputText v-model="reason" maxlength="300" />
      </label>
      <p class="ca-muted ca-small">{{ t('academy.absence.hint') }}</p>
    </FormDialog>
  </div>
</template>

<style scoped>
.row {
  padding: 10px 0;
  gap: 8px;
}
.block {
  display: block;
}
.tag {
  margin-top: 4px;
}
.note {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0;
}
.note p {
  margin: 0;
  white-space: pre-wrap;
}
.chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.report-btn {
  justify-content: center;
  gap: 8px;
  text-decoration: none;
}
</style>
