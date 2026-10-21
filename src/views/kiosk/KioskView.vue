<script setup lang="ts">
// The self check-in kiosk (US-08.05): a locked, full-screen page at a branch, paired once by the
// link staff open on the device (its token then stays on the device). A client scans their app QR
// or member card (with the camera, or a USB scanner that types it), or enters their mobile number
// and kiosk PIN; then sees only their first name and photo and their family's bookings here whose
// check-in is open, and confirms. It goes back to the start by itself after a short while.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import QrScanDialog from '@/components/checkin/QrScanDialog.vue'
import { kioskApi, type KioskBooking, type KioskIdentity, type KioskInfo } from '@/api/kiosk'
import { setLocale } from '@/i18n'
import { firstMessage } from '@/lib/apiErrors'
import { statusOf } from '@/lib/http'

const STORAGE_KEY = 'fitness.kiosk.token'
const IDLE_MS = 30_000
const { t, locale } = useI18n()

function readToken(): string | null {
  const fromLink = window.location.hash.replace(/^#/, '')
  try {
    if (fromLink) {
      localStorage.setItem(STORAGE_KEY, fromLink)
      history.replaceState(null, '', window.location.pathname)
    }
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return fromLink || null
  }
}
const token = ref(readToken())
const info = ref<KioskInfo | null>(null)
const state = ref<'loading' | 'unpaired' | 'start' | 'pin' | 'found' | 'error'>('loading')
const identity = ref<KioskIdentity | null>(null)
const bookings = ref<KioskBooking[]>([])
const message = ref<string | null>(null)
const busy = ref(false)
const scanning = ref(false)
const scanned = ref('')
const mobile = ref('')
const pin = ref('')
const done = ref<number | null>(null)
let idle: ReturnType<typeof setTimeout> | undefined

async function load() {
  if (!token.value) {
    state.value = 'unpaired'
    return
  }
  try {
    info.value = await kioskApi.info(token.value)
    state.value = 'start'
  } catch (e) {
    state.value = statusOf(e) === 401 ? 'unpaired' : 'error'
  }
}
onMounted(() => {
  load()
  window.addEventListener('pointerdown', touch)
  window.addEventListener('keydown', touch)
})
onBeforeUnmount(() => {
  clearTimeout(idle)
  window.removeEventListener('pointerdown', touch)
  window.removeEventListener('keydown', touch)
})

function reset() {
  clearTimeout(idle)
  identity.value = null
  bookings.value = []
  message.value = null
  mobile.value = ''
  pin.value = ''
  scanned.value = ''
  done.value = null
  if (state.value !== 'unpaired' && state.value !== 'error') state.value = 'start'
}
/** Any touch keeps the screen; otherwise it goes back to the start. */
function touch() {
  clearTimeout(idle)
  if (state.value === 'pin' || state.value === 'found') idle = setTimeout(reset, IDLE_MS)
}

async function identify(input: { code: string } | { mobile: string; pin: string }) {
  if (!token.value || busy.value) return
  busy.value = true
  message.value = null
  try {
    identity.value = await kioskApi.identify(token.value, input)
    bookings.value = identity.value.bookings
    state.value = 'found'
    touch()
  } catch (e) {
    if (statusOf(e) === 401) state.value = 'unpaired'
    message.value = firstMessage(e) ?? t('kiosk.genericError')
  } finally {
    busy.value = false
    pin.value = ''
    scanned.value = ''
  }
}
function submitScan() {
  if (scanned.value.trim()) identify({ code: scanned.value.trim() })
}
function submitPin() {
  if (mobile.value.trim() && /^\d{4,6}$/.test(pin.value))
    identify({ mobile: mobile.value.trim(), pin: pin.value })
}
function press(key: string) {
  if (key === 'back') pin.value = pin.value.slice(0, -1)
  else if (pin.value.length < 6) pin.value += key
}

async function checkIn(b: KioskBooking) {
  if (!token.value || !identity.value) return
  busy.value = true
  message.value = null
  try {
    bookings.value = await kioskApi.checkIn(token.value, identity.value.session, b.id)
    done.value = b.id
    clearTimeout(idle)
    idle = setTimeout(reset, 6000)
  } catch (e) {
    if (statusOf(e) === 401) {
      reset()
      message.value = t('kiosk.timedOut')
      return
    }
    message.value = firstMessage(e) ?? t('kiosk.genericError')
  } finally {
    busy.value = false
  }
}
function reason(codes: string[]): string {
  return codes.includes('too_early') ? t('kiosk.tooEarly') : t('kiosk.seeDesk')
}
const greeting = computed(() =>
  identity.value ? t('kiosk.hello', { name: identity.value.client.first_name }) : '',
)
function fullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => undefined)
}
function toggleLanguage() {
  setLocale(locale.value === 'ar' ? 'en' : 'ar', false)
}
</script>

