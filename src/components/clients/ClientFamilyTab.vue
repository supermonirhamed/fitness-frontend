<script setup lang="ts">
// A client's family (US-05.08, brief 06 §4): guardians and children as person chips with their
// relation, and per guardian–child permissions (can book, can pay, can view performance, receives
// notifications). Staff add a new child (no email or phone needed), link an existing client as a
// child, or add a guardian to a child. Children never log in: guardians act for them (D6).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import ErrorState from '@/components/patterns/ErrorState.vue'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import {
  tenantApi,
  type Client,
  type ClientFamily,
  type FamilyLink,
  type GuardianPermission,
} from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ client: Client }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useStaffAuth()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const family = ref<ClientFamily | null>(null)
async function load() {
  state.value = 'loading'
  try {
    family.value = await tenantApi.clients.family(props.client.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
watch(() => props.client.id, load, { immediate: true })
const canEdit = computed(() => auth.can('clients.update'))
const PERMISSIONS: GuardianPermission[] = [
  'can_book',
  'can_pay',
  'can_view_performance',
  'receives_notifications',
]
const relationOptions = computed(() =>
  (['mother', 'father', 'guardian', 'other'] as const).map((v) => ({
    value: v,
    label: t(`family.relations.${v}`),
  })),
)
const fail = (e: unknown) =>
  toast.add({ severity: 'error', summary: apiMessage(e) ?? t('common.genericError'), life: 4000 })

async function setPermission(link: FamilyLink, permission: GuardianPermission, value: boolean) {
  try {
    Object.assign(
      link,
      await tenantApi.clients.updateGuardianship(link.id, { [permission]: value }),
    )
  } catch (e) {
    fail(e)
  }
}
async function setRelation(link: FamilyLink, relation: FamilyLink['relation']) {
  try {
    Object.assign(link, await tenantApi.clients.updateGuardianship(link.id, { relation }))
  } catch (e) {
    fail(e)
  }
}
async function unlink(link: FamilyLink) {
  try {
    await tenantApi.clients.unlinkFamily(link.id)
    await load()
    emit('changed')
  } catch (e) {
    fail(e)
  }
}

// Add a child (new client) or link an existing client as a child or a guardian.
const dialog = ref<'child' | 'linkChild' | 'linkGuardian' | null>(null)
const child = ref({
  first_name: '',
  last_name: '',
  dob: null as Date | null,
  gender: null as 'female' | 'male' | null,
})
const relation = ref<FamilyLink['relation']>('guardian')
const query = ref<string | Client>('')
const options = ref<Client[]>([])
const picked = ref<Client | null>(null)
const saving = ref(false)
function open(kind: 'child' | 'linkChild' | 'linkGuardian') {
  child.value = { first_name: '', last_name: props.client.last_name, dob: null, gender: null }
  relation.value = 'guardian'
  query.value = ''
  picked.value = null
  dialog.value = kind
}
async function search(e: AutoCompleteCompleteEvent) {
  options.value = (
    await tenantApi.clients.list({ q: e.query, per_page: 8 }).catch(() => ({ data: [] }))
  ).data.filter((c) => c.id !== props.client.id)
}
const ymd = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : null
const ready = computed(() =>
  dialog.value === 'child'
    ? !!child.value.first_name.trim() && !!child.value.last_name.trim()
    : !!picked.value,
)
async function save() {
  saving.value = true
  try {
    if (dialog.value === 'child')
      family.value = await tenantApi.clients.addChild(props.client.id, {
        first_name: child.value.first_name.trim(),
        last_name: child.value.last_name.trim(),
        date_of_birth: ymd(child.value.dob),
        gender: child.value.gender,
        relation: relation.value,
      })
    else if (picked.value)
      family.value = await tenantApi.clients.linkFamily(props.client.id, {
        client_id: picked.value.id,
        as: dialog.value === 'linkChild' ? 'dependent' : 'guardian',
        relation: relation.value,
      })
    dialog.value = null
    emit('changed')
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}
const maxDob = new Date()
</script>

<template>
  <div class="stack">
    <div v-if="state === 'loading'" class="card pad"><Skeleton height="64px" /></div>
    <ErrorState
      v-else-if="state === 'error' || !family"
      class="card"
      :title="t('family.loadError')"
      @retry="load"
    />
    <template v-else>
      <Message v-if="family.is_child" severity="info" :closable="false" icon="pi pi-info-circle">{{
        t('family.childInfo')
      }}</Message>
      <RouterLink
        v-if="family.guardians.length || family.dependents.length"
        :to="{ name: 'tenant.client.family', params: { id: client.id } }"
        class="open-family"
        ><i class="pi pi-users" aria-hidden="true" /> {{ t('familyPage.open') }}</RouterLink
      >

      <section v-for="side in ['guardians', 'dependents'] as const" :key="side" class="card">
        <div class="head">
          <h3>{{ t(`family.${side}`) }}</h3>
          <span v-if="canEdit" class="actions">
            <template v-if="side === 'dependents'">
              <Button
                v-if="auth.can('clients.create')"
                size="small"
                icon="pi pi-plus"
                :label="t('family.addChild')"
                @click="open('child')"
              />
              <Button
                size="small"
                variant="text"
                icon="pi pi-link"
                :label="t('family.linkChild')"
                @click="open('linkChild')"
              />
            </template>
            <Button
              v-else
              size="small"
              variant="text"
              icon="pi pi-link"
              :label="t('family.addGuardian')"
              @click="open('linkGuardian')"
            />
          </span>
        </div>
        <p v-if="!family[side].length" class="muted pad">{{ t(`family.none.${side}`) }}</p>
        <ul v-else class="links">
          <li v-for="link in family[side]" :key="link.id" class="link">
            <RouterLink
              v-if="link.client"
              :to="{ name: 'tenant.client', params: { id: link.client.id } }"
              class="who"
            >
              <PersonAvatar :name="link.client.name" :image="link.client.photo_url" />
              <span>
                <span class="who__name">{{ link.client.name }}</span>
                <small class="muted">
                  {{ t(`family.relations.${link.relation}`) }}
                  <template v-if="link.client.age !== null">
                    · {{ t('clients.age', { n: link.client.age }) }}</template
                  >
                </small>
              </span>
            </RouterLink>
            <Select
              v-if="canEdit"
              :model-value="link.relation"
              :options="relationOptions"
              option-label="label"
              option-value="value"
              :aria-label="t('family.relation')"
              class="relation"
              @update:model-value="setRelation(link, $event)"
            />
            <div class="perms">
              <label v-for="p in PERMISSIONS" :key="p" class="perm">
                <ToggleSwitch
                  :model-value="link[p]"
                  :disabled="!canEdit"
                  @update:model-value="setPermission(link, p, $event)"
                />
                <span>{{ t(`family.permissions.${p}`) }}</span>
              </label>
            </div>
            <Button
              v-if="canEdit"
              icon="pi pi-times"
              variant="text"
              severity="secondary"
              :aria-label="t('family.unlink')"
              @click="unlink(link)"
            />
          </li>
        </ul>
      </section>
    </template>
  </div>

  <Dialog
    :visible="dialog !== null"
    modal
    :header="dialog ? t(`family.dialogs.${dialog}`) : ''"
    :style="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
    @update:visible="(v: boolean) => !v && (dialog = null)"
  >
    <div class="form">
      <template v-if="dialog === 'child'">
        <div class="row">
          <div class="field">
            <label for="child-first">{{ t('clients.firstName') }} *</label>
            <InputText id="child-first" v-model="child.first_name" maxlength="60" />
          </div>
          <div class="field">
            <label for="child-last">{{ t('clients.lastName') }} *</label>
            <InputText id="child-last" v-model="child.last_name" maxlength="60" />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="child-dob">{{ t('clients.dob') }}</label>
            <DatePicker
              v-model="child.dob"
              input-id="child-dob"
              date-format="yy-mm-dd"
              :max-date="maxDob"
              show-icon
              icon-display="input"
              fluid
            />
          </div>
          <div class="field">
            <span id="child-gender">{{ t('clients.genderLabel') }}</span>
            <SelectButton
              v-model="child.gender"
              :options="[
                { value: 'female', label: t('clients.gender.female') },
                { value: 'male', label: t('clients.gender.male') },
              ]"
              option-label="label"
              option-value="value"
              aria-labelledby="child-gender"
            />
          </div>
        </div>
        <small class="muted">{{ t('family.noContactNeeded') }}</small>
      </template>
      <div v-else class="field">
        <label for="family-search">{{ t('booking.client') }} *</label>
        <AutoComplete
          v-model="query"
          input-id="family-search"
          :suggestions="options"
          option-label="name"
          :placeholder="t('booking.search')"
          :min-length="2"
          fluid
          @complete="search"
          @option-select="picked = $event.value"
        />
      </div>
      <div class="field">
        <label for="family-relation">{{
          t('family.relationOf', { name: dialog === 'linkGuardian' ? '' : client.first_name })
        }}</label>
        <Select
          v-model="relation"
          input-id="family-relation"
          :options="relationOptions"
          option-label="label"
          option-value="value"
        />
      </div>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        variant="text"
        @click="dialog = null"
      />
      <Button :label="t('common.save')" :loading="saving" :disabled="!ready" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.open-family {
  align-self: flex-start;
  color: var(--text-link);
  text-decoration: none;
  font: 500 14px var(--font-sans);
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}
.pad {
  padding: 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
  flex-wrap: wrap;
}
.head h3 {
  margin: 0;
  font: var(--text-h4);
}
.actions {
  display: flex;
  gap: 4px;
}
.links {
  list-style: none;
  margin: 0;
  padding: 0;
}
.link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  flex: 1;
  color: inherit;
  text-decoration: none;
}
.who > span {
  display: flex;
  flex-direction: column;
}
.who__name {
  font: 500 14px var(--font-sans);
}
.relation {
  width: 140px;
}
.perms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.perm {
  display: flex;
  align-items: center;
  gap: 6px;
  font: var(--text-small);
}
.muted {
  margin: 0;
  font: var(--text-small);
  color: var(--text-muted);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
