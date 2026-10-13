<script setup lang="ts">
// Health & emergency (US-05.03, brief 06 §3): emergency contacts (name, relation, phone) in calling
// order, and health notes, shown only to those allowed (clients.health_view, or the coach of a
// session the client is booked in); others see "Restricted".
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import EmptyState from '@/components/patterns/EmptyState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
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

  <FormDialog
    v-model:visible="contactsOpen"
    :title="t('clientHealth.contacts')"
    :subtitle="t('clientHealth.contactsHint')"
    icon="pi-phone"
    size="lg"
    :saving="saving"
    :save-disabled="!contactsReady"
    @save="saveContacts"
  >
    <EmptyState v-if="!rows.length" compact icon="pi-phone" :title="t('clientHealth.noContacts')" />
    <div v-for="(r, i) in rows" :key="i" class="contact">
      <div class="contact__head">
        <span class="contact__n">{{ t('clientHealth.contactN', { n: i + 1 }) }}</span>
        <Button
          icon="pi pi-trash"
          variant="text"
          severity="secondary"
          size="small"
          :aria-label="t('clientHealth.removeContact')"
          @click="rows.splice(i, 1)"
        />
      </div>
      <div class="contact__grid">
        <FormField
          :label="t('clientHealth.name')"
          :for="`ec-name-${i}`"
          required
          :error="errors[`contacts.${i}.name`]?.[0]"
        >
          <InputText
            :id="`ec-name-${i}`"
            v-model="r.name"
            fluid
            :invalid="!!errors[`contacts.${i}.name`]"
          />
        </FormField>
        <FormField
          :label="t('clientHealth.relation')"
          :for="`ec-rel-${i}`"
          required
          :error="errors[`contacts.${i}.relation`]?.[0]"
        >
          <InputText
            :id="`ec-rel-${i}`"
            v-model="r.relation"
            fluid
            :invalid="!!errors[`contacts.${i}.relation`]"
          />
        </FormField>
        <FormField
          :label="t('clientHealth.phone')"
          :for="`ec-phone-${i}`"
          required
          :error="errors[`contacts.${i}.phone`]?.[0]"
        >
          <InputText
            :id="`ec-phone-${i}`"
            v-model="r.phone"
            dir="ltr"
            inputmode="tel"
            fluid
            :invalid="!!errors[`contacts.${i}.phone`]"
          />
        </FormField>
      </div>
    </div>
    <Button
      v-if="rows.length < 5"
      class="add-contact"
      severity="secondary"
      variant="outlined"
      icon="pi pi-plus"
      :label="t('clientHealth.addContact')"
      @click="rows.push({ name: '', relation: '', phone: '' })"
    />
  </FormDialog>

  <FormDialog
    v-model:visible="notesOpen"
    :title="t('clientHealth.notes')"
    icon="pi-heart"
    :saving="saving"
    @save="saveNotes"
  >
    <Message severity="secondary" :closable="false" icon="pi pi-lock" size="small">{{
      t('clientHealth.notesPrivacy')
    }}</Message>
    <FormField :label="t('clientHealth.notes')" for="health-notes" :help="`${notes.length} / 5000`">
      <Textarea id="health-notes" v-model="notes" rows="6" auto-resize maxlength="5000" fluid />
    </FormField>
  </FormDialog>
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
.contact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.contact__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.contact__n {
  font: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.contact__grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.2fr;
  gap: 12px;
}
.add-contact {
  align-self: flex-start;
}
@media (max-width: 640px) {
  .contact__grid {
    grid-template-columns: 1fr;
  }
}
</style>
