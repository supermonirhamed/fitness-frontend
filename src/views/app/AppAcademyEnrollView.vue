<script setup lang="ts">
// Enrolling a child in an academy program from the app (US-11.26, US-10.07): child → program →
// the groups that suit them (age, gender, level) with schedule, coach, branch and places left →
// waivers → fees (term, instalments or monthly, US-10.10) → confirm. A full group offers its
// waiting list (US-10.11); a trial can be booked where the program allows it (US-10.15).
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import EmptyState from '@/components/patterns/EmptyState.vue'
import ErrorState from '@/components/patterns/ErrorState.vue'
import FormDialog from '@/components/patterns/FormDialog.vue'
import {
  clientApi,
  type AcademyEnrolled,
  type AppAcademyGroup,
  type AppProgram,
} from '@/api/clientApp'
import { useFormat } from '@/composables/useFormat'
import { showDay } from '@/lib/academy'
import { firstMessage } from '@/lib/apiErrors'
import { useClientApp } from '@/stores/clientApp'

const { t, locale } = useI18n()
const route = useRoute()
const format = useFormat()
const app = useClientApp()
const childId = ref<number | null>(route.query.client_id ? Number(route.query.client_id) : null)
const programs = ref<AppProgram[]>([])
const programId = ref<number | null>(null)
const groups = ref<AppAcademyGroup[] | null>(null)
const state = ref<'loading' | 'ready' | 'error' | 'off'>('loading')
const picked = ref<AppAcademyGroup | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const done = ref<
  | { kind: 'enrolled'; result: AcademyEnrolled }
  | { kind: 'waitlist'; position: number }
  | { kind: 'trial' }
  | null
>(null)

const children = computed(() => (app.children ?? []).filter((c) => c.permissions.can_book))
const childName = computed(
  () => children.value.find((c) => c.id === childId.value)?.first_name ?? '',
)
const weekday = (n: number) =>
  new Date(Date.UTC(2024, 0, 7 + n, 12)).toLocaleDateString(locale.value, {
    weekday: 'short',
    timeZone: 'UTC',
  })
const scheduleLine = (g: AppAcademyGroup) =>
  g.schedule.map((s) => `${s.weekdays.map(weekday).join('، ')} · ${s.start_time}`).join(' — ')

onMounted(async () => {
  try {
    const [list] = await Promise.all([clientApi.academy.programs(), app.loadChildren()])
    programs.value = list
    if (list.length === 1) programId.value = list[0]!.id
    if (!childId.value && children.value.length === 1) childId.value = children.value[0]!.id
    state.value = 'ready'
  } catch (e) {
    state.value =
      (e as { response?: { status?: number } }).response?.status === 403 ? 'off' : 'error'
  }
})
async function loadGroups() {
  groups.value = null
  done.value = null
  if (!programId.value || !childId.value) return
  groups.value = await clientApi.academy.groups(programId.value, childId.value).catch(() => [])
}
watch([programId, childId], loadGroups)

async function act(run: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await run()
  } catch (e) {
    error.value = firstMessage(e) ?? t('common.genericError')
  } finally {
    busy.value = false
  }
}
const enroll = () =>
  act(async () => {
    const result = await clientApi.academy.enroll(picked.value!.id, childId.value)
    picked.value = null
    done.value = { kind: 'enrolled', result }
  })
const joinWaitlist = (g: AppAcademyGroup) =>
  act(async () => {
    const { position } = await clientApi.academy.joinWaitlist(g.id, childId.value)
    done.value = { kind: 'waitlist', position }
  })
const bookTrial = (g: AppAcademyGroup, sessionId: number) =>
  act(async () => {
    await clientApi.academy.trial(g.id, childId.value, sessionId)
    done.value = { kind: 'trial' }
  })
</script>

