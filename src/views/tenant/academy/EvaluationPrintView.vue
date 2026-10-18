<script setup lang="ts">
// A player's evaluation to print or save as PDF for the family (US-10.19), A4, in Arabic or
// English: the group, period, every criterion with its value, and the coach's comment.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { tenantApi, type EvaluationCriterion, type EvaluationReport } from '@/api/tenant'
import { useFormat } from '@/composables/useFormat'
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
const report = ref<EvaluationReport | null>(null)
const failed = ref(false)
const print = () => window.print()
const dir = computed(() => (lang.value === 'ar' ? 'rtl' : 'ltr'))
const pick = (n: { ar?: string | null; en?: string | null }) =>
  lang.value === 'ar' ? n.ar || n.en : n.en || n.ar
const period = (p: string) =>
  te(`academy.evaluations.periods.${p}`) ? t(`academy.evaluations.periods.${p}`) : p
function value(c: EvaluationCriterion) {
  const v = report.value?.scores[c.key!]
  if (v === null || v === undefined || v === '') return '—'
  if (c.scale === 'levels') return t(`academy.evaluations.levels.${v}`)
  if (c.scale === 'measure') return `${v}${c.unit ? ` ${c.unit}` : ''}`
  return `${v} / ${c.scale === '1-5' ? 5 : 10}`
}

onMounted(async () => {
  try {
    report.value = await tenantApi.academy.evaluations.get(Number(route.params.id))
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="print-page">
    <div class="toolbar no-print">
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
          <h1>{{ t('academy.evaluations.reportTitle') }}</h1>
          <p>{{ report.template.display_name }}</p>
        </div>
        <dl>
          <dt>{{ t('academy.roster.player') }}</dt>
          <dd>{{ report.client.name }}</dd>
          <dt>{{ t('academy.groups.columns.group') }}</dt>
          <dd>{{ report.group.display_name }}</dd>
          <dt>{{ t('academy.evaluations.period') }}</dt>
          <dd>{{ period(report.period) }}</dd>
          <dt>{{ t('academy.evaluations.date') }}</dt>
          <dd>{{ format.date(report.published_at ?? report.updated_at ?? '') }}</dd>
        </dl>
      </header>
      <section v-for="section in report.sections" :key="section.key">
        <h2>{{ pick(section.name) }}</h2>
        <table>
          <tbody>
            <tr v-for="c in section.criteria" :key="c.key">
              <th>{{ pick(c.name) }}</th>
              <td dir="auto">{{ value(c) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section v-if="report.comment">
        <h2>{{ t('academy.evaluations.comment') }}</h2>
        <p class="comment">{{ report.comment }}</p>
      </section>
      <footer>{{ t('academy.evaluations.coach') }}: {{ report.author }}</footer>
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
  margin: 16px 0 6px;
}
dl {
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px 12px;
  margin: 0;
}
dt {
  color: #555;
}
dd {
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: start;
  padding: 6px 8px;
  border-bottom: 1px solid #ddd;
}
th {
  font-weight: 500;
  width: 60%;
}
.comment {
  white-space: pre-line;
}
footer {
  margin-top: 24px;
  color: #555;
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