<template>
  <main class="kiosk" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
    <header class="kiosk__bar">
      <div class="brand">
        <img v-if="info?.logo_url" :src="info.logo_url" alt="" class="brand__logo" />
        <div>
          <strong>{{ info?.organization ?? '' }}</strong>
          <span v-if="info" class="muted">{{ info.location.name }}</span>
        </div>
      </div>
      <div class="bar-actions">
        <Button
          :label="locale === 'ar' ? 'English' : 'العربية'"
          variant="text"
          severity="secondary"
          @click="toggleLanguage"
        />
        <Button
          icon="pi pi-window-maximize"
          variant="text"
          severity="secondary"
          :aria-label="t('kiosk.fullscreen')"
          @click="fullscreen"
        />
      </div>
    </header>

    <section class="kiosk__stage">
      <ProgressSpinner v-if="state === 'loading'" />

      <div v-else-if="state === 'unpaired'" class="panel">
        <i class="pi pi-tablet big" aria-hidden="true" />
        <h1>{{ t('kiosk.unpairedTitle') }}</h1>
        <p class="muted">{{ t('kiosk.unpairedHelp') }}</p>
      </div>

      <div v-else-if="state === 'error'" class="panel">
        <i class="pi pi-wifi big" aria-hidden="true" />
        <h1>{{ t('kiosk.offline') }}</h1>
        <Button :label="t('common.retry')" icon="pi pi-refresh" size="large" @click="load" />
      </div>

      <div v-else-if="state === 'start'" class="panel">
        <h1>{{ t('kiosk.welcome') }}</h1>
        <p class="muted">{{ t('kiosk.startHelp') }}</p>
        <div class="choices">
          <button type="button" class="choice" @click="scanning = true">
            <i class="pi pi-qrcode" aria-hidden="true" />
            <span>{{ t('kiosk.scan') }}</span>
          </button>
          <button type="button" class="choice" @click="state = 'pin'">
            <i class="pi pi-mobile" aria-hidden="true" />
            <span>{{ t('kiosk.usePin') }}</span>
          </button>
        </div>
        <!-- USB scanners type the code here and press Enter. -->
        <form class="scanner" @submit.prevent="submitScan">
          <InputText
            v-model="scanned"
            :aria-label="t('kiosk.scannerInput')"
            :placeholder="t('kiosk.scannerInput')"
            autocomplete="off"
            autofocus
            dir="ltr"
          />
        </form>
        <Message v-if="message" severity="warn" :closable="false">{{ message }}</Message>
      </div>

      <form v-else-if="state === 'pin'" class="panel" @submit.prevent="submitPin">
        <h1>{{ t('kiosk.pinTitle') }}</h1>
        <InputText
          v-model="mobile"
          type="tel"
          inputmode="tel"
          dir="ltr"
          class="mobile"
          :placeholder="t('kiosk.mobile')"
          :aria-label="t('kiosk.mobile')"
          autocomplete="off"
        />
        <div class="pin" :aria-label="t('kiosk.pin')" role="status">
          <span v-for="n in 6" :key="n" :class="['dot', { on: n <= pin.length }]" />
        </div>
        <div class="keypad" dir="ltr">
          <button
            v-for="k in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
            :key="k"
            type="button"
            @click="press(k)"
          >
            {{ k }}
          </button>
          <button type="button" :aria-label="t('kiosk.erase')" @click="press('back')">
            <i class="pi pi-delete-left" aria-hidden="true" />
          </button>
          <button type="button" @click="press('0')">0</button>
          <button
            type="submit"
            class="go"
            :disabled="busy || pin.length < 4 || !mobile.trim()"
            :aria-label="t('kiosk.continue')"
          >
            <i class="pi pi-arrow-right pi-dir" aria-hidden="true" />
          </button>
        </div>
        <Message v-if="message" severity="warn" :closable="false">{{ message }}</Message>
        <Button :label="t('common.back')" variant="text" size="large" @click="reset" />
      </form>

      <div v-else-if="state === 'found' && identity" class="panel wide">
        <div class="person">
          <img v-if="identity.client.photo" :src="identity.client.photo" alt="" class="avatar" />
          <span v-else class="avatar avatar--initial" aria-hidden="true">{{
            identity.client.first_name.charAt(0)
          }}</span>
          <h1>{{ greeting }}</h1>
        </div>
        <p v-if="!bookings.length" class="muted">{{ t('kiosk.noBookings') }}</p>
        <ul v-else class="bookings">
          <li v-for="b in bookings" :key="b.id" :class="{ done: b.checked_in }">
            <div class="booking">
              <strong>{{ b.session.service }}</strong>
              <span class="muted"
                ><span class="num">{{ b.session.time }}</span
                ><template v-if="b.session.facility"> · {{ b.session.facility }}</template
                ><template v-if="!b.client.self"> · {{ b.client.first_name }}</template></span
              >
            </div>
            <span v-if="b.checked_in" class="checked">
              <i class="pi pi-check-circle" aria-hidden="true" />
              {{ done === b.id ? t('kiosk.checkedInNow') : t('kiosk.checkedIn') }}
            </span>
            <Button
              v-else-if="b.can_check_in"
              :label="t('kiosk.checkIn')"
              icon="pi pi-check"
              size="large"
              :loading="busy"
              @click="checkIn(b)"
            />
            <span v-else class="muted">{{ reason(b.denials) }}</span>
          </li>
        </ul>
        <Message v-if="message" severity="warn" :closable="false">{{ message }}</Message>
        <Button :label="t('kiosk.done')" severity="secondary" size="large" @click="reset" />
      </div>
    </section>

    <QrScanDialog v-model:visible="scanning" @scanned="(code: string) => identify({ code })" />
  </main>
