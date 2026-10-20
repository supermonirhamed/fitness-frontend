<script setup lang="ts">
// Port of the design system's shell/Sidebar: start side, collapsible, org logo slot + name.
// Related pages sit in groups: open in place when the sidebar is wide (the group of the current
// page opens by itself), and as a flyout next to the icon when it is collapsed.
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Popover from 'primevue/popover'

export interface NavItem {
  key: string
  icon: string
  /** A page; groups have children instead. */
  to?: string
  /** Highlight only on this exact route (e.g. "/", which contains every other page). */
  exact?: boolean
  children?: NavItem[]
}

const props = defineProps<{
  items: NavItem[]
  orgName: string
  logoUrl?: string | null
  collapsed?: boolean
}>()
const emit = defineEmits<{ toggle: []; navigate: [] }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

function isActive(item: NavItem): boolean {
  if (item.children) return item.children.some(isActive)
  const path = router.resolve(item.to!).path
  return item.exact ? route.path === path : route.path === path || route.path.startsWith(`${path}/`)
}

const open = ref(new Set<string>())
function toggleGroup(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}
// The group holding the current page opens by itself.
watch(
  [() => route.path, () => props.items],
  () => {
    const current = props.items.find((i) => i.children && isActive(i))
    if (current && !open.value.has(current.key)) open.value = new Set(open.value).add(current.key)
  },
  { immediate: true },
)

// Collapsed: a group's pages open in a flyout next to its icon.
const flyout = ref<InstanceType<typeof Popover>>()
const flyoutGroup = ref<NavItem | null>(null)
function openFlyout(event: Event, item: NavItem) {
  flyoutGroup.value = item
  flyout.value?.toggle(event)
}
function picked() {
  flyout.value?.hide()
  emit('navigate')
}
</script>

