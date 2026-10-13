<script setup lang="ts">
// Health & emergency (US-05.03, brief 06 §3): emergency contacts (name, relation, phone) in calling
// order, and health notes, shown only to those allowed (clients.health_view, or the coach of a
// session the client is booked in); others see "Restricted".
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import { tenantApi, type ClientHealth } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { validationErrors } from '@/lib/http'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ clientId: number }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const health = ref<ClientHealth | null>(null)
async function load() {
  state.value = 'loading'
  try {
    health.value = await tenantApi.clients.health(props.clientId)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.clientId, load, { immediate: true })
const canEdit = computed(() => auth.can('clients.update'))

// Contacts
const contactsOpen = ref(false)
const rows = ref<{ name: string; relation: string; phone: string }[]>([])
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)
function editContacts() {
  rows.value = (health.value?.contacts ?? []).map(({ name, relation, phone }) => ({
    name,
    relation,
    phone,
  }))
  if (!rows.value.length) rows.value.push({ name: '', relation: '', phone: '' })
  errors.value = {}
  contactsOpen.value = true
}
const contactsReady = computed(() =>
  rows.value.every((r) => r.name.trim() && r.relation.trim() && r.phone.trim()),
)
async function saveContacts() {
  saving.value = true
  errors.value = {}
  try {
    health.value = await tenantApi.clients.updateEmergencyContacts(props.clientId, rows.value)
    contactsOpen.value = false
    emit('changed')
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length)
      toast.add({
        severity: 'error',
        summary: apiMessage(e) ?? t('common.genericError'),
        life: 4000,
      })
  } finally {
    saving.value = false
  }
}

// Health notes
const notesOpen = ref(false)
const notes = ref('')
function editNotes() {
  notes.value = health.value?.health_notes ?? ''
  notesOpen.value = true
}
async function saveNotes() {
  saving.value = true
  try {
    health.value = await tenantApi.clients.updateHealthNotes(
      props.clientId,
      notes.value.trim() || null,
    )
    notesOpen.value = false
    emit('changed')
  } catch (e) {
    toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card health">
    <div v-if="state === 'loading'" class="body"><Skeleton height="80px" /></div>
    <Message v-else-if="state === 'error' || !health" severity="error" :closable="false">{{
      t('clientHealth.loadError')
    }}</Message>
    <template v-else>
      <section class="block">
        <div class="block__head">
          <h3>{{ t('clientHealth.contacts') }}</h3>
          <Button
            v-if="canEdit"
            size="small"
            variant="text"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            @click="editContacts"
          />
        </div>
        <p v-if="!health.contacts.length" class="muted">{{ t('clientHealth.noContacts') }}</p>
        <ol v-else class="contacts">
          <li v-for="c in health.contacts" :key="c.id">
            <span class="contacts__name">{{ c.name }}</span>
            <span class="muted">{{ c.relation }}</span>
            <a :href="`tel:${c.phone}`" dir="ltr" class="num">{{ c.phone }}</a>
          </li>
        </ol>
      </section>

      <section class="block">
        <div class="block__head">
          <h3><i class="pi pi-heart" aria-hidden="true" /> {{ t('clientHealth.notes') }}</h3>
          <Button
            v-if="health.can_edit_health && canEdit"
            size="small"
            variant="text"
            icon="pi pi-pencil"
            :label="t('common.edit')"
            @click="editNotes"
          />
        </div>
        <Message
          v-if="health.health_restricted"
          severity="secondary"
          :closable="false"
          icon="pi pi-lock"
          >{{
            health.has_health_notes
              ? t('clientHealth.restricted')
              : t('clientHealth.restrictedNone')
          }}</Message
        >
        <p v-else-if="health.health_notes" class="notes">{{ health.health_notes }}</p>
        <p v-else class="muted">{{ t('clientHealth.noNotes') }}</p>
      </section>
    </template>
  </div>

  <Dialog
    v-model:visible="contactsOpen"
    modal
    :header="t('clientHealth.contacts')"
    :style="{ width: '560px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="rows">
      <div v-for="(r, i) in rows" :key="i" class="row">
        <InputText
          v-model="r.name"
          :placeholder="t('clientHealth.name')"
          :aria-label="t('clientHealth.name')"
          :invalid="!!errors[`contacts.${i}.name`]"
        />
        <InputText
          v-model="r.relation"
          :placeholder="t('clientHealth.relation')"
          :aria-label="t('clientHealth.relation')"
          :invalid="!!errors[`contacts.${i}.relation`]"
        />
        <InputText
          v-model="r.phone"
          dir="ltr"
          inputmode="tel"
          :placeholder="t('clientHealth.phone')"
          :aria-label="t('clientHealth.phone')"
          :invalid="!!errors[`contacts.${i}.phone`]"
        />
        <Button
          icon="pi pi-trash"
          variant="text"
          severity="secondary"
          :aria-label="t('clientHealth.removeContact')"
          @click="rows.splice(i, 1)"
        />
        <small v-if="errors[`contacts.${i}.phone`]" class="error">{{
          errors[`contacts.${i}.phone`]![0]
        }}</small>
      </div>
      <Button
        v-if="rows.length < 5"
        size="small"
        variant="text"
        icon="pi pi-plus"
        :label="t('clientHealth.addContact')"
        @click="rows.push({ name: '', relation: '', phone: '' })"
      />
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="contactsOpen = false"
      />
      <Button
        :label="t('common.save')"
        :loading="saving"
        :disabled="!contactsReady"
        @click="saveContacts"
      />
    </template>
  </Dialog>

  <Dialog
    v-model:visible="notesOpen"
    modal
    :header="t('clientHealth.notes')"
    :style="{ width: '520px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <Message severity="secondary" :closable="false" icon="pi pi-lock">{{
      t('clientHealth.notesPrivacy')
    }}</Message>
    <Textarea
      v-model="notes"
      rows="6"
      auto-resize
      maxlength="5000"
      class="notes-input"
      :aria-label="t('clientHealth.notes')"
    />
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="notesOpen = false"
      />
      <Button :label="t('common.save')" :loading="saving" @click="saveNotes" />
    </template>
  </Dialog>
</template>

<style scoped>
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.health {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.block__head h3 {
  margin: 0;
  font: var(--text-h4);
}
.contacts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.contacts li {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: baseline;
}
.contacts__name {
  font: 500 14px var(--font-sans);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.notes {
  margin: 0;
  white-space: pre-wrap;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.2fr auto;
  gap: 8px;
  align-items: center;
}
.row .error {
  grid-column: 1 / -1;
  color: var(--sev-danger-fg);
}
.notes-input {
  width: 100%;
  margin-top: 12px;
}
@media (max-width: 560px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
