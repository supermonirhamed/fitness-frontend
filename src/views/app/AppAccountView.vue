<script setup lang="ts">
// The client's account (US-11.05/06): member card and check-in QR, profile, email and mobile (a
// new one is confirmed with a code), photo, emergency contacts, health notes (sent to the club,
// never shown back), notification preferences per type and channel, sign out, and asking to
// delete the account after seeing what is still running or owed.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import MemberQrDialog from '@/components/app/MemberQrDialog.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import FormField from '@/components/patterns/FormField.vue'
import {
  clientApi,
  type ClientProfile,
  type DeletionSummary,
  type NotificationChannel,
  type NotificationType,
  type Preferences,
} from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { fromYmd, showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { validationErrors, type ValidationErrors } from '@/lib/http'
import { setLocale } from '@/i18n'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const format = useFormat()
const app = useClientApp()
const profile = ref<ClientProfile | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const photoVersion = ref(Date.now())
const saved = (summary = t('app.account.saved')) =>
  toast.add({ severity: 'success', summary, life: 2500 })
const failed = (e: unknown) =>
  toast.add({ severity: 'error', summary: firstMessage(e) ?? t('common.genericError'), life: 4000 })
const ymd = (d: Date | null) =>
  d
    ? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n, i) => String(n).padStart(i ? 2 : 4, '0'))
        .join('-')
    : null

const form = ref({
  first_name: '',
  last_name: '',
  date_of_birth: null as Date | null,
  gender: null as 'female' | 'male' | null,
  home_location_id: null as number | null,
  preferred_language: 'ar' as 'ar' | 'en',
  marketing_consent: false,
})
const errors = ref<ValidationErrors>({})
const contacts = ref<ClientProfile['emergency_contacts']>([])
const health = ref('')
const prefs = ref<Preferences | null>(null)
const whatsapp = ref<{ available: boolean; opted_in: boolean } | null>(null)
const types: NotificationType[] = ['reminders', 'waitlist', 'payments', 'marketing']
const channels: NotificationChannel[] = ['email', 'sms', 'push']

function adopt(p: ClientProfile) {
  profile.value = p
  form.value = {
    first_name: p.profile.first_name,
    last_name: p.profile.last_name,
    date_of_birth: fromYmd(p.profile.date_of_birth),
    gender: p.profile.gender,
    home_location_id: p.profile.home_location_id,
    preferred_language: p.profile.preferred_language ?? 'ar',
    marketing_consent: p.profile.marketing_consent,
  }
  contacts.value = p.emergency_contacts.map((c) => ({ ...c }))
  prefs.value = JSON.parse(JSON.stringify(p.preferences))
  whatsapp.value = p.whatsapp ? { ...p.whatsapp } : null
}

async function load() {
  state.value = 'loading'
  try {
    adopt(await clientApi.profile.get())
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

const savingProfile = ref(false)
async function saveProfile() {
  savingProfile.value = true
  errors.value = {}
  try {
    const p = await clientApi.profile.update({
      ...form.value,
      date_of_birth: ymd(form.value.date_of_birth),
    })
    adopt(p)
    app.adopt(p)
    setLocale(form.value.preferred_language, true)
    saved()
  } catch (e) {
    errors.value = validationErrors(e)
    if (!Object.keys(errors.value).length) failed(e)
  } finally {
    savingProfile.value = false
  }
}

// A new email or mobile, confirmed with the code sent to it.
const contact = ref<{
  open: boolean
  field: 'email' | 'mobile'
  value: string
  code: string
  sent: boolean
  busy: boolean
  error: string | null
}>({
  open: false,
  field: 'email',
  value: '',
  code: '',
  sent: false,
  busy: false,
  error: null,
})
function changeContact(field: 'email' | 'mobile') {
  contact.value = { open: true, field, value: '', code: '', sent: false, busy: false, error: null }
}
async function contactStep() {
  const c = contact.value
  c.busy = true
  c.error = null
  try {
    if (!c.sent) {
      const res = await clientApi.profile.requestContactChange(c.field, c.value)
      if (res.dev_code)
        toast.add({ severity: 'info', summary: t('app.devCode', { code: res.dev_code }) })
      c.sent = true
    } else {
      adopt(await clientApi.profile.confirmContactChange(c.field, c.value, c.code))
      c.open = false
      saved()
    }
  } catch (e) {
    c.error = firstMessage(e) ?? t('common.genericError')
  } finally {
    c.busy = false
  }
}

const photoInput = ref<HTMLInputElement | null>(null)
async function uploadPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    adopt(await clientApi.profile.uploadPhoto(file))
    photoVersion.value = Date.now()
  } catch (e) {
    failed(e)
  }
}
async function removePhoto() {
  await clientApi.profile.deletePhoto().catch(failed)
  await load()
}

