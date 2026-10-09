<script setup lang="ts">
// Service categories (US-02.01): ordered list, create/edit, reorder, archive/restore, delete
// (only when unused: a category in use is archived instead).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import ArchiveFilter from '@/components/patterns/ArchiveFilter.vue'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import CategoryFormDialog from '@/components/services/CategoryFormDialog.vue'
import { tenantApi, type ServiceCategory } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const emit = defineEmits<{ changed: [] }>()
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
  emit('changed')
}

async function move(index: number, by: number) {
  const ids = categories.value.map((c) => c.id)
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  try {
    categories.value = await tenantApi.serviceCategories.reorder(ids)
  } catch {
    toast.add({ severity: 'error', summary: t('common.genericError'), life: 4000 })
  }
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
    emit('changed')
  } catch (e) {
    confirmError.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <p class="note">{{ t('catalog.categoriesIntro') }}</p>
      <span class="spacer" />
      <ArchiveFilter v-if="canUpdate" v-model="archived" />
      <Button
        v-if="canCreate && !archived"
        icon="pi pi-plus"
        :label="t('catalog.newCategory')"
        @click="open()"
      />
    </div>

    <div v-if="state === 'loading'" class="stack">
      <Skeleton v-for="n in 3" :key="n" height="52px" />
    </div>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('catalog.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>
    <EmptyState
      v-else-if="!categories.length"
      :icon="archived ? 'pi-inbox' : 'pi-tags'"
      :title="archived ? t('archive.noneArchived') : t('catalog.noCategories')"
      :body="archived ? t('archive.noneArchivedHint') : t('catalog.noCategoriesHint')"
    >
      <Button
        v-if="canCreate && !archived"
        icon="pi pi-plus"
        :label="t('catalog.newCategory')"
        @click="open()"
      />
    </EmptyState>
    <ul v-else class="list">
      <li v-for="(c, i) in categories" :key="c.id" class="item">
        <span class="badge" :style="{ background: c.color }"
          ><i :class="['pi', c.icon]" aria-hidden="true"
        /></span>
        <div class="main">
          <span class="name">{{ c.display_name }}</span>
          <span class="sub">
            <span v-if="c.name.ar" lang="ar" dir="rtl">{{ c.name.ar }}</span>
            <span v-if="c.name.ar && c.name.en" aria-hidden="true"> · </span>
            <span v-if="c.name.en" lang="en" dir="ltr">{{ c.name.en }}</span>
          </span>
        </div>
        <span class="count">{{ t('catalog.servicesCount', c.services_count ?? 0) }}</span>
        <div class="actions">
          <template v-if="!archived && canUpdate">
            <Button
              icon="pi pi-arrow-up"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :disabled="i === 0"
              :aria-label="t('catalog.moveUp', { name: c.display_name })"
              @click="move(i, -1)"
            />
            <Button
              icon="pi pi-arrow-down"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :disabled="i === categories.length - 1"
              :aria-label="t('catalog.moveDown', { name: c.display_name })"
              @click="move(i, 1)"
            />
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :aria-label="t('catalog.edit', { name: c.display_name })"
              @click="open(c)"
            />
            <Button
              icon="pi pi-box"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :aria-label="t('archive.archive')"
              v-tooltip.top="t('archive.archive')"
              @click="ask(c, 'archive')"
            />
          </template>
          <Button
            v-if="archived && canUpdate"
            icon="pi pi-replay pi-dir"
            :label="t('archive.restore')"
            variant="text"
            size="small"
            @click="ask(c, 'restore')"
          />
          <Button
            v-if="canDelete && !c.services_count"
            icon="pi pi-trash"
            severity="danger"
            variant="text"
            rounded
            size="small"
            :aria-label="t('catalog.delete', { name: c.display_name })"
            @click="ask(c, 'delete')"
          />
        </div>
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
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.note {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}
.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.item + .item {
  border-top: 1px solid var(--border-subtle);
}
.badge {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: var(--fw-medium);
}
.sub,
.count {
  font: var(--text-caption);
  color: var(--text-muted);
}
.actions {
  display: flex;
  gap: var(--space-1);
}
@media (max-width: 560px) {
  .count {
    display: none;
  }
}
</style>
