<script setup lang="ts">
// Import clients (US-05.15, brief 06 §10): download the template → upload a CSV or Excel file →
// map its columns → validation preview with errors per row and what to do with clients who already
// exist (skip / update) → run in the background → result report.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import PageHeader from '@/components/patterns/PageHeader.vue'
import WizardSteps from '@/components/patterns/WizardSteps.vue'
import { tenantApi, type ClientImport, type ImportPreview } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const { t } = useI18n()
const router = useRouter()
const auth = useStaffAuth()
const step = ref(0)
const steps = computed(() => [
  t('import.steps.upload'),
  t('import.steps.map'),
  t('import.steps.preview'),
  t('import.steps.result'),
])
const error = ref<string | null>(null)
const busy = ref(false)

// 1. Upload
const imp = ref<ClientImport | null>(null)
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  error.value = null
  try {
    imp.value = await tenantApi.imports.upload(file)
    mapping.value = Object.fromEntries(
      imp.value.fields.map((f) => [f, imp.value!.mapping[f] ?? null]),
    )
    step.value = 1
  } catch (err) {
    error.value = apiMessage(err) ?? t('import.uploadError')
  } finally {
    busy.value = false
  }
}

// 2. Map
const mapping = ref<Record<string, number | null>>({})
const duplicates = ref<'skip' | 'update'>('skip')
const columnOptions = computed(() => [
  { value: null, label: t('import.skipColumn') },
  ...(imp.value?.headers ?? []).map((h, i) => ({
    value: i,
    label: h || t('import.column', { n: i + 1 }),
  })),
])
const mapped = computed(() => mapping.value.first_name != null && mapping.value.last_name != null)

