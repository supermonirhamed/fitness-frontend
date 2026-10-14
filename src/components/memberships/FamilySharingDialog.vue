<script setup lang="ts">
// Family sharing (US-06.15): the holder, a guardian, chooses which of their children (US-05.08)
// share a membership or package whose product allows it, up to its maximum. They all use one pool;
// each booking is recorded against the child who booked.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import FormDialog from '@/components/patterns/FormDialog.vue'
import { tenantApi, type ClientEntitlement, type FamilyLink } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'

const props = defineProps<{ clientId: number; entitlement: ClientEntitlement | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [entitlement: ClientEntitlement] }>()
const { t } = useI18n()

const e = computed(() => props.entitlement)
const children = ref<FamilyLink[] | null>(null)
const chosen = ref<number[]>([])
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, async (open) => {
  if (!open || !e.value) return
  chosen.value = e.value.sharing?.members.map((m) => m.id) ?? []
  error.value = null
  children.value = null
  try {
    children.value = (await tenantApi.clients.family(props.clientId)).dependents.filter(
      (d) => d.client,
    )
  } catch {
    children.value = []
    error.value = t('common.genericError')
  }
})

const max = computed(() => e.value?.sharing?.max ?? 0)
const full = (id: number) => chosen.value.length >= max.value && !chosen.value.includes(id)

async function save() {
  if (!e.value) return
  saving.value = true
  error.value = null
  try {
    const saved = await tenantApi.clients.setSharers(props.clientId, e.value.id, chosen.value)
    visible.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiMessage(err) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    v-model:visible="visible"
    :title="t('sharing.title')"
    :subtitle="e?.name"
    icon="pi-users"
    size="sm"
    :save-label="t('sharing.save')"
    :saving="saving"
    :save-disabled="children === null"
    :error="error"
    @save="save"
  >
    <p class="text">{{ t('sharing.text', { n: max }) }}</p>
    <Skeleton v-if="children === null" height="64px" />
    <Message v-else-if="!children.length" severity="secondary" :closable="false" size="small">{{
      t('sharing.noChildren')
    }}</Message>
    <ul v-else class="members">
      <li v-for="c in children" :key="c.id">
        <Checkbox
          v-model="chosen"
          :input-id="`share-${c.client!.id}`"
          :value="c.client!.id"
          :disabled="full(c.client!.id)"
        />
        <label :for="`share-${c.client!.id}`">
          {{ c.client!.name }}
          <small v-if="c.client!.age !== null" class="muted">{{
            t('sharing.age', { n: c.client!.age })
          }}</small>
        </label>
      </li>
    </ul>
  </FormDialog>
</template>

<style scoped>
.text {
  margin: 0;
}
.members {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.members li {
  display: flex;
  gap: 10px;
  align-items: center;
}
.muted {
  color: var(--text-muted);
  font: var(--text-small);
  margin-inline-start: 6px;
}
</style>
