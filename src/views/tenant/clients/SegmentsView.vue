<script setup lang="ts">
// Tags & segments (US-05.12, brief 06 §7). Tags: a simple list to add, rename, recolour and delete.
// Segments: saved groups of clients; dynamic ones keep rules (branch, status, age, last visit, tags,
// created dates) with a live "N clients match", static ones are filled from the clients list.
// Segments are clients list filters now, and notification audiences with EP-12.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import { tenantApi, type Segment, type SegmentRules, type Tag as TagItem } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToast()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const canTag = computed(() => auth.can('clients.update'))
const canSegment = computed(() => auth.can('marketing.update'))
const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })

const loading = ref(true)
const tags = ref<TagItem[]>([])
const segments = ref<Segment[]>([])
async function load() {
  loading.value = true
  ;[tags.value, segments.value] = await Promise.all([
    tenantApi.tags.list().catch(() => []),
    tenantApi.segments.list().catch(() => []),
  ])
  loading.value = false
}
onMounted(load)

// Tags
const tagOpen = ref(false)
const tagEditing = ref<TagItem | null>(null)
const tagForm = ref({ name: '', color: '7c3aed' })
function openTag(tag: TagItem | null) {
  tagEditing.value = tag
  tagForm.value = { name: tag?.name ?? '', color: (tag?.color ?? '#7c3aed').replace('#', '') }
  tagOpen.value = true
}
async function saveTag() {
  try {
    const input = { name: tagForm.value.name.trim(), color: `#${tagForm.value.color}` }
    if (tagEditing.value) await tenantApi.tags.update(tagEditing.value.id, input)
    else await tenantApi.tags.create(input)
    tagOpen.value = false
    load()
  } catch (e) {
    fail(e)
  }
}
async function removeTag(tag: TagItem) {
  try {
    await tenantApi.tags.remove(tag.id)
    load()
  } catch (e) {
    fail(e)
  }
}

// Segments
const segOpen = ref(false)
const segEditing = ref<Segment | null>(null)
const segForm = ref({ name: '', type: 'dynamic' as Segment['type'] })
const rules = ref<SegmentRules>({})
const count = ref<number | null>(null)
const locations = computed(() => auth.user?.switchable_locations ?? [])
const statusOptions = computed(() =>
  (['Active', 'Inactive', 'Lead', 'Blocked'] as const).map((s) => ({
    value: s,
    label: t(`status.${s}`),
  })),
)
function openSegment(segment: Segment | null) {
  segEditing.value = segment
  segForm.value = { name: segment?.name ?? '', type: segment?.type ?? 'dynamic' }
  rules.value = { ...(segment?.rules ?? {}) }
  segOpen.value = true
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [rules, () => segForm.value.type, segOpen],
  () => {
    if (!segOpen.value || segForm.value.type !== 'dynamic') return
    clearTimeout(timer)
    timer = setTimeout(async () => {
      count.value = await tenantApi.segments.preview(clean(rules.value)).catch(() => null)
    }, 300)
  },
  { deep: true },
)
const clean = (r: SegmentRules): SegmentRules =>
  Object.fromEntries(
    Object.entries(r).filter(
      ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length),
    ),
  ) as SegmentRules
async function saveSegment() {
  try {
    const input = {
      name: segForm.value.name.trim(),
      type: segForm.value.type,
      rules: clean(rules.value),
    }
    if (segEditing.value) await tenantApi.segments.update(segEditing.value.id, input)
    else await tenantApi.segments.create(input)
    segOpen.value = false
    load()
  } catch (e) {
    fail(e)
  }
}
async function removeSegment(segment: Segment) {
  try {
    await tenantApi.segments.remove(segment.id)
    load()
  } catch (e) {
    fail(e)
  }
}
const openList = (segment: Segment) =>
  router.push({ name: 'tenant.clients', query: { segment: segment.id } })
