<script setup lang="ts">
// Modules × actions. Read-only ticks, or checkboxes/toggles while editing (US-00.07, US-00.08).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import { STANDARD_ACTIONS, specialActions } from '@/lib/permissions'

const props = defineProps<{
  modules: Record<string, string[]>
  granted: Set<string>
  editing?: boolean
  /** Whether the current user may switch this permission on (they can always switch it off). */
  canGrant?: (permission: string) => boolean
  caption: string
}>()
const emit = defineEmits<{ toggle: [permission: string] }>()

const { t, te } = useI18n()
const actionLabel = (action: string) =>
  te(`permissions.actions.${action}`) ? t(`permissions.actions.${action}`) : action

const rows = computed(() =>
  Object.entries(props.modules).map(([module, actions]) => ({
    module,
    actions,
    special: specialActions(actions),
    any: actions.some((a) => props.granted.has(`${module}.${a}`)),
  })),
)

const has = (module: string, action: string) => props.granted.has(`${module}.${action}`)
const locked = (module: string, action: string) =>
  !has(module, action) && !(props.canGrant?.(`${module}.${action}`) ?? true)
</script>

<template>
  <div class="matrix-wrap">
    <table :class="['matrix', { 'matrix--editing': editing }]">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('permissions.module') }}</th>
          <th v-for="action in STANDARD_ACTIONS" :key="action" scope="col" class="matrix__check">
            {{ actionLabel(action) }}
          </th>
          <th scope="col">{{ t('permissions.special') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.module" :class="{ 'matrix__row--none': !row.any }">
          <th scope="row">{{ t(`permissions.modules.${row.module}`) }}</th>
          <td v-for="action in STANDARD_ACTIONS" :key="action" class="matrix__check">
            <template v-if="row.actions.includes(action)">
              <Checkbox
                v-if="editing"
                :model-value="has(row.module, action)"
                binary
                :disabled="locked(row.module, action)"
                :aria-label="`${t(`permissions.modules.${row.module}`)}: ${actionLabel(action)}`"
                v-tooltip.top="
                  locked(row.module, action) ? t('permissions.cannotGrant') : undefined
                "
                @update:model-value="emit('toggle', `${row.module}.${action}`)"
              />
              <i
                v-else-if="has(row.module, action)"
                class="pi pi-check matrix__yes"
                :aria-label="t('permissions.allowed')"
              />
              <i v-else class="pi pi-minus matrix__no" :aria-label="t('permissions.notAllowed')" />
            </template>
          </td>
          <td>
            <div class="matrix__special">
              <component
                :is="editing ? 'button' : 'span'"
                v-for="action in row.special"
                :key="action"
                :type="editing ? 'button' : undefined"
                :class="['chip', has(row.module, action) ? 'chip--on' : 'chip--off']"
                :disabled="editing && locked(row.module, action) ? true : undefined"
                :aria-pressed="editing ? has(row.module, action) : undefined"
                v-tooltip.top="
                  editing && locked(row.module, action) ? t('permissions.cannotGrant') : undefined
                "
                @click="editing && emit('toggle', `${row.module}.${action}`)"
              >
                <i
                  :class="[
                    'pi',
                    has(row.module, action) ? 'pi-check' : editing ? 'pi-plus' : 'pi-minus',
                  ]"
                  aria-hidden="true"
                />
                {{ actionLabel(action) }}
                <span v-if="!editing" class="sr-only">{{
                  has(row.module, action) ? t('permissions.allowed') : t('permissions.notAllowed')
                }}</span>
              </component>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.matrix-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
}
.matrix {
  width: 100%;
  border-collapse: collapse;
  font: var(--text-small);
}
.matrix th,
.matrix td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  text-align: start;
  vertical-align: middle;
}
.matrix thead th {
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.matrix tbody th {
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.matrix tbody tr:last-child th,
.matrix tbody tr:last-child td {
  border-bottom: 0;
}
.matrix__row--none th {
  color: var(--text-muted);
}
.matrix--editing .matrix__row--none th {
  color: inherit;
}
.matrix__check {
  text-align: center !important;
  width: 72px;
}
.matrix__yes {
  color: var(--sev-success-fg);
}
.matrix__no {
  color: var(--border-strong);
  font-size: 11px;
}
.matrix__special {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font: var(--text-caption);
  white-space: nowrap;
}
button.chip {
  cursor: pointer;
}
button.chip:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.matrix--editing .chip--off {
  border-color: var(--border-default);
  border-style: dashed;
}
.chip i {
  font-size: 9px;
}
.chip--on {
  background: var(--sev-success-bg);
  color: var(--sev-success-fg);
}
.chip--off {
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