async function saveContacts() {
  try {
    adopt(
      await clientApi.profile.emergencyContacts(contacts.value.filter((c) => c.name || c.phone)),
    )
    saved()
  } catch (e) {
    failed(e)
  }
}
async function saveHealth() {
  try {
    adopt(await clientApi.profile.healthNotes(health.value.trim() || null))
    health.value = ''
    saved(t('app.account.healthSent'))
  } catch (e) {
    failed(e)
  }
}
async function savePrefs() {
  try {
    adopt(
      await clientApi.profile.preferences(
        prefs.value!,
        whatsapp.value?.available ? whatsapp.value.opted_in : undefined,
      ),
    )
    saved()
  } catch (e) {
    failed(e)
  }
}

// The personal calendar feed (US-11.19): shown once when created; a new link revokes the old.
const feedUrl = ref<string | null>(null)
async function rotateFeed() {
  try {
    feedUrl.value = await clientApi.calendarFeed.rotate()
  } catch (e) {
    failed(e)
  }
}
async function revokeFeed() {
  await clientApi.calendarFeed.revoke().catch(failed)
  feedUrl.value = null
  saved(t('app.calendar.revoked'))
}
async function copyFeed() {
  await navigator.clipboard?.writeText(feedUrl.value ?? '').catch(() => null)
  saved(t('app.calendar.copied'))
}

const qrOpen = ref(false)
async function signOut() {
  await app.logout()
  await router.replace({ name: 'app.signin' })
}

