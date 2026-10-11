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
import ErrorState from '@/components/patterns/ErrorState.vue'
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
  <section class="panel" aria-labelledby="overrides-title">
    <header class="head">
      <div class="head__text">
        <h3 id="overrides-title">{{ t('hourOverrides.title') }}</h3>
        <p class="note">{{ t('hourOverrides.intro') }}</p>
      </div>
      <Button
        v-if="canEdit && state === 'ready'"
        icon="pi pi-plus"
        :label="t('hourOverrides.add')"
        severity="secondary"
        @click="openDrawer()"
      />
    </header>

    <div v-if="state === 'loading'" class="pad">
      <Skeleton v-for="n in 2" :key="n" height="44px" />
    </div>
    <ErrorState
      v-else-if="state === 'error'"
      compact
      :title="t('hourOverrides.loadError')"
      @retry="load"
    />
    <template v-else>
      <EmptyState
        v-if="!lists.upcoming.length"
        compact
        icon="pi-calendar-times"
        :title="t('hourOverrides.none')"
        :body="t('hourOverrides.noneHint')"
      />
      <ul v-else class="list">
        <li v-for="o in lists.upcoming" :key="o.id" class="item">
          <span :class="['tile', o.closed ? 'tile--closed' : 'tile--hours']" aria-hidden="true"
            ><i :class="['pi', o.closed ? 'pi-ban' : 'pi-clock']"
          /></span>
          <div class="main">
            <span class="name">{{ o.label }}</span>
            <span class="dates">{{ dates(o) }}</span>
          </div>
          <Tag v-if="o.closed" severity="danger" :value="t('hourOverrides.closed')" />
          <Tag v-else severity="warn"
            ><span dir="ltr">{{ hoursText(o) }}</span></Tag
          >
          <div v-if="canEdit" class="actions">
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              variant="text"
              size="small"
              :aria-label="t('hourOverrides.edit', { label: o.label })"
              @click="openDrawer(o)"
            />
            <Button
              icon="pi pi-trash"
              severity="secondary"
              variant="text"
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
            <span class="tile" aria-hidden="true"
              ><i :class="['pi', o.closed ? 'pi-ban' : 'pi-clock']"
            /></span>
            <div class="main">
              <span class="name">{{ o.label }}</span>
              <span class="dates">{{ dates(o) }}</span>
            </div>
            <Tag v-if="o.closed" :value="t('hourOverrides.closed')" />
            <Tag v-else
              ><span dir="ltr">{{ hoursText(o) }}</span></Tag
            >
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
.panel {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-default);
}
.head__text {
  flex: 1;
}
h3 {
  margin: 0;
  font: var(--text-h3);
}
.note {
  margin: 2px 0 0;
  font: var(--text-small);
  color: var(--text-secondary);
}
.pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.list:last-child .item:last-child {
  border-bottom: 0;
}
.tile {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.tile--closed {
  background: var(--sev-danger-bg);
  color: var(--sev-danger-fg);
}
.tile--hours {
  background: var(--sev-warn-bg);
  color: var(--sev-warn-fg);
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font: 500 14px var(--font-sans);
}
.dates {
  font: var(--text-small);
  color: var(--text-secondary);
}
.actions {
  display: flex;
  gap: 2px;
}
.toggle {
  margin: 8px 12px;
}
.past .item {
  opacity: 0.7;
}
</style>
