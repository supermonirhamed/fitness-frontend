<script setup lang="ts">
// A child's page for their parent (US-11.25): bookings, academy enrollments, attendance and, with
// "can pay", payments. Photo and health notes (write-only) can be updated; booking and buying for
// the child start from here with the child already chosen.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import StatusTag from '@/components/patterns/StatusTag.vue'
import { clientApi, type FamilyChildProfile } from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const format = useFormat()
const app = useClientApp()
const id = Number(route.params.id)
const child = ref<FamilyChildProfile | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const health = ref('')
const savingHealth = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function load() {
  state.value = 'loading'
  try {
    child.value = await clientApi.family.get(id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}
onMounted(load)

async function saveHealth() {
  savingHealth.value = true
  try {
    await clientApi.family.healthNotes(id, health.value.trim() || null)
    health.value = ''
    if (child.value) child.value.has_health_notes = true
    toast.add({ severity: 'success', summary: t('app.family.healthSent'), life: 3000 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: firstMessage(e) ?? t('common.genericError'),
      life: 4000,
    })
  } finally {
    savingHealth.value = false
  }
}
async function upload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    child.value = await clientApi.family.uploadPhoto(id, file)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: firstMessage(err) ?? t('common.genericError'),
      life: 4000,
    })
  }
}
</script>