const describe = (s: Segment) =>
  s.type === 'static'
    ? t('segments.staticHint')
    : Object.keys(s.rules ?? {})
        .map((k) => t(`segments.rules.${k}`))
        .join(' · ') || t('segments.everyone')
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('segments.title')"
      :breadcrumb="[
        { label: t('clients.title'), to: { name: 'tenant.clients' } },
        { label: t('segments.title') },
      ]"
    />

    <Skeleton v-if="loading" height="200px" />
    <div v-else class="grid">
      <section class="card">
        <div class="head">
          <h3>{{ t('segments.tags') }}</h3>
          <Button
            v-if="canTag"
            size="small"
            icon="pi pi-plus"
            :label="t('segments.newTag')"
            @click="openTag(null)"
          />
        </div>
        <EmptyState v-if="!tags.length" compact icon="pi-tag" :title="t('segments.noTags')" />
        <ul v-else class="list">
          <li v-for="tag in tags" :key="tag.id" class="row">
            <span
              class="dot"
              :style="{ background: tag.color ?? 'var(--text-muted)' }"
              aria-hidden="true"
            />
            <span class="grow">{{ tag.name }}</span>
            <small class="muted">{{ t('segments.clients', tag.clients_count ?? 0) }}</small>
            <template v-if="canTag">
              <Button
                size="small"
                variant="text"
                icon="pi pi-pencil"
                :aria-label="t('common.edit')"
                @click="openTag(tag)"
              />
              <Button
                size="small"
                variant="text"
                severity="danger"
                icon="pi pi-trash"
                :aria-label="t('notes.delete')"
                @click="removeTag(tag)"
              />
            </template>
          </li>
        </ul>
      </section>

      <section class="card">
        <div class="head">
          <h3>{{ t('segments.segments') }}</h3>
          <Button
            v-if="canSegment"
            size="small"
            icon="pi pi-plus"
            :label="t('segments.newSegment')"
            @click="openSegment(null)"
          />
        </div>
        <EmptyState
          v-if="!segments.length"
          compact
          icon="pi-filter"
          :title="t('segments.noSegments')"
          :body="t('segments.noSegmentsHint')"
        />
        <ul v-else class="list">
          <li v-for="s in segments" :key="s.id" class="row">
            <span class="grow">
              <span class="name">{{ s.name }}</span>
              <small class="muted">{{ describe(s) }}</small>
            </span>
            <Tag
              class="tag-sm"
              :severity="s.type === 'dynamic' ? 'info' : 'secondary'"
              :value="t(`segments.types.${s.type}`)"
            />
            <Button
              size="small"
              variant="text"
              :label="t('segments.clients', s.count)"
              @click="openList(s)"
            />
            <template v-if="canSegment">
              <Button
                size="small"
                variant="text"
                icon="pi pi-pencil"
                :aria-label="t('common.edit')"
                @click="openSegment(s)"
              />
              <Button
                size="small"
                variant="text"
                severity="danger"
                icon="pi pi-trash"
                :aria-label="t('notes.delete')"
                @click="removeSegment(s)"
              />
            </template>
          </li>
        </ul>
      </section>
    </div>

    <Dialog
      v-model:visible="tagOpen"
      modal
      :header="tagEditing ? tagEditing.name : t('segments.newTag')"
      :style="{ width: '380px' }"
    >
      <div class="form">
        <label for="tag-name">{{ t('segments.tagName') }}</label>
        <div class="tag-row">
          <ColorPicker v-model="tagForm.color" />
          <InputText id="tag-name" v-model="tagForm.name" maxlength="40" class="grow" />
        </div>
      </div>
      <template #footer>
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="tagOpen = false"
        />
        <Button :label="t('common.save')" :disabled="!tagForm.name.trim()" @click="saveTag" />
      </template>
    </Dialog>

    <Drawer v-model:visible="segOpen" :position="position" :block-scroll="true">
      <template #header>
        <div class="title">{{ segEditing ? segEditing.name : t('segments.newSegment') }}</div>
      </template>
      <div class="form">
        <div class="field">
          <label for="seg-name">{{ t('segments.name') }} *</label>
          <InputText id="seg-name" v-model="segForm.name" maxlength="80" />
        </div>
        <SelectButton
          v-if="!segEditing"
          v-model="segForm.type"
          :options="[
            { value: 'dynamic', label: t('segments.types.dynamic') },
            { value: 'static', label: t('segments.types.static') },
          ]"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <small class="muted">{{
          segForm.type === 'dynamic' ? t('segments.dynamicHint') : t('segments.staticHint')
        }}</small>
        <template v-if="segForm.type === 'dynamic'">
          <div v-if="locations.length > 1" class="field">
            <label>{{ t('clients.filters.home') }}</label>
            <Select
              v-model="rules.location_id"
              :options="locations"
              option-label="name"
              option-value="id"
              show-clear
            />
          </div>
          <div class="field">
            <label>{{ t('clients.columns.status') }}</label>
            <MultiSelect
              v-model="rules.status"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              display="chip"
            />
          </div>
          <div class="row2">
            <div class="field">
              <label for="seg-age-min">{{ t('segments.ageMin') }}</label>
              <InputNumber v-model="rules.age_min" input-id="seg-age-min" :min="0" :max="120" />
            </div>
            <div class="field">
              <label for="seg-age-max">{{ t('segments.ageMax') }}</label>
              <InputNumber v-model="rules.age_max" input-id="seg-age-max" :min="0" :max="120" />
            </div>
          </div>
          <div class="field">
            <label for="seg-novisit">{{ t('segments.noVisitDays') }}</label>
            <InputNumber
              v-model="rules.no_visit_days"
              input-id="seg-novisit"
              :min="1"
              :max="3650"
              :suffix="` ${t('segments.days')}`"
            />
          </div>
          <div class="field">
            <label>{{ t('segments.withTags') }}</label>
            <MultiSelect
              v-model="rules.tag_ids"
              :options="tags"
              option-label="name"
              option-value="id"
              display="chip"
            />
          </div>
          <div class="count" role="status">
            <i class="pi pi-users" aria-hidden="true" />
            {{ count === null ? '…' : t('segments.match', count) }}
          </div>
        </template>
      </div>
      <template #footer>
        <div class="footer">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            variant="text"
            @click="segOpen = false"
          />
          <Button :label="t('common.save')" :disabled="!segForm.name.trim()" @click="saveSegment" />
        </div>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 16px;
  align-items: start;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
}
.head h3 {
  margin: 0;
  font: var(--text-h4);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.grow {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font: 500 14px var(--font-sans);
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.muted {
  font: var(--text-small);
  color: var(--text-muted);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.title {
  font: var(--text-h3);
}
.count {
  padding: 12px;
  border-radius: 8px;
  background: var(--surface-sunken);
  font: 600 15px var(--font-sans);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
@media (max-width: 860px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