<template>
  <div class="ca-stack">
    <h1 class="ca-title">{{ t('app.academy.enrollTitle') }}</h1>
    <div v-if="state === 'loading'" class="ca-card"><Skeleton height="120px" /></div>
    <ErrorState v-else-if="state === 'error'" />
    <EmptyState v-else-if="state === 'off'" icon="pi-lock" :title="t('app.academy.off')" />
    <EmptyState
      v-else-if="!children.length"
      icon="pi-users"
      :title="t('app.academy.noChildren')"
      :body="t('app.family.noneHint')"
    >
      <RouterLink :to="{ name: 'app.child.new' }" custom v-slot="{ navigate }">
        <Button :label="t('app.family.add')" icon="pi pi-plus" @click="navigate" />
      </RouterLink>
    </EmptyState>
    <template v-else>
      <section class="ca-card ca-form">
        <span class="ca-muted ca-small">{{ t('app.academy.child') }}</span>
        <SelectButton
          v-model="childId"
          :options="children.map((c) => ({ value: c.id, label: c.first_name }))"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <span class="ca-muted ca-small">{{ t('app.academy.program') }}</span>
        <EmptyState
          v-if="!programs.length"
          compact
          icon="pi-flag"
          :title="t('app.academy.noPrograms')"
        />
        <SelectButton
          v-else
          v-model="programId"
          :options="programs.map((p) => ({ value: p.id, label: p.name }))"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </section>

      <Message
        v-if="done?.kind === 'enrolled'"
        severity="success"
        :closable="false"
        icon="pi pi-check-circle"
      >
        {{ t('app.academy.enrolled', { name: childName, n: done.result.booked }) }}
        <template v-if="done.result.invoices.length">
          {{
            t('app.academy.invoiced', {
              amount: format.money(done.result.invoices.reduce((s, i) => s + i.total, 0)),
            })
          }}
          <RouterLink :to="{ name: 'app.payments' }">{{ t('app.payments.title') }}</RouterLink>
        </template>
      </Message>
      <Message v-else-if="done?.kind === 'waitlist'" severity="info" :closable="false">{{
        t('app.academy.onWaitlist', { name: childName, n: done.position })
      }}</Message>
      <Message v-else-if="done?.kind === 'trial'" severity="success" :closable="false">{{
        t('app.academy.trialBooked', { name: childName })
      }}</Message>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div v-if="programId && childId && groups === null" class="ca-card">
        <Skeleton height="160px" />
      </div>
      <EmptyState
        v-else-if="groups && !groups.length"
        icon="pi-users"
        :title="t('app.academy.noGroups')"
      />
      <article
        v-for="g in groups ?? []"
        :key="g.id"
        class="ca-card group"
        :class="{ 'group--off': !g.suitable }"
      >
        <div class="ca-spread">
          <h2 class="ca-subtitle">{{ g.name }}</h2>
          <Tag v-if="!g.suitable" severity="secondary" :value="t('app.academy.notSuitable')" />
          <Tag
            v-else-if="g.places_left > 0"
            severity="success"
            :value="t('app.academy.placesLeft', { n: g.places_left }, g.places_left)"
          />
          <Tag v-else severity="warn" :value="t('app.schedule.full')" />
        </div>
        <p class="ca-small">
          {{ [g.level, g.age_group, g.location, g.coach].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="g.schedule.length" class="ca-small">
          <i class="pi pi-clock" aria-hidden="true" /> {{ scheduleLine(g) }}
        </p>
        <p v-if="g.term" class="ca-muted ca-small">
          {{ g.term.name }} · {{ showDay(format, g.term.starts_on) }} –
          {{ g.term.ends_on ? showDay(format, g.term.ends_on) : '…' }}
        </p>
        <p
          v-for="r in g.reasons.filter((x) => x.check !== 'capacity')"
          :key="r.code"
          class="ca-muted ca-small"
        >
          <i class="pi pi-info-circle" aria-hidden="true" /> {{ r.message }}
        </p>
        <div v-if="g.suitable" class="ca-row actions">
          <RouterLink
            v-if="g.waivers_missing"
            :to="{ name: 'app.waivers', query: { redirect: route.fullPath } }"
            custom
            v-slot="{ navigate }"
          >
            <Button
              :label="t('app.waivers.signNow')"
              icon="pi pi-file-edit"
              size="small"
              @click="navigate"
            />
          </RouterLink>
          <Button
            v-else-if="g.places_left > 0"
            :label="t('app.academy.enroll')"
            size="small"
            @click="picked = g"
          />
          <Button
            v-if="g.waitlist"
            :label="t('app.academy.joinWaitlist')"
            icon="pi pi-users"
            size="small"
            variant="outlined"
            :loading="busy"
            @click="joinWaitlist(g)"
          />
        </div>
        <details v-if="g.trial_sessions.length && g.suitable" class="trial">
          <summary class="ca-small">{{ t('app.academy.trial') }}</summary>
          <div class="ca-row trial__list">
            <Button
              v-for="s in g.trial_sessions"
              :key="s.id"
              :label="`${showDay(format, s.date)} ${s.time}`"
              size="small"
              variant="text"
              :loading="busy"
              @click="bookTrial(g, s.id)"
            />
          </div>
        </details>
      </article>
    </template>

    <FormDialog
      :visible="!!picked"
      :title="t('app.academy.confirmTitle')"
      :subtitle="picked ? `${childName} · ${picked.name}` : ''"
      :save-label="t('app.academy.confirm')"
      :saving="busy"
      @update:visible="(v: boolean) => !v && (picked = null)"
      @save="enroll"
    >
      <template v-if="picked?.fees">
        <p class="ca-muted ca-small">{{ t(`app.academy.feeModels.${picked.fees.model}`) }}</p>
        <ul class="ca-list fees">
          <li v-for="(l, i) in picked.fees.lines" :key="i" class="ca-spread">
            <span>
              {{ l.description }}
              <span class="ca-muted ca-small block">{{
                t('app.academy.due', { date: showDay(format, l.due_on) })
              }}</span>
            </span>
            <span class="ca-num">{{ format.money(l.amount - l.discount) }}</span>
          </li>
        </ul>
        <p class="ca-spread">
          <strong>{{ t('app.academy.total') }}</strong
          ><strong class="ca-num">{{ format.money(picked.fees.total) }}</strong>
        </p>
        <p v-if="picked.fees.sibling_discount_percent" class="ca-muted ca-small">
          {{ t('app.academy.sibling', { n: picked.fees.sibling_discount_percent }) }}
        </p>
      </template>
    </FormDialog>
  </div>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.group--off {
  opacity: 0.7;
}
.group p {
  margin: 0;
}
.actions {
  margin-top: 6px;
  flex-wrap: wrap;
  gap: 8px;
}
.trial summary {
  cursor: pointer;
  color: var(--primary);
}
.trial__list {
  flex-wrap: wrap;
}
.fees li {
  padding: 6px 0;
}
.block {
  display: block;
}
</style>
