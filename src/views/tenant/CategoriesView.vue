<script setup lang="ts">
// Service categories page (US-02.01), as in the design (ServicesScreen.jsx CategoriesScreen):
// one bordered list, drag to reorder, edit / archive per row. Unused categories can be deleted.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PageHeader from '@/components/patterns/PageHeader.vue'
import CategoryFormDialog from '@/components/services/CategoryFormDialog.vue'
import { tenantApi, type ServiceCategory } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const { t, locale } = useI18n()
// The name in the interface language first, the other one under it.
const primaryName = (c: ServiceCategory) =>
  (locale.value === 'ar' ? c.name.ar || c.name.en : c.name.en || c.name.ar) || '—'
const otherName = (c: ServiceCategory) => (locale.value === 'ar' ? c.name.en : c.name.ar) || ''
const toast = useToast()
const auth = useStaffAuth()
const canCreate = computed(() => auth.can('services.create'))
const canUpdate = computed(() => auth.can('services.update'))
const canDelete = computed(() => auth.can('services.delete'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const categories = ref<ServiceCategory[]>([])
const archived = ref(false)

async function load() {
  state.value = 'loading'
  try {
    categories.value = await tenantApi.serviceCategories.list(archived.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)
watch(archived, load)

const formOpen = ref(false)
const editing = ref<ServiceCategory | null>(null)
function open(category: ServiceCategory | null = null) {
  editing.value = category
  formOpen.value = true
}
function onSaved(saved: ServiceCategory, created: boolean) {
  toast.add({
    severity: 'success',
    summary: t(created ? 'catalog.categoryCreated' : 'catalog.categorySaved', {
      name: saved.display_name,
    }),
    life: 3000,
  })
  load()
}

async function saveOrder() {
  try {
    categories.value = await tenantApi.serviceCategories.reorder(categories.value.map((c) => c.id))
    toast.add({ severity: 'info', summary: t('catalog.orderSaved'), life: 2500 })
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
    load()
  }
}
function shift(from: number, to: number) {
  if (from === to || to < 0 || to >= categories.value.length) return
  const list = [...categories.value]
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  categories.value = list
}
/** Keyboard reordering on the drag handle: arrow up / down. */
function onHandleKey(event: KeyboardEvent, index: number) {
  const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (!by) return
  event.preventDefault()
  shift(index, index + by)
  saveOrder()
}
const dragging = ref<number | null>(null)
function onDragOver(index: number) {
  if (dragging.value === null || dragging.value === index) return
  shift(dragging.value, index)
  dragging.value = index
}
function onDragEnd() {
  dragging.value = null
  saveOrder()
}

// Archive / restore / delete
type Action = 'archive' | 'restore' | 'delete'
const target = ref<{ category: ServiceCategory; action: Action } | null>(null)
const confirmOpen = ref(false)
const busy = ref(false)
const confirmError = ref<string | null>(null)
function ask(category: ServiceCategory, action: Action) {
  target.value = { category, action }
  confirmError.value = null
  confirmOpen.value = true
}
async function confirm() {
  if (!target.value) return
  const { category, action } = target.value
  busy.value = true
  try {
    if (action === 'archive') await tenantApi.serviceCategories.archive(category.id)
    else if (action === 'restore') await tenantApi.serviceCategories.restore(category.id)
    else await tenantApi.serviceCategories.remove(category.id)
    confirmOpen.value = false
    load()
  } catch (e) {
    confirmError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('catalog.categoriesTitle')"
      :breadcrumb="[
        { label: t('catalog.title'), to: { name: 'tenant.services' } },
        { label: t('catalog.categoriesTitle') },
      ]"
    >
      <template v-if="state === 'ready'" #meta>
        <span>{{ t('catalog.categoriesCount', categories.length) }}</span>
      </template>
      <template v-if="canUpdate" #actions><ArchiveFilter v-model="archived" /></template>
      <template v-if="canCreate" #primary>
        <Button icon="pi pi-plus" :label="t('catalog.newCategory')" @click="open()" />
      </template>
    </PageHeader>

    <div v-if="state === 'loading'" class="list" aria-busy="true" :aria-label="t('common.loading')">
      <div v-for="n in 4" :key="n" class="item"><Skeleton width="50%" /></div>
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      class="list"
      :title="t('catalog.loadError')"
      @retry="load"
    />
    <EmptyState
      v-else-if="!categories.length"
      class="list"
      :icon="archived ? 'pi-inbox' : 'pi-tags'"
      :title="archived ? t('archive.noneArchived') : t('catalog.noCategories')"
      :body="archived ? t('archive.noneArchivedHint') : t('catalog.noCategoriesHint')"
    >
      <Button
        v-if="!archived && canCreate"
        icon="pi pi-plus"
        :label="t('catalog.newCategory')"
        @click="open()"
      />
    </EmptyState>

    <ul v-else class="list">
      <li
        v-for="(c, index) in categories"
        :key="c.id"
        :class="['item', { 'item--dragging': dragging === index }]"
        :draggable="!archived && canUpdate"
        @dragstart="dragging = index"
        @dragover.prevent="onDragOver(index)"
        @dragend="onDragEnd"
      >
        <button
          v-if="!archived && canUpdate"
          type="button"
          class="handle"
          :aria-label="t('catalog.reorder', { name: c.display_name })"
          @keydown="onHandleKey($event, index)"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>
        <span
          class="icon"
          :style="{
            background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
            color: c.color,
          }"
          aria-hidden="true"
          ><i :class="['pi', c.icon]"
        /></span>
        <div class="names">
          <span class="names__primary">{{ primaryName(c) }}</span>
          <span v-if="otherName(c)" class="names__other"
            ><bdi>{{ otherName(c) }}</bdi></span
          >
        </div>
        <RouterLink
          v-if="c.services_count"
          class="count count--link"
          :to="{ name: 'tenant.services', query: { category: c.id } }"
          >{{ t('catalog.servicesCount', c.services_count) }}</RouterLink
        >
        <span v-else class="count">{{ t('catalog.servicesCount', 0) }}</span>
        <span class="actions">
          <template v-if="!archived && canUpdate">
            <Button
              v-tooltip.top="t('catalog.editTooltip')"
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('catalog.edit', { name: c.display_name })"
              @click="open(c)"
            />
            <Button
              v-tooltip.top="t('archive.archive')"
              icon="pi pi-inbox"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('archive.archive')"
              @click="ask(c, 'archive')"
            />
          </template>
          <Button
            v-if="archived && canUpdate"
            icon="pi pi-replay pi-dir"
            :label="t('archive.restore')"
            variant="outlined"
            size="small"
            @click="ask(c, 'restore')"
          />
          <Button
            v-if="canDelete && !c.services_count"
            v-tooltip.top="t('catalog.deleteTooltip')"
            icon="pi pi-trash"
            severity="danger"
            variant="text"
            size="small"
            :aria-label="t('catalog.delete', { name: c.display_name })"
            @click="ask(c, 'delete')"
          />
        </span>
      </li>
    </ul>
    <p v-if="state === 'ready' && categories.length > 1 && !archived && canUpdate" class="hint">
      <i class="pi pi-info-circle" aria-hidden="true" />{{ t('catalog.dragHint') }}
    </p>

    <CategoryFormDialog v-model:visible="formOpen" :category="editing" @saved="onSaved" />
    <ConfirmActionDialog
      v-model:visible="confirmOpen"
      :title="
        target
          ? t(`catalog.confirm.${target.action}.title`, { name: target.category.display_name })
          : ''
      "
      :description="target ? t(`catalog.confirm.${target.action}.body`) : ''"
      :confirm-label="target ? t(`catalog.confirm.${target.action}.button`) : ''"
      :destructive="target?.action !== 'restore'"
      :loading="busy"
      :error="confirmError"
      @confirm="confirm"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background-color 0.12s;
}
.item:last-child {
  border-bottom: 0;
}
.item:hover {
  background: var(--surface-hover, var(--surface-sunken));
}
.item--dragging {
  background: var(--surface-selected);
  box-shadow: inset 3px 0 0 var(--primary-500, var(--p-primary-color));
}
.handle {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: grab;
  padding: 6px;
  border-radius: 6px;
}
.handle:hover,
.handle:focus-visible {
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.icon {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.names {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.names__primary {
  font: 600 15px/1.3 var(--font-sans);
  color: var(--text-primary);
}
.names__other {
  font: var(--text-small);
  color: var(--text-muted);
}
.count {
  min-width: 90px;
  font: var(--text-small);
  color: var(--text-muted);
  white-space: nowrap;
  text-align: end;
}
.count--link {
  color: var(--text-link, var(--primary-700));
  text-decoration: none;
}
.count--link:hover {
  text-decoration: underline;
}
.actions {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}
.hint {
  margin: 0;
  display: flex;
  gap: 6px;
  align-items: center;
  font: var(--text-small);
  color: var(--text-muted);
}
</style>
