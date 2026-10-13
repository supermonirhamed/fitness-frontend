<script setup lang="ts">
// Merge duplicate clients (US-05.14, brief 06 §9): pick the duplicate, compare both profiles side by
// side and choose the winning value per field, see what moves to this profile (bookings, payments,
// notes, family…), then confirm. Irreversible: the duplicate is removed.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { tenantApi, type Client, type MergePreview } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ client: Client }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ merged: [client: Client] }>()
const { t } = useI18n()

const query = ref<string | Client>('')
const options = ref<Client[]>([])
const preview = ref<MergePreview | null>(null)
const choices = ref<Record<string, 'primary' | 'secondary'>>({})
const confirmed = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, (open) => {
  if (!open) return
  query.value = ''
  preview.value = null
  choices.value = {}
  confirmed.value = false
  error.value = null
})
async function search(e: AutoCompleteCompleteEvent) {
  options.value = (
    await tenantApi.clients.list({ q: e.query, per_page: 8 }).catch(() => ({ data: [] }))
  ).data.filter((c) => c.id !== props.client.id)
}
async function pick(other: Client) {
  error.value = null
  try {
    preview.value = await tenantApi.clients.mergePreview(props.client.id, other.id)
    // By default each field keeps this profile's value, or the duplicate's when this one is empty.
    choices.value = Object.fromEntries(
      Object.entries(preview.value.fields).map(([f, v]) => [
        f,
        v.primary === null && v.secondary !== null ? 'secondary' : 'primary',
      ]),
    )
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  }
}
const differing = computed(() =>
  Object.entries(preview.value?.fields ?? {}).filter(
    ([, v]) => v.primary !== null || v.secondary !== null,
  ),
)
const moves = computed(() => Object.entries(preview.value?.moves ?? {}).filter(([, n]) => n > 0))
async function merge() {
  if (!preview.value) return
  saving.value = true
  error.value = null
  try {
    const merged = await tenantApi.clients.merge(
      props.client.id,
      preview.value.secondary.id,
      choices.value,
    )
    emit('merged', merged)
    visible.value = false
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('merge.title')"
    :style="{ width: '720px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="merge">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div class="field">
        <label for="merge-search">{{ t('merge.duplicate') }}</label>
        <AutoComplete
          v-model="query"
          input-id="merge-search"
          :suggestions="options"
          option-label="name"
          :placeholder="t('booking.search')"
          :min-length="2"
          fluid
          @complete="search"
          @option-select="pick($event.value)"
        />
      </div>

      <template v-if="preview">
        <table class="compare">
          <thead>
            <tr>
              <th />
              <th>
                {{ t('merge.keep', { name: preview.primary.name, id: preview.primary.member_id }) }}
              </th>
              <th>
                {{
                  t('merge.remove', {
                    name: preview.secondary.name,
                    id: preview.secondary.member_id,
                  })
                }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[field, v] in differing" :key="field">
              <th scope="row">{{ t(`merge.fields.${field}`) }}</th>
              <td v-for="side in ['primary', 'secondary'] as const" :key="side">
                <label class="choice">
                  <input
                    v-model="choices[field]"
                    type="radio"
                    :name="`merge-${field}`"
                    :value="side"
                  />
                  <span :class="{ empty: v[side] === null }">{{ v[side] ?? '—' }}</span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="moves">
          <strong>{{ t('merge.moves') }}</strong>
          <span v-if="!moves.length" class="muted">{{ t('merge.nothing') }}</span>
          <span v-for="[what, n] in moves" :key="what" class="chip">{{
            t(`merge.what.${what}`, { n })
          }}</span>
        </div>
        <Message severity="warn" :closable="false" icon="pi pi-exclamation-triangle">{{
          t('merge.irreversible')
        }}</Message>
        <label class="confirm"
          ><Checkbox v-model="confirmed" binary /> {{ t('merge.confirm') }}</label
        >
      </template>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="visible = false"
      />
      <Button
        :label="t('merge.action')"
        severity="danger"
        :loading="saving"
        :disabled="!preview || !confirmed"
        @click="merge"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.merge {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.compare {
  width: 100%;
  border-collapse: collapse;
}
.compare th,
.compare td {
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle);
  text-align: start;
  font: var(--text-body);
}
.compare thead th {
  font: 600 13px var(--font-sans);
  color: var(--text-secondary);
}
.choice {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}
.choice input {
  accent-color: var(--primary);
}
.empty {
  color: var(--text-muted);
}
.moves {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.chip {
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--surface-sunken);
  font: var(--text-small);
}
.muted {
  color: var(--text-muted);
}
.confirm {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
