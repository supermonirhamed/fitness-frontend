<script setup lang="ts">
// New role (copy of an existing one) or rename (US-00.08).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import type { AccessScope, RoleSummary } from '@/api/tenant'

const props = defineProps<{
  mode: 'create' | 'rename'
  roles: RoleSummary[]
  scopes: AccessScope[]
  /** create: the role to copy first; rename: the role being renamed */
  role: RoleSummary | null
  loading?: boolean
  error?: string | null
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  submit: [value: { name: string; source: RoleSummary | null; scope: AccessScope }]
}>()

const { t, te } = useI18n()
const roleLabel = (name: string) => (te(`roles.${name}`) ? t(`roles.${name}`) : name)

const name = ref('')
const sourceId = ref<number | null>(null)
const scope = ref<AccessScope>('organization')

const source = computed(() => props.roles.find((r) => r.id === sourceId.value) ?? null)
const sourceOptions = computed(() =>
  props.roles.map((r) => ({ value: r.id, label: roleLabel(r.name) })),
)
const scopeOptions = computed(() =>
  props.scopes.map((s) => ({ value: s, label: t(`permissions.scopeNames.${s}`) })),
)

watch(visible, (open) => {
  if (!open) return
  if (props.mode === 'rename') {
    name.value = props.role?.name ?? ''
  } else {
    name.value = ''
    sourceId.value = props.role?.id ?? props.roles[0]?.id ?? null
    scope.value = props.role?.scope ?? 'organization'
  }
})
// A new copy takes the source's scope until the user picks another one.
watch(sourceId, () => {
  if (props.mode === 'create' && source.value) scope.value = source.value.scope
})

const valid = computed(() => name.value.trim().length > 0 && name.value.trim().length <= 60)

function submit() {
  if (valid.value)
    emit('submit', { name: name.value.trim(), source: source.value, scope: scope.value })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="mode === 'create' ? t('permissions.newRole') : t('permissions.renameRole')"
    :style="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="role-form" class="form" @submit.prevent="submit">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="role-name">{{ t('permissions.roleName') }}</label>
        <InputText
          id="role-name"
          v-model="name"
          maxlength="60"
          autofocus
          fluid
          :invalid="!!error"
        />
      </div>
      <template v-if="mode === 'create'">
        <div class="field">
          <label for="role-source">{{ t('permissions.copyFrom') }}</label>
          <Select
            v-model="sourceId"
            input-id="role-source"
            :options="sourceOptions"
            option-label="label"
            option-value="value"
            fluid
          />
          <small>{{ t('permissions.copyHint') }}</small>
        </div>
        <div class="field">
          <label for="role-scope">{{ t('permissions.scope') }}</label>
          <Select
            v-model="scope"
            input-id="role-scope"
            :options="scopeOptions"
            option-label="label"
            option-value="value"
            fluid
          />
          <small>{{ t(`permissions.scopes.${scope}`) }}</small>
        </div>
      </template>
    </form>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="role-form"
        :label="mode === 'create' ? t('permissions.create') : t('permissions.save')"
        :disabled="!valid"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font: var(--fw-medium) var(--fs-small) / var(--lh-small) var(--font-sans);
}
.field small {
  font: var(--text-caption);
  font-weight: var(--fw-regular);
  color: var(--text-muted);
}
</style>