<template>
  <nav :aria-label="t('shell.mainNav')" :class="['sidebar', { 'sidebar--collapsed': collapsed }]">
    <div class="sidebar__org">
      <span class="sidebar__logo" aria-hidden="true">
        <img v-if="logoUrl" :src="logoUrl" alt="" />
        <i v-else class="pi pi-image" />
      </span>
      <span v-if="!collapsed" class="sidebar__org-name">{{ orgName }}</span>
    </div>
    <ul class="sidebar__items">
      <li v-for="item in items" :key="item.key">
        <template v-if="item.children">
          <button
            v-if="collapsed"
            type="button"
            :class="['sidebar__item', { 'sidebar__item--active': isActive(item) }]"
            :title="t(`shell.nav.${item.key}`)"
            :aria-label="t(`shell.nav.${item.key}`)"
            aria-haspopup="true"
            @click="openFlyout($event, item)"
          >
            <i :class="['pi', item.icon]" aria-hidden="true" />
          </button>
          <template v-else>
            <button
              type="button"
              :class="[
                'sidebar__item',
                { 'sidebar__item--within': isActive(item) && !open.has(item.key) },
              ]"
              :aria-expanded="open.has(item.key)"
              :aria-controls="`nav-group-${item.key}`"
              @click="toggleGroup(item.key)"
            >
              <i :class="['pi', item.icon]" aria-hidden="true" />
              <span class="sidebar__label">{{ t(`shell.nav.${item.key}`) }}</span>
              <i
                :class="[
                  'pi',
                  'sidebar__chevron',
                  open.has(item.key) ? 'pi-chevron-down' : 'pi-chevron-right pi-dir',
                ]"
                aria-hidden="true"
              />
            </button>
            <ul v-show="open.has(item.key)" :id="`nav-group-${item.key}`" class="sidebar__sub">
              <li v-for="child in item.children" :key="child.key">
                <RouterLink
                  :to="child.to!"
                  :class="['sidebar__item', { 'sidebar__item--active': isActive(child) }]"
                  active-class=""
                  exact-active-class=""
                  @click="emit('navigate')"
                >
                  <i :class="['pi', child.icon]" aria-hidden="true" />
                  <span>{{ t(`shell.nav.${child.key}`) }}</span>
                </RouterLink>
              </li>
            </ul>
          </template>
        </template>
        <RouterLink
          v-else
          :to="item.to!"
          class="sidebar__item"
          :active-class="item.exact ? '' : 'sidebar__item--active'"
          exact-active-class="sidebar__item--active"
          :title="collapsed ? t(`shell.nav.${item.key}`) : undefined"
          @click="emit('navigate')"
        >
          <i :class="['pi', item.icon]" aria-hidden="true" />
          <span v-if="!collapsed">{{ t(`shell.nav.${item.key}`) }}</span>
        </RouterLink>
      </li>
    </ul>
    <div class="sidebar__footer">
      <button
        type="button"
        class="sidebar__item sidebar__toggle"
        :aria-label="collapsed ? t('shell.expand') : t('shell.collapse')"
        @click="emit('toggle')"
      >
        <i
          :class="['pi', 'pi-dir', collapsed ? 'pi-angle-double-right' : 'pi-angle-double-left']"
        />
        <span v-if="!collapsed">{{ t('shell.collapse') }}</span>
      </button>
    </div>
    <Popover ref="flyout" class="sidebar__flyout">
      <template v-if="flyoutGroup">
        <strong class="sidebar__flyout-title">{{ t(`shell.nav.${flyoutGroup.key}`) }}</strong>
        <ul class="sidebar__flyout-items">
          <li v-for="child in flyoutGroup.children" :key="child.key">
            <RouterLink
              :to="child.to!"
              :class="['sidebar__item', { 'sidebar__item--active': isActive(child) }]"
              active-class=""
              exact-active-class=""
              @click="picked"
            >
              <i :class="['pi', child.icon]" aria-hidden="true" />
              <span>{{ t(`shell.nav.${child.key}`) }}</span>
            </RouterLink>
          </li>
        </ul>
      </template>
    </Popover>
  </nav>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-card);
  border-inline-end: 1px solid var(--border-default);
  transition: width var(--dur-base) var(--ease-standard);
}
.sidebar--collapsed {
  width: var(--sidebar-w-collapsed);
}
.sidebar__org {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--header-h);
  padding: 0 14px;
  border-bottom: 1px solid var(--border-subtle);
}
.sidebar__logo {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 8px;
  background: var(--surface-sunken);
  border: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}
.sidebar__org-name {
  font: 600 14px/1.3 var(--font-sans);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar__items,
.sidebar__sub,
.sidebar__flyout-items {
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sidebar__items {
  padding: var(--space-2);
  flex: 1;
  overflow: auto;
}
.sidebar__sub {
  padding: 2px 0 0;
  padding-inline-start: 18px;
}
.sidebar__flyout-items {
  padding: 0;
  min-width: 190px;
}
.sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font: 500 14px/1 var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  text-align: start;
}
.sidebar__sub .sidebar__item {
  height: 34px;
}
.sidebar--collapsed .sidebar__item {
  justify-content: center;
  padding: 0;
}
.sidebar__item:hover {
  background: var(--surface-hover);
  text-decoration: none;
  color: var(--text-secondary);
}
.sidebar__item i {
  font-size: 16px;
  width: 18px;
  text-align: center;
}
.sidebar__label {
  flex: 1;
}
.sidebar__item i.sidebar__chevron {
  font-size: 11px;
  color: var(--text-muted);
}
/* A closed group holding the current page. */
.sidebar__item--within {
  color: var(--primary-subtle-text);
  font-weight: 600;
}
.sidebar__item--active,
.sidebar__item--active:hover {
  background: var(--primary-subtle);
  color: var(--primary-subtle-text);
  font-weight: 600;
}
.sidebar__footer {
  padding: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}
.sidebar__toggle {
  color: var(--text-muted);
  font-size: 13px;
}
.sidebar__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.sidebar__flyout-title {
  display: block;
  padding: 2px 10px 8px;
  font: 600 13px/1.3 var(--font-sans);
  color: var(--text-muted);
}
</style>
