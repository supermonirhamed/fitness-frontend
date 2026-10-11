<script setup lang="ts">
// Substitute coach (US-03.13), as the design's SubstituteCoachDrawer (ScheduleDialogs.jsx): the
// coaches at the branch, eligible and free ones first, each with what stands in the way; pick one
// and choose whether booked clients are told. The replaced coach is kept as the original.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import PersonAvatar from '@/components/patterns/PersonAvatar.vue'
import { tenantApi, type CalendarSession, type SubstituteCandidate } from '@/api/tenant'
import { apiMessage } from '@/lib/apiErrors'
import { useStaffAuth } from '@/stores/staffAuth'

const props = defineProps<{ session: CalendarSession | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [session: CalendarSession] }>()
const { t, locale } = useI18n()
const auth = useStaffAuth()
const position = computed(() => (locale.value === 'ar' ? 'left' : 'right'))
const canOverride = computed(() => auth.can('schedule.override_staff'))

const state = ref<'loading' | 'ready' | 'error'>('loading')
const candidates = ref<SubstituteCandidate[]>([])
const pick = ref<number | null>(null)
const notify = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

watch(visible, async (open) => {
  if (!open || !props.session) return
  pick.value = null
  notify.value = true
  error.value = null
  state.value = 'loading'
  try {
    candidates.value = await tenantApi.sessions.substitutes(props.session.id)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
})

const selectable = (c: SubstituteCandidate) =>
  !c.current && c.level !== 'hard' && (c.eligible || canOverride.value)
const note = (c: SubstituteCandidate) => {
  if (c.current) return t('substitute.current')
  if (c.issues[0]) {
    const i = c.issues[0]
    return [i.title, i.who, i.when].filter(Boolean).join(' · ')
  }
  return c.eligible ? t('substitute.free') : t('substitute.notQualified')
}
const picked = computed(() => candidates.value.find((c) => c.id === pick.value) ?? null)

async function save() {
  if (!props.session || !picked.value) return
  saving.value = true
  error.value = null
  try {
    const session = await tenantApi.sessions.substitute(props.session.id, {
      coach_id: picked.value.id,
      notify: notify.value,
      ...(picked.value.level === 'soft' ? { confirm_warnings: true } : {}),
    })
    emit('saved', session)
    visible.value = false
  } catch (e) {
    error.value = apiMessage(e) ?? t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Drawer v-model:visible="visible" :position="position" :block-scroll="true">
    <template #header>
      <div>
        <div class="head__title">{{ t('substitute.title') }}</div>
        <div v-if="session" class="head__sub">
          {{ session.service.name }} ·
          <span dir="ltr">{{ session.local.start }}–{{ session.local.end }}</span>
        </div>
      </div>
    </template>

    <div class="body">
      <Message v-if="error" severity="error" :closable="false" role="alert">{{ error }}</Message>
      <div v-if="state === 'loading'" class="list" aria-busy="true">
        <Skeleton v-for="n in 4" :key="n" height="56px" />
      </div>
      <Message v-else-if="state === 'error'" severity="error" :closable="false">{{
        t('substitute.loadError')
      }}</Message>
      <div v-else class="list" role="radiogroup" :aria-label="t('substitute.title')">
        <label
          v-for="c in candidates"
          :key="c.id"
          :class="[
            'cand',
            { 'cand--on': pick === c.id, 'cand--off': !selectable(c), 'cand--current': c.current },
          ]"
        >
          <input
            v-model="pick"
            type="radio"
            name="substitute"
            :value="c.id"
            :disabled="!selectable(c)"
          />
          <PersonAvatar :name="c.name" />
          <span class="cand__text">
            <span class="cand__name">{{ c.name }}</span>
            <span
              :class="[
                'cand__note',
                c.level === 'hard'
                  ? 'cand__note--hard'
                  : c.level === 'soft'
                    ? 'cand__note--soft'
                    : c.eligible && !c.current
                      ? 'cand__note--ok'
                      : '',
              ]"
              >{{ note(c) }}</span
            >
          </span>
          <Tag
            v-if="c.eligible && !c.current && !c.level"
            severity="success"
            class="tag-sm"
            :value="t('substitute.freeTag')"
          />
        </label>
      </div>

      <div class="notify">
        <ToggleSwitch v-model="notify" input-id="sub-notify" />
        <label for="sub-notify">
          <span class="notify__label">{{ t('substitute.notify') }}</span>
          <span class="notify__hint">{{
            session?.booked
              ? t('substitute.notifyHint', { n: session.booked })
              : t('substitute.noBookings')
          }}</span>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="footer">
        <span v-if="picked?.level === 'soft'" class="footer__warn">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />{{
            t('substitute.withWarning')
          }}
        </span>
        <span class="footer__spacer" />
        <Button
          :label="t('common.cancel')"
          severity="secondary"
          variant="text"
          @click="visible = false"
        />
        <Button
          :label="t('substitute.assign')"
          :loading="saving"
          :disabled="!picked"
          @click="save"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.head__title {
  font: var(--text-h3);
}
.head__sub {
  font: var(--text-small);
  color: var(--text-secondary);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-card);
  cursor: pointer;
}
.cand input {
  accent-color: var(--primary);
}
.cand--on {
  border-color: var(--primary);
  background: var(--primary-subtle);
}
.cand--off {
  background: var(--surface-sunken);
  cursor: not-allowed;
  opacity: 0.75;
}
.cand__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cand__name {
  font: 500 14px/1.4 var(--font-sans);
}
.cand__note {
  font: var(--text-small);
  color: var(--text-muted);
}
.cand__note--ok {
  color: var(--sev-success-fg);
}
.cand__note--soft {
  color: var(--sev-warn-fg);
}
.cand__note--hard {
  color: var(--sev-danger-fg);
}
.notify {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.notify label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.notify__label {
  font: 500 14px var(--font-sans);
}
.notify__hint {
  font: var(--text-small);
  color: var(--text-secondary);
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.footer__spacer {
  flex: 1;
}
.footer__warn {
  font: var(--text-small);
  color: var(--sev-warn-fg);
}
.footer__warn i {
  margin-inline-end: 6px;
}
</style>
