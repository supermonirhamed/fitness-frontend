<script setup lang="ts">
// A child's progress report for a term (US-10.20) to print or save as PDF, A4, in Arabic or
// English: attendance per group, the published evaluations, the coach's shared notes and the level
// recommended for the next term. Guardians open the same report from the app (US-11.27).
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import {
  tenantApi,
  type EvaluationCriterion,
  type EvaluationValue,
  type ProgressReport,
} from '@/api/tenant'
import { clientApi } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import en from '@/i18n/en'
import ar from '@/i18n/ar'

const route = useRoute()
const {
  t,
  te,
  locale: lang,
} = useI18n({ useScope: 'local', inheritLocale: true, messages: { en, ar } })
const { t: tu } = useI18n()
const format = useFormat()
const clientId = Number(route.params.id)
const report = ref<ProgressReport | null>(null)
const termId = ref<number | null>(null)
const failed = ref(false)
const print = () => window.print()
const dir = computed(() => (lang.value === 'ar' ? 'rtl' : 'ltr'))
const pick = (n: { ar?: string | null; en?: string | null }) =>
  lang.value === 'ar' ? n.ar || n.en : n.en || n.ar
const period = (p: string) =>
  te(`academy.evaluations.periods.${p}`) ? t(`academy.evaluations.periods.${p}`) : p
const day = (ymd: string | null) => (ymd ? showDay(format, ymd) : '')
function value(c: EvaluationCriterion, scores: Record<string, EvaluationValue>) {
  const v = scores[c.key!]
  if (v === null || v === undefined || v === '') return '—'
  if (c.scale === 'levels') return t(`academy.evaluations.levels.${v}`)
  if (c.scale === 'measure') return `${v}${c.unit ? ` ${c.unit}` : ''}`
  return `${v} / ${c.scale === '1-5' ? 5 : 10}`
}

async function load() {
  failed.value = false
  try {
    // Parents open it from the app (US-11.27), staff from the child's profile.
    report.value = route.meta.clientDocument
      ? await clientApi.family.report(clientId, termId.value)
      : await tenantApi.academy.profile.progressReport(clientId, termId.value)
    termId.value = report.value.term?.id ?? null
  } catch {
    failed.value = true
  }
}
onMounted(load)
</script>

<template>
  <div class="print-page">
    <div class="toolbar no-print">
      <Select
        v-if="report && report.terms.length > 1"
        v-model="termId"
        :options="report.terms"
        option-label="display_name"
        option-value="id"
        :aria-label="t('academy.report.term')"
        @change="load"
      />
      <SelectButton
        v-model="lang"
        :options="[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        :aria-label="tu('payments.receiptLanguage')"
      />
      <Button icon="pi pi-print" :label="tu('invoicesPage.printPdf')" @click="print" />
    </div>
    <p v-if="failed" class="no-print">{{ tu('common.genericError') }}</p>
    <article v-else-if="report" class="sheet" :dir="dir" :lang="lang">
      <header class="sheet__head">
        <div>
          <h1>{{ t('academy.report.title') }}</h1>
          <p>{{ report.organization }}</p>
        </div>
        <dl>
          <dt>{{ t('academy.roster.player') }}</dt>
          <dd>{{ report.child.name }}</dd>
          <dt>{{ t('academy.report.term') }}</dt>
          <dd>
            <template v-if="report.term">
              {{ report.term.display_name }}
              <span class="muted">
                ({{ day(report.term.starts_on) }} – {{ day(report.term.ends_on) }})
              </span>
            </template>
            <template v-else>{{ t('academy.report.current') }}</template>
          </dd>
        </dl>
      </header>

      <section>
        <h2>{{ t('academy.report.attendance') }}</h2>
        <p>
          <strong v-if="report.attendance.rate !== null">{{ report.attendance.rate }}% · </strong>
          {{
            t('academy.report.attendanceLine', {
              attended: report.attendance.attended,
              absent: report.attendance.absent,
              excused: report.attendance.excused,
            })
          }}
        </p>
        <table>
          <tbody>
            <tr v-for="(g, i) in report.groups" :key="i">
              <th>
                {{ g.group }}
                <span class="muted">· {{ [g.program, g.level].filter(Boolean).join(' · ') }}</span>
              </th>
              <td>{{ g.coach }}</td>
              <td class="num">{{ g.attendance.rate !== null ? `${g.attendance.rate}%` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>{{ t('academy.report.evaluations') }}</h2>
        <p v-if="!report.evaluations.length" class="muted">
          {{ t('academy.report.noEvaluations') }}
        </p>
        <div v-for="e in report.evaluations" :key="e.id" class="evaluation">
          <h3>
            {{ e.template }} · {{ period(e.period) }}
            <span class="muted">{{ day(e.date) }}</span>
          </h3>
          <table v-for="section in e.sections" :key="section.key">
            <thead>
              <tr>
                <th colspan="2">{{ pick(section.name) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in section.criteria" :key="c.key">
                <th>{{ pick(c.name) }}</th>
                <td dir="auto">{{ value(c, e.scores) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="e.comment" class="comment">“{{ e.comment }}” — {{ e.author }}</p>
        </div>
      </section>

      <section v-if="report.notes.length">
        <h2>{{ t('academy.report.notes') }}</h2>
        <ul class="notes">
          <li v-for="n in report.notes" :key="n.id">
            <span class="muted"
              >{{ day(n.date) }} · {{ t(`academy.notes.categories.${n.category}`) }}</span
            >
            <p class="comment">{{ n.body }} — {{ n.author }}</p>
          </li>
        </ul>
      </section>

      <section>
        <h2>{{ t('academy.report.recommendation') }}</h2>
        <p v-if="report.recommendation?.level">
          {{ t('academy.report.recommendationLine', { level: report.recommendation.level }) }}
          <span class="muted">— {{ report.recommendation.by }}</span>
        </p>
        <p v-else class="muted">{{ t('academy.report.noRecommendation') }}</p>
      </section>
    </article>
  </div>
</template>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #f4f4f5;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.sheet {
  background: #fff;
  color: #111;
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  padding: 20mm 18mm;
  font: 13px/1.5 var(--font-sans);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
}
.sheet__head {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 2px solid #111;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
h1 {
  font-size: 20px;
  margin: 0;
}
h2 {
  font-size: 15px;
  margin: 18px 0 6px;
}
h3 {
  font-size: 14px;
  margin: 12px 0 4px;
}
dl {
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px 12px;
  margin: 0;
}
dt,
.muted {
  color: #555;
}
dd {
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}
th,
td {
  text-align: start;
  padding: 5px 8px;
  border-bottom: 1px solid #ddd;
}
th {
  font-weight: 500;
  width: 60%;
}
thead th {
  font-weight: 600;
  background: #f4f4f5;
}
.num {
  font-variant-numeric: tabular-nums;
}
.evaluation {
  break-inside: avoid;
}
.comment {
  white-space: pre-line;
  margin: 4px 0 8px;
}
.notes {
  list-style: none;
  margin: 0;
  padding: 0;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-page {
    padding: 0;
    background: none;
  }
  .sheet {
    box-shadow: none;
    width: auto;
    min-height: auto;
  }
}
</style>
