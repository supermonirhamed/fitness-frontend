<script setup lang="ts">
// Holidays & special hours of a branch (US-01.07), under its weekly hours.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ConfirmActionDialog from '@/components/patterns/ConfirmActionDialog.vue'
import EmptyState from '@/components/patterns/EmptyState.vue'
import HourOverrideDrawer from '@/components/locations/HourOverrideDrawer.vue'
import { tenantApi, type HourOverride } from '@/api/tenant'
import { splitByDate, todayIn } from '@/lib/businessHours'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ locationId: number; timezone: string; canEdit: boolean }>()
const { t } = useI18n()
const toast = useToast()
const format = useFormat()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const items = ref<HourOverride[]>([])
const showPast = ref(false)
const lists = computed(() => splitByDate(items.value, todayIn(props.timezone)))

async function load() {
  state.value = 'loading'
  try {
    items.value = await tenantApi.hourOverrides.list(props.locationId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

// Dates are calendar days at the branch; format them as such (UTC midnight, shown in UTC).
const day = (ymd: string) => format.date(`${ymd}T00:00:00Z`, 'UTC')
const dates = (o: HourOverride) =>
  o.start_date === o.end_date ? day(o.start_date) : `${day(o.start_date)} – ${day(o.end_date)}`
const hoursText = (o: HourOverride) =>
  (o.hours ?? []).map((r) => `${r.start}–${r.end === '24:00' ? '00:00' : r.end}`).join(' · ')

const drawerOpen = ref(false)
const editing = ref<HourOverride | null>(null)
function openDrawer(o: HourOverride | null = null) {
  editing.value = o
  drawerOpen.value = true
}
function onSaved(saved: HourOverride) {
  items.value = [...items.value.filter((i) => i.id !== saved.id), saved]
  toast.add({
    severity: 'success',
    summary: t('hourOverrides.saved', { label: saved.label }),
    life: 3000,
  })
}

const removing = ref<HourOverride | null>(null)
const removeOpen = ref(false)
const removeBusy = ref(false)
const removeError = ref<string | null>(null)
function askRemove(o: HourOverride) {
  removing.value = o
  removeError.value = null
  removeOpen.value = true
}
async function remove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await tenantApi.hourOverrides.remove(props.locationId, removing.value.id)
    items.value = items.value.filter((i) => i.id !== removing.value!.id)
    removeOpen.value = false
  } catch {
    removeError.value = t('common.genericError')
  } finally {
    removeBusy.value = false
  }
}
</script>

<template>
  <section class="section" aria-labelledby="overrides-title">
    <header class="head">
      <div>
        <h3 id="overrides-title">{{ t('hourOverrides.title') }}</h3>
        <p class="note">{{ t('hourOverrides.intro') }}</p>
      </div>
      <Button
        v-if="canEdit && state === 'ready'"
        icon="pi pi-plus"
        :label="t('hourOverrides.add')"
        severity="secondary"
        variant="outlined"
        @click="openDrawer()"
      />
    </header>

    <div v-if="state === 'loading'" class="stack">
      <Skeleton v-for="n in 2" :key="n" height="52px" />
    </div>
    <EmptyState
      v-else-if="state === 'error'"
      icon="pi-exclamation-triangle"
      :title="t('hourOverrides.loadError')"
    >
      <Button severity="secondary" variant="outlined" :label="t('common.retry')" @click="load" />
    </EmptyState>
    <template v-else>
      <EmptyState
        v-if="!lists.upcoming.length"
        icon="pi-calendar-times"
        :title="t('hourOverrides.none')"
        :body="t('hourOverrides.noneHint')"
      />
      <ul v-else class="list">
        <li v-for="o in lists.upcoming" :key="o.id" class="item">
          <div class="main">
            <span class="name">{{ o.label }}</span>
            <span class="dates">{{ dates(o) }}</span>
          </div>
          <Tag v-if="o.closed" severity="danger" :value="t('hourOverrides.closed')" />
          <span v-else class="hours" dir="ltr">{{ hoursText(o) }}</span>
          <div v-if="canEdit" class="actions">
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              rounded
              size="small"
              :aria-label="t('hourOverrides.edit', { label: o.label })"
              @click="openDrawer(o)"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              variant="text"
              rounded
              size="small"
              :aria-label="t('hourOverrides.delete', { label: o.label })"
              @click="askRemove(o)"
            />
          </div>
        </li>
      </ul>

      <template v-if="lists.past.length">
        <Button
          :label="
            showPast ? t('hourOverrides.hidePast') : t('hourOverrides.showPast', lists.past.length)
          "
          :icon="showPast ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          severity="secondary"
          variant="text"
          size="small"
          class="toggle"
          @click="showPast = !showPast"
        />
        <ul v-if="showPast" class="list past">
          <li v-for="o in lists.past" :key="o.id" class="item">
            <div class="main">
              <span class="name">{{ o.label }}</span>
              <span class="dates">{{ dates(o) }}</span>
            </div>
            <Tag v-if="o.closed" severity="secondary" :value="t('hourOverrides.closed')" />
            <span v-else class="hours" dir="ltr">{{ hoursText(o) }}</span>
          </li>
        </ul>
      </template>
    </template>

    <HourOverrideDrawer
      v-model:visible="drawerOpen"
      :location-id="locationId"
      :timezone="timezone"
      :override="editing"
      @saved="onSaved"
    />
    <ConfirmActionDialog
      v-model:visible="removeOpen"
      :title="t('hourOverrides.deleteTitle', { label: removing?.label ?? '' })"
      :description="t('hourOverrides.deleteBody')"
      :confirm-label="t('hourOverrides.deleteConfirm')"
      destructive
      :loading="removeBusy"
      :error="removeError"
      @confirm="remove"
    />
  </section>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-subtle);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
h3 {
  margin: 0;
  font: var(--text-h4);
}
.note {
  margin: var(--space-1) 0 0;
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
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: var(--fw-medium);
}
.dates,
.hours {
  font: var(--text-small);
  color: var(--text-muted);
}
.actions {
  display: flex;
}
.past {
  opacity: 0.8;
}
.toggle {
  align-self: flex-start;
}
</style>
