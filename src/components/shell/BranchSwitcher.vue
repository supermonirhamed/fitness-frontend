<script setup lang="ts">
// Header branch switcher (US-01.13): "All my branches" plus each branch the user works at, with
// its timezone. The pick is kept on the account; screens that follow it read
// auth.currentLocation. With a single branch it is just shown, without a dropdown.
// Styled as the design's BranchSwitcher: bordered button with the zone badge.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { useStaffAuth } from '@/stores/staffAuth'
import { zoneAbbreviation } from '@/lib/datetime'

const ALL = 0 // Select needs a non-null value for the "all" option
const { t, locale } = useI18n()
const toast = useToast()
const auth = useStaffAuth()
const saving = ref(false)

const branches = computed(() => auth.user?.switchable_locations ?? [])
const options = computed(() => [
  { value: ALL, label: t('branchSwitcher.all'), zone: null as string | null },
  ...branches.value.map((b) => ({
    value: b.id,
    label: b.name,
    zone: zoneAbbreviation(b.timezone, locale.value),
  })),
])
const selected = computed(() => auth.user?.current_location_id ?? ALL)
const current = computed(() => options.value.find((o) => o.value === selected.value))
const menu = ref<InstanceType<typeof Menu>>()
// Design (shell/AppHeader.jsx BranchSwitcher): "All my branches", a separator, then each branch with its zone.
const items = computed<MenuItem[]>(() => [
  { label: options.value[0]!.label, icon: 'pi pi-sitemap', command: () => pick(ALL) },
  { separator: true },
  ...options.value.slice(1).map((o) => ({
    label: o.label,
    icon: o.value === selected.value ? 'pi pi-check' : 'pi pi-map-marker',
    zone: o.zone,
    command: () => pick(o.value),
  })),
])

async function pick(value: number) {
  if (value === selected.value) return
  saving.value = true
  try {
    await auth.setCurrentLocation(value === ALL ? null : value)
  } catch {
    toast.add({ severity: 'error', summary: t('branchSwitcher.error'), life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <button
    v-if="branches.length"
    type="button"
    class="switcher"
    :class="{ 'switcher--single': branches.length === 1 }"
    :aria-label="t('branchSwitcher.label')"
    :aria-haspopup="branches.length > 1"
    :disabled="saving"
    @click="branches.length > 1 && menu?.toggle($event)"
  >
    <i
      :class="['pi', saving ? 'pi-spin pi-spinner' : 'pi-map-marker', 'switcher__icon']"
      aria-hidden="true"
    />
    <span class="switcher__name">{{
      branches.length === 1 ? branches[0]!.name : current?.label
    }}</span>
    <span v-if="branches.length === 1 || current?.zone" class="zone" dir="ltr">{{
      branches.length === 1 ? zoneAbbreviation(branches[0]!.timezone, locale) : current?.zone
    }}</span>
    <i v-if="branches.length > 1" class="pi pi-chevron-down switcher__chevron" aria-hidden="true" />
  </button>
  <Menu ref="menu" :model="items" popup class="switcher-menu">
    <template #item="{ item, props: p }">
      <a v-bind="p.action" class="switcher-menu__item">
        <i :class="item.icon" aria-hidden="true" />
        <span class="switcher-menu__label">{{ item.label }}</span>
        <span v-if="item.zone" class="switcher-menu__zone" dir="ltr">{{ item.zone }}</span>
      </a>
    </template>
  </Menu>
</template>

<style scoped>
.switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  max-width: 280px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  font: 500 14px var(--font-sans);
  cursor: pointer;
}
.switcher--single {
  cursor: default;
}
.switcher:not(.switcher--single):hover {
  background: var(--surface-hover);
}
.switcher__icon {
  color: var(--text-muted);
}
.switcher__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.zone {
  font: 600 10px/18px var(--font-sans);
  padding: 0 5px;
  border-radius: 4px;
  background: var(--surface-sunken);
  color: var(--text-secondary);
}
.switcher__chevron {
  font-size: 11px;
  color: var(--text-muted);
}
.switcher-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.switcher-menu__item i {
  color: var(--text-muted);
}
.switcher-menu__label {
  flex: 1;
}
.switcher-menu__zone {
  font: var(--text-caption);
  color: var(--text-muted);
}
@media (max-width: 560px) {
  .switcher {
    max-width: 160px;
  }
  .zone {
    display: none;
  }
}
</style>