// 3. Preview
const preview = ref<ImportPreview | null>(null)
async function check() {
  if (!imp.value) return
  busy.value = true
  error.value = null
  try {
    preview.value = await tenantApi.imports.preview(imp.value.id, mapping.value, duplicates.value)
    step.value = 2
  } catch (err) {
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
const SEVERITY = { create: 'success', update: 'info', skip: 'secondary', error: 'danger' } as const

// 4. Run, then follow it
let poll: ReturnType<typeof setInterval> | undefined
async function run() {
  if (!imp.value) return
  busy.value = true
  error.value = null
  try {
    imp.value = await tenantApi.imports.run(imp.value.id, mapping.value, duplicates.value)
    step.value = 3
    poll = setInterval(async () => {
      imp.value = await tenantApi.imports.get(imp.value!.id).catch(() => imp.value)
      if (imp.value && ['done', 'failed'].includes(imp.value.status)) clearInterval(poll)
    }, 2000)
  } catch (err) {
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => clearInterval(poll))
const finished = computed(() => imp.value && ['done', 'failed'].includes(imp.value.status))
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('import.title')"
      :breadcrumb="[
        { label: t('clients.title'), to: { name: 'tenant.clients' } },
        { label: t('import.title') },
      ]"
    />
    <WizardSteps :steps="steps" :active="step" @go="(i: number) => step < 3 && (step = i)" />
    <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>

    <section v-if="step === 0" class="card pad stack">
      <p>{{ t('import.intro') }}</p>
      <a :href="tenantApi.imports.templateUrl" class="link"
        ><i class="pi pi-download" aria-hidden="true" /> {{ t('import.template') }}</a
      >
      <label class="drop">
        <i class="pi pi-upload" aria-hidden="true" />
        <span>{{ busy ? t('common.loading') : t('import.choose') }}</span>
        <input type="file" accept=".csv,.xlsx,text/csv" :disabled="busy" @change="onFile" />
      </label>
      <small class="muted">{{ t('import.formats') }}</small>
    </section>

    <section v-else-if="step === 1 && imp" class="card pad stack">
      <p>{{ t('import.mapIntro', { file: imp.file, n: imp.total }) }}</p>
      <div class="map">
        <template v-for="field in imp.fields" :key="field">
          <label :for="`map-${field}`"
            >{{ t(`import.fields.${field}`)
            }}<template v-if="field === 'first_name' || field === 'last_name'"> *</template></label
          >
          <Select
            v-model="mapping[field]"
            :input-id="`map-${field}`"
            :options="columnOptions"
            option-label="label"
            option-value="value"
          />
        </template>
      </div>
      <div class="field">
        <span id="dup-mode">{{ t('import.duplicates') }}</span>
        <SelectButton
          v-model="duplicates"
          :options="[
            { value: 'skip', label: t('import.dup.skip') },
            {
              value: 'update',
              label: t('import.dup.update'),
              disabled: !auth.can('clients.update'),
            },
          ]"
          option-label="label"
          option-value="value"
          option-disabled="disabled"
          :allow-empty="false"
          aria-labelledby="dup-mode"
        />
      </div>
      <div class="actions">
        <Button :label="t('import.check')" :loading="busy" :disabled="!mapped" @click="check" />
      </div>
    </section>

    <section v-else-if="step === 2 && preview" class="card stack">
      <div class="counts pad">
        <Tag
          v-for="(n, k) in preview.counts"
          :key="k"
          :severity="SEVERITY[k]"
          :value="t(`import.counts.${k}`, { n })"
        />
      </div>
      <DataTable :value="preview.rows" data-key="row" scrollable scroll-height="420px">
        <Column :header="t('import.row')" field="row" />
        <Column :header="t('bookings.columns.status')">
          <template #body="{ data }"
            ><Tag
              class="tag-sm"
              :severity="SEVERITY[data.status as keyof typeof SEVERITY]"
              :value="t(`import.status.${data.status}`)"
          /></template>
        </Column>
        <Column :header="t('bookings.columns.client')">
          <template #body="{ data }"
            >{{ data.values.first_name }} {{ data.values.last_name }}</template
          >
        </Column>
        <Column :header="t('import.problems')">
          <template #body="{ data }"
            ><span class="err">{{ data.messages.join(' · ') }}</span></template
          >
        </Column>
      </DataTable>
      <div class="actions pad">
        <Button :label="t('common.back')" severity="secondary" variant="text" @click="step = 1" />
        <Button
          :label="t('import.run', { n: preview.counts.create + preview.counts.update })"
          :loading="busy"
          :disabled="!preview.counts.create && !preview.counts.update"
          @click="run"
        />
      </div>
    </section>

    <section v-else-if="step === 3 && imp" class="card pad stack">
      <template v-if="!finished">
        <p>{{ t('import.running', { n: imp.total }) }}</p>
        <ProgressBar mode="indeterminate" style="height: 6px" />
      </template>
      <template v-else>
        <Message :severity="imp.status === 'done' ? 'success' : 'error'" :closable="false">{{
          imp.status === 'done' ? t('import.done') : t('import.failedRun')
        }}</Message>
        <div class="counts">
          <Tag severity="success" :value="t('import.counts.create', { n: imp.created })" />
          <Tag severity="info" :value="t('import.counts.update', { n: imp.updated })" />
          <Tag severity="secondary" :value="t('import.counts.skip', { n: imp.skipped })" />
          <Tag severity="danger" :value="t('import.counts.error', { n: imp.failed })" />
        </div>
        <ul v-if="imp.report.length" class="report">
          <li v-for="r in imp.report" :key="`${r.row}-${r.status}`">
            <strong>{{ t('import.row') }} {{ r.row }}</strong> ·
            {{ t(`import.status.${r.status}`) }}
            <span v-if="r.messages.length" class="err">— {{ r.messages.join(' · ') }}</span>
          </li>
        </ul>
        <div class="actions">
          <Button :label="t('import.toClients')" @click="router.push({ name: 'tenant.clients' })" />
        </div>
      </template>
    </section>
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
}
.pad {
  padding: 16px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.link {
  color: var(--text-link);
  text-decoration: none;
  font-weight: 500;
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  border: 2px dashed var(--border-strong, #999);
  border-radius: 12px;
  cursor: pointer;
}
.drop input {
  max-width: 100%;
}
.map {
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 320px);
  gap: 8px 16px;
  align-items: center;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.counts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.report {
  margin: 0;
  padding-inline-start: 18px;
  max-height: 320px;
  overflow-y: auto;
}
.err {
  color: var(--sev-danger-fg);
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
}
</style>