<template>
  <div class="ca-stack">
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="200px" /></div>
    <ErrorState v-else-if="state === 'error'" @retry="load" />
    <template v-else-if="child">
      <section class="ca-card ca-spread head">
        <button
          type="button"
          class="photo-btn"
          :aria-label="t('app.family.photo')"
          @click="fileInput?.click()"
        >
          <img v-if="child.photo_url" :src="child.photo_url" alt="" class="avatar" />
          <span v-else class="avatar avatar--initial" aria-hidden="true">{{
            child.first_name.charAt(0)
          }}</span>
          <i class="pi pi-camera cam" aria-hidden="true" />
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          @change="upload"
        />
        <div class="grow">
          <h1 class="ca-title">{{ child.first_name }} {{ child.last_name }}</h1>
          <p class="ca-muted ca-small">
            {{
              [
                child.age !== null ? t('app.family.age', { n: child.age }, child.age) : null,
                child.member_id,
              ]
                .filter(Boolean)
                .join(' · ')
            }}
          </p>
        </div>
        <RouterLink
          :to="{ name: 'app.child.edit', params: { id: child.id } }"
          custom
          v-slot="{ navigate }"
        >
          <Button
            icon="pi pi-pencil"
            variant="text"
            :aria-label="t('app.family.edit')"
            @click="navigate"
          />
        </RouterLink>
      </section>

      <div class="ca-row actions">
        <RouterLink
          v-if="child.permissions.can_book"
          :to="{ name: 'app.schedule', query: { client_id: child.id } }"
          custom
          v-slot="{ navigate }"
        >
          <Button
            icon="pi pi-calendar-plus"
            :label="t('app.family.book')"
            size="small"
            @click="navigate"
          />
        </RouterLink>
        <RouterLink
          v-if="child.permissions.can_book && app.config?.features.online_academy_enrollment"
          :to="{ name: 'app.academy.enroll', query: { client_id: child.id } }"
          custom
          v-slot="{ navigate }"
        >
          <Button
            icon="pi pi-flag"
            :label="t('app.academy.enrollTitle')"
            size="small"
            variant="outlined"
            @click="navigate"
          />
        </RouterLink>
        <RouterLink
          :to="{ name: 'app.attendance', query: { client_id: child.id, name: child.first_name } }"
          custom
          v-slot="{ navigate }"
        >
          <Button
            icon="pi pi-chart-bar"
            :label="t('app.attendance.title')"
            size="small"
            variant="outlined"
            @click="navigate"
          />
        </RouterLink>
        <RouterLink :to="{ name: 'app.waivers' }" custom v-slot="{ navigate }">
          <Button
            icon="pi pi-file-edit"
            :label="t('app.waivers.title')"
            size="small"
            variant="outlined"
            @click="navigate"
          />
        </RouterLink>
      </div>

      <section class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.family.upcoming') }}</h2>
        <EmptyState
          v-if="!child.bookings.bookings.length"
          compact
          icon="pi-calendar"
          :title="t('app.bookings.none')"
        />
        <ul v-else class="ca-list">
          <li v-for="b in child.bookings.bookings.slice(0, 5)" :key="b.id" class="row">
            <RouterLink
              :to="{
                name: 'app.session',
                params: { id: b.session.id },
                query: { client_id: child.id },
              }"
              class="ca-spread link"
            >
              <span>
                <strong>{{ b.session.service }}</strong>
                <span class="ca-muted ca-small block"
                  >{{ showDay(format, b.session.date) }} · {{ b.session.time }} ·
                  {{ b.session.location }}</span
                >
              </span>
              <i class="pi pi-angle-right pi-dir" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="child.enrollments.length" class="ca-card">
        <div class="ca-spread">
          <h2 class="ca-subtitle">{{ t('app.family.academy') }}</h2>
          <RouterLink
            :to="{ name: 'app.child.academy', params: { id: child.id } }"
            class="ca-small"
            >{{ t('app.family.academyOpen') }}</RouterLink
          >
        </div>
        <ul class="ca-list">
          <li v-for="e in child.enrollments" :key="e.id" class="ca-spread row">
            <span>
              <strong>{{ e.group }}</strong>
              <span class="ca-muted ca-small block">{{
                [e.program, e.term].filter(Boolean).join(' · ')
              }}</span>
            </span>
            <StatusTag :status="e.status" />
          </li>
        </ul>
      </section>

      <section class="ca-card stat">
        <span class="ca-muted ca-small">{{ t('app.family.attendance90') }}</span>
        <strong class="ca-num big">{{
          child.attendance.rate === null ? '—' : `${child.attendance.rate}%`
        }}</strong>
      </section>

      <section v-if="child.payments" class="ca-card">
        <h2 class="ca-subtitle">{{ t('app.payments.title') }}</h2>
        <EmptyState
          v-if="!child.payments.length"
          compact
          icon="pi-wallet"
          :title="t('app.family.noPayments')"
        />
        <ul v-else class="ca-list">
          <li v-for="i in child.payments" :key="i.id" class="ca-spread row">
            <span>
              <strong class="ca-num">{{ i.number }}</strong>
              <span class="ca-muted ca-small block">{{ showDay(format, i.issued_on) }}</span>
            </span>
            <span class="ca-row">
              <span class="ca-num">{{ format.money(i.total) }}</span>
              <Tag
                :severity="i.balance > 0 ? (i.overdue ? 'danger' : 'warn') : 'success'"
                :value="
                  i.balance > 0
                    ? t('app.family.due', { amount: format.money(i.balance) })
                    : t('app.family.paid')
                "
              />
            </span>
          </li>
        </ul>
      </section>

      <section class="ca-card ca-form">
        <h2 class="ca-subtitle">{{ t('app.family.healthNotes') }}</h2>
        <p class="ca-muted ca-small">
          {{ child.has_health_notes ? t('app.family.healthOnFile') : t('app.family.healthHint') }}
        </p>
        <Textarea v-model="health" rows="3" auto-resize :aria-label="t('app.family.healthNotes')" />
        <Button
          :label="t('app.family.healthSend')"
          size="small"
          :disabled="!health.trim()"
          :loading="savingHealth"
          @click="saveHealth"
        />
      </section>
      <p class="ca-muted ca-small">{{ t('app.family.unlinkHint') }}</p>
    </template>
  </div>
</template>

<style scoped>
.head {
  gap: 12px;
}
.grow {
  flex: 1;
  min-width: 0;
}
.photo-btn {
  position: relative;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
.avatar--initial {
  display: grid;
  place-items: center;
  background: var(--surface-100);
  font-weight: 600;
  font-size: 1.5rem;
}
.cam {
  position: absolute;
  inset-block-end: 0;
  inset-inline-end: 0;
  background: var(--surface-card);
  border-radius: 50%;
  padding: 4px;
  font-size: 0.75rem;
}
.actions {
  flex-wrap: wrap;
  gap: 8px;
}
.row {
  padding: 10px 0;
}
.link {
  color: var(--text-primary);
  text-decoration: none;
}
.block {
  display: block;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.big {
  font-size: 1.375rem;
}
</style>