</template>

<style scoped>
.kiosk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-ground, var(--surface-page));
  color: var(--text-primary);
  user-select: none;
}
.kiosk__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-default);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand > div {
  display: flex;
  flex-direction: column;
}
.brand__logo {
  max-height: 40px;
  max-width: 120px;
}
.bar-actions {
  display: flex;
  gap: 4px;
}
.kiosk__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.panel {
  width: min(520px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}
.panel.wide {
  width: min(720px, 100%);
}
h1 {
  margin: 0;
  font: 600 28px/1.3 var(--font-sans);
}
.muted {
  margin: 0;
  color: var(--text-muted);
}
.big {
  font-size: 56px;
  color: var(--text-muted);
}
.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}
.choice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  border: 1px solid var(--border-default);
  border-radius: 16px;
  background: var(--surface-card);
  color: inherit;
  font: 600 18px var(--font-sans);
  cursor: pointer;
}
.choice i {
  font-size: 40px;
  color: var(--p-primary-color, var(--primary-600));
}
.scanner :deep(input) {
  opacity: 0.6;
  text-align: center;
}
.mobile {
  width: 100%;
  font-size: 22px;
  text-align: center;
}
.pin {
  display: flex;
  gap: 12px;
}
.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
}
.dot.on {
  background: var(--text-primary);
  border-color: var(--text-primary);
}
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 88px);
  gap: 12px;
}
.keypad button {
  height: 72px;
  border: 1px solid var(--border-default);
  border-radius: 14px;
  background: var(--surface-card);
  color: inherit;
  font: 600 26px var(--font-sans);
  cursor: pointer;
}
.keypad .go {
  background: var(--p-primary-color, var(--primary-600));
  color: var(--p-primary-contrast-color, #fff);
  border: 0;
}
.keypad .go:disabled {
  opacity: 0.4;
}
.person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar--initial {
  display: grid;
  place-items: center;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  font: 600 40px var(--font-sans);
}
.bookings {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bookings li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid var(--border-default);
  border-radius: 14px;
  background: var(--surface-card);
  text-align: start;
}
.booking {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 18px;
}
.checked {
  color: var(--sev-success-fg, var(--green-700));
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
