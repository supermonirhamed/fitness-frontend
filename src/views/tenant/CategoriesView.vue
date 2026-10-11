<script setup lang="ts">
// Service categories page (US-02.01), as in the design (ServicesScreen.jsx CategoriesScreen):
// one bordered list, drag to reorder, edit / archive per row. Unused categories can be deleted.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
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
      :subtitle="t('catalog.dragHint')"
      :breadcrumb="[
        { label: t('catalog.title'), to: { name: 'tenant.services' } },
        { label: t('catalog.categoriesTitle') },
      ]"
    >
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
          <span class="names__ar" dir="rtl">{{ c.name.ar || '—' }}</span>
          <span class="names__en" dir="ltr">{{ c.name.en || '—' }}</span>
        </div>
        <span class="count">{{ t('catalog.servicesCount', c.services_count ?? 0) }}</span>
        <template v-if="!archived && canUpdate">
          <Button
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
          icon="pi pi-trash"
          severity="danger"
          variant="text"
          size="small"
          :aria-label="t('catalog.delete', { name: c.display_name })"
          @click="ask(c, 'delete')"
        />
      </li>
    </ul>

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
  max-width: 820px;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.item:last-child {
  border-bottom: 0;
}
.item--dragging {
  background: var(--surface-selected);
}
.handle {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: grab;
  padding: 4px;
  border-radius: 4px;
}
.icon {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.names {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.names__ar {
  font: 500 14px var(--font-arabic);
}
.names__en {
  font: var(--text-body);
  color: var(--text-secondary);
}
.count {
  font: var(--text-small);
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
