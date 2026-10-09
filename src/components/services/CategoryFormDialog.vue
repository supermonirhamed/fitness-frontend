<script setup lang="ts">
// Create or edit a service category (US-02.01): name (AR/EN), colour and icon.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import TranslatedField from '@/components/patterns/TranslatedField.vue'
import ColorPickerField from '@/components/services/ColorPickerField.vue'
import { tenantApi, type ServiceCategory, type Translated } from '@/api/tenant'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { CATEGORY_ICONS, emptyTranslated, translatedErrors } from '@/lib/catalog'

const props = defineProps<{ category: ServiceCategory | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [category: ServiceCategory, created: boolean] }>()
const { t } = useI18n()

const name = ref<Translated>(emptyTranslated())
const color = ref<string | null>('#7c3aed')
const icon = ref<string>('pi-heart')
const saving = ref(false)
const errors = ref<ValidationErrors>({})
const formError = ref<string | null>(null)
const editing = computed(() => props.category !== null)

watch(visible, (open) => {
  if (!open) return
  name.value = { ar: props.category?.name.ar ?? '', en: props.category?.name.en ?? '' }
  color.value = props.category?.color ?? '#7c3aed'
  icon.value = props.category?.icon ?? 'pi-heart'
  errors.value = {}
  formError.value = null
})

async function submit() {
  saving.value = true
  errors.value = {}
  formError.value = null
  const input = { name: name.value, color: color.value ?? '#7c3aed', icon: icon.value }
  try {
    const saved = props.category
      ? await tenantApi.serviceCategories.update(props.category.id, input)
      : await tenantApi.serviceCategories.create(input)
    emit('saved', saved, !editing.value)
    visible.value = false
  } catch (e) {
    errors.value = validationErrors(e)
    formError.value = Object.keys(errors.value).length
      ? t('locationForm.checkFields')
      : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="editing ? t('catalog.editCategory') : t('catalog.newCategory')"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <form id="category-form" class="form" @submit.prevent="submit">
      <TranslatedField
        id="category-name"
        v-model="name"
        :label="t('catalog.categoryName')"
        required
        :maxlength="80"
        :errors="translatedErrors(errors, 'name')"
      />
      <div class="field">
        <span id="category-color-label" class="label">{{ t('catalog.color') }} *</span>
        <ColorPickerField id="category-color" v-model="color" />
      </div>
      <div class="field">
        <span id="category-icon-label" class="label">{{ t('catalog.icon') }} *</span>
        <div class="icons" role="radiogroup" aria-labelledby="category-icon-label">
          <button
            v-for="i in CATEGORY_ICONS"
            :key="i"
            type="button"
            role="radio"
            class="icon"
            :aria-checked="icon === i"
            :aria-label="i.replace('pi-', '')"
            :style="icon === i ? { background: color ?? undefined, color: '#fff' } : undefined"
            @click="icon = i"
          >
            <i :class="['pi', i]" aria-hidden="true" />
          </button>
        </div>
      </div>
      <Message v-if="formError" severity="error" :closable="false" role="alert">{{
        formError
      }}</Message>
    </form>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button type="submit" form="category-form" :label="t('permissions.save')" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.label {
  font: var(--text-small);
  font-weight: var(--fw-medium);
}
.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, 40px);
  gap: var(--space-2);
}
.icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
  color: var(--text-secondary);
  cursor: pointer;
}
.icon[aria-checked='true'] {
  border-color: transparent;
}
</style>