// Deleting the account (US-11.06).
const deletion = ref<{
  open: boolean
  summary: DeletionSummary | null
  password: string
  reason: string
  busy: boolean
  error: string | null
}>({
  open: false,
  summary: null,
  password: '',
  reason: '',
  busy: false,
  error: null,
})
const pendingDeletion = computed(() => deletion.value.summary?.request ?? null)
async function openDeletion() {
  deletion.value = {
    open: true,
    summary: await clientApi.profile.deletion().catch(() => null),
    password: '',
    reason: '',
    busy: false,
    error: null,
  }
}
async function requestDeletion() {
  const d = deletion.value
  d.busy = true
  d.error = null
  try {
    d.summary = await clientApi.profile.requestDeletion(d.password, d.reason.trim() || null)
    d.open = false
    saved(t('app.account.deletion.requested'))
  } catch (e) {
    d.error = firstMessage(e) ?? t('common.genericError')
  } finally {
    d.busy = false
  }
}
async function cancelDeletion() {
  try {
    deletion.value.summary = await clientApi.profile.cancelDeletion()
    saved(t('app.account.deletion.cancelled'))
  } catch (e) {
    failed(e)
  }
}
onMounted(async () => {
  deletion.value.summary = await clientApi.profile.deletion().catch(() => null)
})
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.nav.account') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="120px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="profile">
      <section class="ca-card member">
        <img
          v-if="profile.profile.has_photo"
          :src="`${clientApi.photoUrl()}?v=${photoVersion}`"
          alt=""
          class="avatar"
        />
        <span v-else class="avatar avatar--initial" aria-hidden="true">{{
          profile.profile.first_name.charAt(0)
        }}</span>
        <div class="grow">
          <strong>{{ profile.profile.first_name }} {{ profile.profile.last_name }}</strong>
          <p class="ca-muted ca-small ca-num">{{ profile.client?.member_id }}</p>
        </div>
        <Button
          icon="pi pi-qrcode"
          :label="t('app.home.checkIn')"
          variant="outlined"
          size="small"
          @click="qrOpen = true"
        />
      </section>

      <nav class="ca-card menu" :aria-label="t('app.nav.account')">
        <RouterLink :to="{ name: 'app.memberships' }"
          ><i class="pi pi-id-card" aria-hidden="true" />{{ t('app.account.memberships')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
        <RouterLink :to="{ name: 'app.payments' }"
          ><i class="pi pi-wallet" aria-hidden="true" />{{ t('app.payments.title')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
        <RouterLink :to="{ name: 'app.family' }"
          ><i class="pi pi-users" aria-hidden="true" />{{ t('app.family.title')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
        <RouterLink :to="{ name: 'app.attendance' }"
          ><i class="pi pi-chart-bar" aria-hidden="true" />{{ t('app.attendance.title')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
        <RouterLink :to="{ name: 'app.waivers' }"
          ><i class="pi pi-file-edit" aria-hidden="true" />{{ t('app.waivers.title')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
        <RouterLink v-if="app.config?.features.online_sales" :to="{ name: 'app.shop' }"
          ><i class="pi pi-shopping-bag" aria-hidden="true" />{{ t('app.shop.title')
          }}<i class="pi pi-angle-right pi-dir" aria-hidden="true"
        /></RouterLink>
      </nav>

      <section class="ca-card ca-form">
        <h2 class="ca-subtitle">{{ t('app.calendar.title') }}</h2>
        <p class="ca-muted ca-small">{{ t('app.calendar.hint') }}</p>
        <div v-if="feedUrl" class="ca-row feed">
          <InputText
            :model-value="feedUrl"
            readonly
            dir="ltr"
            class="grow"
            :aria-label="t('app.calendar.title')"
          />
          <Button
            icon="pi pi-copy"
            variant="outlined"
            :aria-label="t('app.calendar.copy')"
            @click="copyFeed"
          />
        </div>
        <div class="ca-row">
          <Button
            :label="feedUrl ? t('app.calendar.newLink') : t('app.calendar.create')"
            icon="pi pi-link"
            size="small"
            variant="outlined"
            @click="rotateFeed"
          />
          <Button
            :label="t('app.calendar.revoke')"
            size="small"
            variant="text"
            severity="secondary"
            @click="revokeFeed"
          />
        </div>
      </section>

      <form class="ca-card ca-form" @submit.prevent="saveProfile">
        <h2 class="ca-subtitle">{{ t('app.account.profile') }}</h2>
        <div class="two">
          <FormField
            :label="t('app.profile.firstName')"
            for="ac-first"
            :error="errors.first_name?.[0]"
          >
            <InputText id="ac-first" v-model="form.first_name" fluid />
          </FormField>
          <FormField
            :label="t('app.profile.lastName')"
            for="ac-last"
            :error="errors.last_name?.[0]"
          >
            <InputText id="ac-last" v-model="form.last_name" fluid />
          </FormField>
        </div>
        <FormField
          :label="t('app.profile.dateOfBirth')"
          for="ac-dob"
          :error="errors.date_of_birth?.[0]"
        >
          <DatePicker
            v-model="form.date_of_birth"
            input-id="ac-dob"
            :max-date="new Date()"
            date-format="yy-mm-dd"
            show-icon
            fluid
          />
        </FormField>
        <FormField :label="t('app.profile.gender')">
          <SelectButton
            v-model="form.gender"
            :options="[
              { value: 'female', label: t('app.profile.female') },
              { value: 'male', label: t('app.profile.male') },
            ]"
            option-label="label"
            option-value="value"
          />
        </FormField>
        <FormField
          v-if="(app.config?.locations.length ?? 0) > 1"
          :label="t('app.profile.homeBranch')"
          for="ac-branch"
        >
          <Select
            v-model="form.home_location_id"
            input-id="ac-branch"
            :options="app.config!.locations"
            option-label="name"
            option-value="id"
            show-clear
            fluid
          />
        </FormField>
        <FormField :label="t('app.profile.language')">
          <SelectButton
            v-model="form.preferred_language"
            :options="[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ]"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
        </FormField>
        <label class="ca-row ca-small">
          <Checkbox v-model="form.marketing_consent" binary input-id="ac-marketing" />{{
            t('app.profile.marketing')
          }}
        </label>
        <Button type="submit" :label="t('common.save')" :loading="savingProfile" />
      </form>

      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.account.contact') }}</h2>
        <ul class="ca-list">
          <li v-for="field in ['email', 'mobile'] as const" :key="field" class="ca-spread line">
            <span>
              <span class="ca-muted ca-small">{{ t(`app.profile.${field}`) }}</span
              ><br />
              <span dir="ltr">{{ profile.profile[field] ?? '—' }}</span>
            </span>
            <Button
              :label="t('app.account.change')"
              variant="text"
              size="small"
              @click="changeContact(field)"
            />
          </li>
        </ul>
      </section>

      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.account.photo') }}</h2>
        <div class="ca-row">
          <Button
            :label="t('app.account.uploadPhoto')"
            icon="pi pi-camera"
            variant="outlined"
            size="small"
            @click="photoInput?.click()"
          />
          <Button
            v-if="profile.profile.has_photo"
            :label="t('app.account.removePhoto')"
            variant="text"
            severity="danger"
            size="small"
            @click="removePhoto"
          />
          <input
            ref="photoInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            @change="uploadPhoto"
          />
        </div>
      </section>

      <section class="ca-card ca-form">
        <h2 class="ca-subtitle">{{ t('app.account.emergency') }}</h2>
        <div v-for="(c, i) in contacts" :key="i" class="contact">
          <InputText
            v-model="c.name"
            :placeholder="t('app.account.contactName')"
            :aria-label="t('app.account.contactName')"
            fluid
          />
          <InputText
            v-model="c.relation"
            :placeholder="t('app.account.relation')"
            :aria-label="t('app.account.relation')"
            fluid
          />
          <InputText
            v-model="c.phone"
            type="tel"
            dir="ltr"
            :placeholder="t('app.profile.mobile')"
            :aria-label="t('app.profile.mobile')"
            fluid
          />
          <Button
            icon="pi pi-trash"
            variant="text"
            severity="secondary"
            :aria-label="t('app.account.removeContact')"
            @click="contacts.splice(i, 1)"
          />
        </div>
        <div class="ca-row">
          <Button
            v-if="contacts.length < 5"
            :label="t('app.account.addContact')"
            icon="pi pi-plus"
            variant="text"
            size="small"
            @click="contacts.push({ name: '', relation: '', phone: '' })"
          />
          <Button :label="t('common.save')" size="small" @click="saveContacts" />
        </div>
      </section>

      <section class="ca-card ca-form">
        <h2 class="ca-subtitle">{{ t('app.account.health') }}</h2>
        <p class="ca-muted ca-small">{{ t('app.account.healthHint') }}</p>
        <Message
          v-if="profile.profile.has_health_notes"
          severity="secondary"
          :closable="false"
          icon="pi pi-lock"
          >{{ t('app.account.healthOnFile') }}</Message
        >
        <Textarea
          v-model="health"
          rows="3"
          auto-resize
          maxlength="5000"
          :aria-label="t('app.account.health')"
          fluid
        />
        <Button
          :label="t('app.account.sendHealth')"
          size="small"
          :disabled="!health.trim()"
          @click="saveHealth"
        />
      </section>

      <section v-if="prefs" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.account.notifications') }}</h2>
        <table class="prefs">
          <thead>
            <tr>
              <th />
              <th v-for="c in channels" :key="c" scope="col">{{ t(`app.channels.${c}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="type in types" :key="type">
              <th scope="row">{{ t(`app.notificationTypes.${type}`) }}</th>
              <td v-for="c in channels" :key="c">
                <ToggleSwitch
                  v-model="prefs[type][c]"
                  :aria-label="`${t(`app.notificationTypes.${type}`)} — ${t(`app.channels.${c}`)}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <label v-if="whatsapp?.available" class="whatsapp">
          <ToggleSwitch v-model="whatsapp.opted_in" />{{ t('app.account.whatsappOptIn') }}
        </label>
        <p class="ca-muted ca-small">{{ t('app.account.notificationsHint') }}</p>
        <Button :label="t('common.save')" size="small" @click="savePrefs" />
      </section>

      <section class="ca-card ca-form">
        <Button
          :label="t('app.account.signOut')"
          icon="pi pi-sign-out"
          severity="secondary"
          variant="outlined"
          @click="signOut"
        />
        <Message v-if="pendingDeletion" severity="warn" :closable="false">
          {{ t('app.account.deletion.pending', { date: showDay(format, pendingDeletion.due_on) }) }}
          <Button
            :label="t('app.account.deletion.cancel')"
            variant="link"
            size="small"
            @click="cancelDeletion"
          />
        </Message>
        <Button
          v-else
          :label="t('app.account.deletion.open')"
          severity="danger"
          variant="text"
          @click="openDeletion"
        />
      </section>
    </template>

    <MemberQrDialog v-model:visible="qrOpen" :member-id="profile?.client?.member_id" />

    <FormDialog
      v-model:visible="contact.open"
      :title="t(`app.account.change_${contact.field}`)"
      :save-label="contact.sent ? t('app.account.confirm') : t('app.code.send')"
      :saving="contact.busy"
      :error="contact.error"
      @save="contactStep"
    >
      <FormField :label="t(`app.account.new_${contact.field}`)" for="cc-value">
        <InputText
          id="cc-value"
          v-model="contact.value"
          :type="contact.field === 'email' ? 'email' : 'tel'"
          dir="ltr"
          :disabled="contact.sent"
          fluid
        />
      </FormField>
      <FormField
        v-if="contact.sent"
        :label="t('app.code.label')"
        :help="t('app.account.codeSentTo', { to: contact.value })"
      >
        <div dir="ltr"><InputOtp v-model="contact.code" :length="6" integer-only /></div>
      </FormField>
    </FormDialog>

    <FormDialog
      v-model:visible="deletion.open"
      :title="t('app.account.deletion.title')"
      :save-label="t('app.account.deletion.submit')"
      :saving="deletion.busy"
      :error="deletion.error"
      danger
      @save="requestDeletion"
    >
      <p class="ca-small">
        {{ t('app.account.deletion.body', { days: deletion.summary?.days ?? 30 }) }}
      </p>
      <Message v-if="deletion.summary?.active.length" severity="warn" :closable="false">
        {{ t('app.account.deletion.active') }}
        <ul class="bullets">
          <li v-for="e in deletion.summary.active" :key="e.id">{{ e.name }}</li>
        </ul>
      </Message>
      <Message v-if="deletion.summary?.balance?.owed" severity="error" :closable="false">{{
        t('app.home.owed', { amount: format.money(deletion.summary.balance.owed) })
      }}</Message>
      <FormField :label="t('app.account.deletion.reason')" for="del-reason">
        <Textarea
          id="del-reason"
          v-model="deletion.reason"
          rows="2"
          auto-resize
          maxlength="1000"
          fluid
        />
      </FormField>
      <FormField :label="t('app.account.deletion.password')" for="del-password">
        <Password
          v-model="deletion.password"
          input-id="del-password"
          :feedback="false"
          toggle-mask
          fluid
        />
      </FormField>
    </FormDialog>
  </div>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  padding: 4px 16px;
}
.menu a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  color: var(--text-primary);
  text-decoration: none;
}
.menu a + a {
  border-top: 1px solid var(--border-default);
}
.menu a > i:last-child {
  margin-inline-start: auto;
  color: var(--text-muted);
}
.feed .grow {
  flex: 1;
}
.member {
  display: flex;
  align-items: center;
  gap: 12px;
}
.member p {
  margin: 0;
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.avatar--initial {
  display: grid;
  place-items: center;
  background: var(--primary-100);
  color: var(--primary-700);
  font-weight: 600;
  font-size: 1.25rem;
}
.grow {
  flex: 1;
  min-width: 0;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.line {
  padding: 8px 0;
}
.contact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-default);
}
.contact > :nth-child(3) {
  grid-column: 1;
}
.whatsapp {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 4px;
}
.prefs {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}
.prefs th,
.prefs td {
  padding: 8px 4px;
  text-align: center;
}
.prefs th[scope='row'] {
  text-align: start;
  font-weight: 500;
}
.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.qr img {
  width: 240px;
  height: 240px;
}
.bullets {
  margin: 4px 0 0;
  padding-inline-start: 18px;
}
</style>
