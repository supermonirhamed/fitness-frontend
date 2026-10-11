<script setup lang="ts">
// Port of the design system's PageHeader pattern (design-reference/components/patterns/PageHeader.jsx):
// breadcrumb, title + status + meta on the start side; secondary actions, "more" menu and the one
// primary action on the end side.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'

export interface Crumb {
  label: string
  to?: RouteLocationRaw
}

defineProps<{ title: string; subtitle?: string; breadcrumb?: Crumb[]; moreItems?: MenuItem[] }>()
const { t } = useI18n()
const more = ref<InstanceType<typeof Menu>>()
</script>

<template>
  <header class="page-header">
    <nav v-if="breadcrumb?.length" :aria-label="t('shell.breadcrumb')">
      <ol class="crumbs">
        <li v-for="(c, i) in breadcrumb" :key="i">
          <RouterLink v-if="c.to && i < breadcrumb.length - 1" :to="c.to">{{ c.label }}</RouterLink>
          <span v-else :aria-current="i === breadcrumb.length - 1 ? 'page' : undefined">{{
            c.label
          }}</span>
          <i
            v-if="i < breadcrumb.length - 1"
            class="pi pi-chevron-right pi-dir"
            aria-hidden="true"
          />
        </li>
      </ol>
    </nav>
    <div class="page-header__row">
      <div class="page-header__text">
        <div class="page-header__title-row">
          <slot name="leading" />
          <h1>{{ title }}</h1>
          <slot name="status" />
        </div>
        <div v-if="subtitle || $slots.meta" class="page-header__meta">
          <slot name="meta"
            ><span>{{ subtitle }}</span></slot
          >
        </div>
      </div>
      <div
        v-if="$slots.actions || $slots.primary || moreItems?.length"
        class="page-header__actions"
      >
        <slot name="actions" />
        <template v-if="moreItems?.length">
          <Button
            icon="pi pi-ellipsis-h"
            severity="secondary"
            variant="outlined"
            :aria-label="t('common.moreActions')"
            aria-haspopup="true"
            @click="more?.toggle($event)"
          />
          <Menu ref="more" :model="moreItems" popup />
        </template>
        <slot name="primary" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font: var(--text-small);
}
.crumbs li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.crumbs a {
  color: var(--text-secondary);
}
.crumbs [aria-current='page'] {
  color: var(--text-primary);
  font-weight: 500;
}
.crumbs i {
  font-size: 10px;
  color: var(--text-muted);
}
.page-header__row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.page-header__text {
  flex: 1;
  min-width: 240px;
}
.page-header__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font: var(--text-h1);
  color: var(--text-primary);
}
.page-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  font: var(--text-small);
  color: var(--text-secondary);
}
.page-header__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}
</style>
